import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { BeerBu } from '../models/beerBu';
import { ConsumeCurrentResponse } from '../models/scanEvent';
import {
  createOrGetScanEvent,
  lockScanEvent,
  markCommitted,
  markError,
  markRejected,
  markValidated,
  toCommittedResponse,
  toRejectedResponse,
} from './scanEvent.service';
import { appendScanAuditLog } from './scanAuditLog.service';


interface BeerBuRow extends RowDataPacket {
  id: number;
  rfidTagId: number;
  userId: number;
  drankAt: string;
  score: number;
  alcohol_degree: number;
  scan_id?: string | null;
}

interface UserRow {
  id: number;
  weight: number;  // en kg
  age: number;
  gender: 'M'|'F';
}
type Point = { ts: string; bac: number };
type ConsumeCommittedResult = {
  response: ConsumeCurrentResponse;
  newlyCommitted: boolean;
};

const fetchActiveEvents = async (brand: string|null, type: string|null) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT bonus_pts, multiplier
       FROM beer_events
      WHERE (brand = ? OR brand IS NULL)
        AND (type  = ? OR type  IS NULL)
        AND starts_at <= NOW() AND NOW() < ends_at`,
    [brand, type]
  );
  return rows as { bonus_pts: number|null; multiplier: number|null }[];
};
export const computeBacCurve = async (userId: number): Promise<Point[]> => {
  // --- 1) Récupère les consommations ---
  const [drinks] = await db.execute<BeerBuRow[]>(
    `SELECT bbu.drank_at   AS drankAt,
            bbu.score,
            beers.alcohol_degree
     FROM beer_bu bbu
     JOIN rfid_tags rt   ON rt.id = bbu.rfid_tag_id
     JOIN beers    ON beers.id = rt.beer_id
     WHERE bbu.user_id = ?
     ORDER BY bbu.drank_at ASC`,
    [userId]
  );
  if (drinks.length === 0) {
    return [];
  }

  // --- 2) Récupère l'utilisateur ---
  const [rawUsers] = await db.execute<RowDataPacket[]>(
    `SELECT weight, age, gender
     FROM users
     WHERE id = ?`,
    [userId]
  );
  const user = (rawUsers as UserRow[])[0];
  if (!user.weight || !user.gender) {
    throw new Error(`Données manquantes pour l'utilisateur ${userId}`);
  }

  // --- 3) Paramètres cinétiques ---
  const r    = user.gender === 'M' ? 0.68 : 0.55;
  const beta = 0.15; // g/L/h

  // --- 4) Fenêtre glissante sur les dernières 24h ---
  const nowTs = Date.now();
  const firstDrinkTs = new Date(drinks[0].drankAt).getTime();
  const startTs = Math.max(firstDrinkTs, nowTs - 24 * 60 * 60 * 1000);
  const endTs = nowTs;

  // --- 5) Boucle minute-par-minute ---
  const allPoints: Point[] = [];
  for (let t = startTs; t <= endTs; t += 60_000) {
    let bacTotal = 0;
    for (const d of drinks) {
      const drankTs = new Date(d.drankAt).getTime();
      const dtMin   = (t - drankTs) / 60000;   // minute en flottant
      if (dtMin < 0) continue;
      const weight = typeof user.weight === 'string'
        ? parseFloat(user.weight)
        : user.weight;
      // absorption + élimination
      const alcDeg = typeof d.alcohol_degree === 'string'
        ? parseFloat(d.alcohol_degree)
        : d.alcohol_degree;
      const mAlc = (d.score * 330) * (alcDeg / 100) * 0.8;
      const absMin   = Math.min(45, dtMin);
      const absorbed = (absMin / 45) * mAlc;
      const current = absorbed / (r * weight) - beta * (dtMin / 60);
      bacTotal += Math.max(0, current);
    }
    allPoints.push({ ts: new Date(t).toISOString(), bac: +bacTotal.toFixed(3) });
  }

  // --- 6) Filtrer pour ne garder que bac > 0 ---
  return allPoints.filter(p => p.bac > 0);
};

export const recordBeerConsumed = async (event: BeerBu):
  Promise<{ id: number; score: number }> => {
  /** 1) On retrouve la bière associée au tag scanné */
  const [beerRows] = await db.execute<RowDataPacket[]>(
    `SELECT beers.brand, beers.type
       FROM beers
       JOIN rfid_tags ON beers.id = rfid_tags.beer_id
      WHERE rfid_tags.id = ?`,
    [event.rfidTagId]
  );
  if (!beerRows.length) throw new Error('RFID inconnu');
  const beer = beerRows[0];

  /** 2) Score de base */
  const baseScore = 1;

  /** 3) Tous les évènements applicables (marque / type / génériques) */
  const events = await fetchActiveEvents(beer.brand, beer.type);

  let bonus = 0;     // somme des bonus fixes
  let multi = 1;     // produit des multiplicateurs
  for (const ev of events) {
    bonus += ev.bonus_pts   ?? 0;
    multi *= ev.multiplier  ?? 1;
  }

  const finalScore = Math.round((baseScore + bonus) * multi);

  /** 4) INSERT avec le score déjà calculé */
  const [result] = await db.execute(
    `INSERT INTO beer_bu
       (rfid_tag_id, user_id, drank_at, score)
     VALUES (?, ?, ?, ?)`,
    [
      event.rfidTagId,
      event.userId,
      event.drankAt || new Date(),
      finalScore
    ]
  );

  // @ts-ignore  insertId exposé par mysql2
  return {
    id: (result as any).insertId as number,
    score: finalScore              
  };
};

async function findBeerTag(conn: PoolConnection, uid: string): Promise<{ id: number; brand: string | null; type: string | null } | null> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT rfid_tags.id, beers.brand, beers.type
       FROM rfid_tags
       JOIN beers ON beers.id = rfid_tags.beer_id
      WHERE rfid_tags.uid = ?
      LIMIT 1`,
    [uid]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    brand: typeof row.brand === 'string' ? row.brand : null,
    type: typeof row.type === 'string' ? row.type : null,
  };
}

async function insertBeerConsumption(
  conn: PoolConnection,
  event: { scanId: string; rfidTagId: number; userId: number; drankAt: Date; score: number }
): Promise<number> {
  const [result] = await conn.execute(
    `INSERT INTO beer_bu
      (rfid_tag_id, user_id, drank_at, score, scan_id)
     VALUES (?, ?, ?, ?, ?)`,
    [event.rfidTagId, event.userId, event.drankAt, event.score, event.scanId]
  );

  return Number((result as any).insertId);
}

async function calculateScore(brand: string | null, type: string | null): Promise<number> {
  const baseScore = 1;
  const events = await fetchActiveEvents(brand, type);

  let bonus = 0;
  let multi = 1;
  for (const ev of events) {
    bonus += ev.bonus_pts ?? 0;
    multi *= ev.multiplier ?? 1;
  }

  return Math.round((baseScore + bonus) * multi);
}

export async function rejectScan(
  params: {
    scanId: string;
    uid: string;
    userId?: number | null;
    scannedAt?: Date | null;
    source?: string | null;
    errorCode: string;
    errorMessage: string;
  }
): Promise<ConsumeCurrentResponse> {
  await createOrGetScanEvent(params);
  await markRejected(params.scanId, {
    userId: params.userId ?? null,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
  });
  const scanEvent = await createOrGetScanEvent(params);
  await appendScanAuditLog({
    scanId: params.scanId,
    uid: params.uid,
    userId: params.userId ?? null,
    phase: 'rejected',
    status: 'rejected',
    code: params.errorCode,
    message: params.errorMessage,
  });

  return toRejectedResponse(scanEvent);
}

export async function consumeBeerScan(params: {
  scanId: string;
  uid: string;
  userId: number;
  scannedAt?: Date | null;
  source?: string | null;
}): Promise<ConsumeCommittedResult> {
  await createOrGetScanEvent(params);
  await appendScanAuditLog({
    scanId: params.scanId,
    uid: params.uid,
    userId: params.userId,
    phase: 'received',
    status: 'received',
    source: params.source ?? null,
  });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await createOrGetScanEvent(params, conn);
    const locked = await lockScanEvent(params.scanId, conn);
    if (!locked) {
      throw new Error('scan_event_not_found');
    }

    if (locked.status === 'committed') {
      await conn.rollback();
      await appendScanAuditLog({
        scanId: params.scanId,
        uid: params.uid,
        userId: locked.userId ?? params.userId,
        phase: 'duplicate_replayed',
        status: 'committed',
        beerBuId: locked.beerBuId ?? null,
        score: locked.score ?? null,
      });
      return {
        response: toCommittedResponse(locked, true),
        newlyCommitted: false,
      };
    }

    if (locked.status === 'rejected') {
      await conn.rollback();
      return {
        response: toRejectedResponse(locked),
        newlyCommitted: false,
      };
    }

    const tag = await findBeerTag(conn, params.uid);
    if (!tag) {
      await markRejected(
        params.scanId,
        {
          userId: params.userId,
          errorCode: 'unknown_rfid',
          errorMessage: 'Balise RFID inconnue',
        },
        conn
      );
      await conn.commit();
      await appendScanAuditLog({
        scanId: params.scanId,
        uid: params.uid,
        userId: params.userId,
        phase: 'rejected',
        status: 'rejected',
        code: 'unknown_rfid',
        message: 'Balise RFID inconnue',
      });

      return {
        response: {
          message: 'Balise RFID inconnue',
          status: 'rejected_final',
          scanId: params.scanId,
          code: 'unknown_rfid',
          userId: params.userId,
        },
        newlyCommitted: false,
      };
    }

    await markValidated(params.scanId, { userId: params.userId, rfidTagId: tag.id }, conn);
    const finalScore = await calculateScore(tag.brand, tag.type);
    const beerBuId = await insertBeerConsumption(conn, {
      scanId: params.scanId,
      rfidTagId: tag.id,
      userId: params.userId,
      drankAt: params.scannedAt ?? new Date(),
      score: finalScore,
    });

    await markCommitted(
      params.scanId,
      {
        userId: params.userId,
        rfidTagId: tag.id,
        beerBuId,
        score: finalScore,
      },
      conn
    );
    await conn.commit();

    await appendScanAuditLog({
      scanId: params.scanId,
      uid: params.uid,
      userId: params.userId,
      phase: 'db_committed',
      status: 'success',
      beerBuId,
      score: finalScore,
    });

    return {
      response: {
        message: 'Biere consommee enregistree',
        status: 'committed',
        scanId: params.scanId,
        id: beerBuId,
        score: finalScore,
        userId: params.userId,
      },
      newlyCommitted: true,
    };
  } catch (error: any) {
    await conn.rollback();
    await markError(params.scanId, {
      userId: params.userId,
      errorCode: 'temporary_failure',
      errorMessage: error?.message || 'Erreur temporaire',
    });
    await appendScanAuditLog({
      scanId: params.scanId,
      uid: params.uid,
      userId: params.userId,
      phase: 'error',
      status: 'error',
      code: 'temporary_failure',
      message: error?.message || 'Erreur temporaire',
    });

    return {
      response: {
        message: 'Erreur temporaire',
        status: 'retryable_error',
        scanId: params.scanId,
        code: 'temporary_failure',
        userId: params.userId,
      },
      newlyCommitted: false,
    };
  } finally {
    conn.release();
  }
}


// Exemple pour récupérer toutes les consommations d’un utilisateur sur la dernière heure
export const getConsumptionByUserLastHour = async (userId: number): Promise<BeerBu[]> => {
  const [rows] = await db.execute(
    `SELECT 
       bbu.id, 
       bbu.rfid_tag_id AS rfidTagId, 
       bbu.user_id AS userId, 
       bbu.drank_at AS drankAt 
     FROM beer_bu bbu
     WHERE bbu.user_id = ?
       AND bbu.drank_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [userId]
  );
  return (rows as any[]).map(row => ({
    id: row.id,
    rfidTagId: row.rfidTagId,
    userId: row.userId,
    drankAt: new Date(row.drankAt),
  }));
};
