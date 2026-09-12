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
  brand: string;
  type: string;
  volume_ml: number;
  alcohol_degree: number;
  scan_id?: string | null;
}

interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  weight: number;  // en kg
  age: number;
  gender: 'M'|'F';
}
type Point = { ts: string; bac: number };
type BacDrink = {
  id: number;
  drankAt: string;
  score: number;
  brand: string;
  type: string;
  volumeMl: number;
  alcoholDegree: number;
  alcoholGrams: number;
  theoreticalPeakBac: number;
  currentBacContribution: number;
};
type BacUser = {
  id: number;
  firstname: string;
  lastname: string;
  weight: number;
  age: number;
  gender: 'M' | 'F';
};
export type BacCurveResponse = {
  user: BacUser;
  summary: {
    currentBac: number;
    peakBac: number;
    totalDrinks: number;
    totalAlcoholGrams: number;
    windowHours: number;
  };
  history: Point[];
  drinks: BacDrink[];
};
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
  const result = await getBacDetails(userId);
  return result.history;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number.parseFloat(value);
  }

  return 0;
}

function computeAlcoholGrams(volumeMl: number, alcoholDegree: number): number {
  return volumeMl * (alcoholDegree / 100) * 0.789;
}

function computeCurrentContribution(params: {
  alcoholGrams: number;
  elapsedMinutes: number;
  distributionRatio: number;
  weightKg: number;
  eliminationRate: number;
}): number {
  if (params.elapsedMinutes < 0) {
    return 0;
  }

  const absorbedAlcohol = Math.min(1, params.elapsedMinutes / 45) * params.alcoholGrams;
  const rawBac = absorbedAlcohol / (params.distributionRatio * params.weightKg);
  const eliminated = params.eliminationRate * (params.elapsedMinutes / 60);
  return Math.max(0, rawBac - eliminated);
}

export const getBacDetails = async (userId: number): Promise<BacCurveResponse> => {
  const [drinks] = await db.execute<BeerBuRow[]>(
    `SELECT bbu.drank_at   AS drankAt,
            bbu.id,
            bbu.score,
            beers.brand,
            beers.type,
            beers.volume_ml,
            beers.alcohol_degree
     FROM beer_bu bbu
     JOIN rfid_tags rt   ON rt.id = bbu.rfid_tag_id
     JOIN beers    ON beers.id = rt.beer_id
     WHERE bbu.user_id = ?
     ORDER BY bbu.drank_at ASC`,
    [userId]
  );

  const [rawUsers] = await db.execute<RowDataPacket[]>(
    `SELECT id, first_name, last_name, weight, age, gender
     FROM users
     WHERE id = ?`,
    [userId]
  );
  const user = (rawUsers as UserRow[])[0];
  if (!user) {
    throw new Error(`Utilisateur ${userId} introuvable`);
  }

  if (!user.weight || !user.gender) {
    throw new Error(`Données manquantes pour l'utilisateur ${userId}`);
  }

  const weight = toNumber(user.weight);
  const r = user.gender === 'M' ? 0.68 : 0.55;
  const beta = 0.15; // g/L/h
  const nowTs = Date.now();

  const normalizedDrinks: BacDrink[] = drinks.map((drink) => {
    const volumeMl = toNumber(drink.volume_ml);
    const alcoholDegree = toNumber(drink.alcohol_degree);
    const alcoholGrams = computeAlcoholGrams(volumeMl, alcoholDegree);
    const peakBac = alcoholGrams / (r * weight);
    const elapsedMinutes = (nowTs - new Date(drink.drankAt).getTime()) / 60000;
    const currentBacContribution = computeCurrentContribution({
      alcoholGrams,
      elapsedMinutes,
      distributionRatio: r,
      weightKg: weight,
      eliminationRate: beta,
    });

    return {
      id: drink.id,
      drankAt: new Date(drink.drankAt).toISOString(),
      score: Number(drink.score),
      brand: drink.brand,
      type: drink.type,
      volumeMl,
      alcoholDegree,
      alcoholGrams: Number(alcoholGrams.toFixed(2)),
      theoreticalPeakBac: Number(peakBac.toFixed(3)),
      currentBacContribution: Number(currentBacContribution.toFixed(3)),
    };
  });

  if (normalizedDrinks.length === 0) {
    return {
      user: {
        id: user.id,
        firstname: user.first_name,
        lastname: user.last_name,
        weight,
        age: user.age,
        gender: user.gender,
      },
      summary: {
        currentBac: 0,
        peakBac: 0,
        totalDrinks: 0,
        totalAlcoholGrams: 0,
        windowHours: 24,
      },
      history: [],
      drinks: [],
    };
  }

  const firstDrinkTs = new Date(drinks[0].drankAt).getTime();
  const startTs = Math.max(firstDrinkTs, nowTs - 24 * 60 * 60 * 1000);
  const endTs = nowTs;

  const allPoints: Point[] = [];
  for (let t = startTs; t <= endTs; t += 60_000) {
    let bacTotal = 0;
    for (const drink of normalizedDrinks) {
      const drankTs = new Date(drink.drankAt).getTime();
      const dtMin = (t - drankTs) / 60000;
      bacTotal += computeCurrentContribution({
        alcoholGrams: drink.alcoholGrams,
        elapsedMinutes: dtMin,
        distributionRatio: r,
        weightKg: weight,
        eliminationRate: beta,
      });
    }
    allPoints.push({ ts: new Date(t).toISOString(), bac: +bacTotal.toFixed(3) });
  }

  const history = allPoints.filter(p => p.bac > 0);
  const currentBac = history.length > 0 ? history[history.length - 1].bac : 0;
  const peakBac = history.reduce((max, point) => Math.max(max, point.bac), 0);
  const totalAlcoholGrams = normalizedDrinks.reduce((sum, drink) => sum + drink.alcoholGrams, 0);

  return {
    user: {
      id: user.id,
      firstname: user.first_name,
      lastname: user.last_name,
      weight,
      age: user.age,
      gender: user.gender,
    },
    summary: {
      currentBac: Number(currentBac.toFixed(3)),
      peakBac: Number(peakBac.toFixed(3)),
      totalDrinks: normalizedDrinks.length,
      totalAlcoholGrams: Number(totalAlcoholGrams.toFixed(2)),
      windowHours: 24,
    },
    history,
    drinks: normalizedDrinks.slice().reverse(),
  };
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

export const recordSelectedBeerConsumed = async (params: {
  beerId: number;
  userId: number;
}): Promise<{ id: number; score: number }> => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id
       FROM beers
      WHERE id = ?
      LIMIT 1`,
    [params.beerId]
  );

  if (!rows.length) {
    throw new Error('Biere introuvable');
  }

  // beer_bu impose un rfid_tag_id unique. Un identifiant interne neuf permet
  // de comptabiliser chaque depot manuel sans attendre de badge physique.
  const manualUid = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const [tagResult] = await db.execute(
    `INSERT INTO rfid_tags (uid, beer_id)
     VALUES (?, ?)`,
    [manualUid, params.beerId]
  );
  const rfidTagId = Number((tagResult as any).insertId);

  return recordBeerConsumed({
    rfidTagId,
    userId: params.userId,
    drankAt: new Date(),
  });
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
