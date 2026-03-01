import { db } from '../config/db';
import { BeerBu } from '../models/beerBu';
import { differenceInMinutes } from 'date-fns';
import { RowDataPacket } from 'mysql2';


interface BeerBuRow extends RowDataPacket {
  id: number;
  rfidTagId: number;
  userId: number;
  drankAt: string;
  score: number;
  percent_alc: number;
}

interface UserRow {
  id: number;
  weight: number;  // en kg
  age: number;
  gender: 'M'|'F';
}
type Point = { ts: string; bac: number };

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

  // --- 4) Fenêtre fixe : dernières 24h ---
  const nowTs   = Date.now();
  const startTs = new Date("2025-06-15T11:00:00").getTime();
  const endTs   = new Date("2025-06-15T23:00:00").getTime();

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
