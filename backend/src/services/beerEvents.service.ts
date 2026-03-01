import { db } from '../config/db';
import { RowDataPacket } from 'mysql2';

export interface BeerEventInput {
  brand?: string | null;
  type?: string | null;
  bonus_pts: number;
  multiplier: number;
  starts_at: string; // ISO string ou format MySQL DATETIME
  ends_at: string;
}


export interface BeerEvent {
  id: number;
  brand: string | null;
  type: string | null;
  bonus_pts: number;
  multiplier: number;
  starts_at: string;
  ends_at: string;
}

export const insertBeerEvent = async (evt: BeerEventInput): Promise<{ id: number }> => {
  const [result] = await db.execute(
    `INSERT INTO beer_events
      (brand, type, bonus_pts, multiplier, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      evt.brand ?? null,
      evt.type  ?? null,
      evt.bonus_pts,
      evt.multiplier,
      evt.starts_at,
      evt.ends_at
    ]
  );
  // @ts-ignore: mysql2 typings
  return { id: (result as any).insertId };
};

export const getAllBeerEvents = async (): Promise<BeerEvent[]> => {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT 
       id,
       brand,
       type,
       bonus_pts,
       multiplier,
       starts_at,
       ends_at
     FROM beer_events
     ORDER BY starts_at DESC`
  );
  return rows as BeerEvent[];
};

export const deleteEventById = async (id: number) => {
  await db.execute('DELETE FROM beer_events WHERE id = ?', [id]);
};

export const updateEventById = async (id: number, data: any) => {
  await db.execute(
    `UPDATE beer_events
     SET brand = ?, type = ?, bonus_pts = ?, multiplier = ?, starts_at = ?, ends_at = ?
     WHERE id = ?`,
    [
      data.brand || null,
      data.type || null,
      data.bonus_pts,
      data.multiplier,
      data.starts_at,
      data.ends_at,
      id
    ]
  );
};

export const getEventById = async (id: number) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT * FROM beer_events WHERE id = ?',
    [id]
  );
  return rows[0] || null;
};