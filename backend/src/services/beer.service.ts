import { db } from '../config/db';

import { Beer } from '../models/beer';
import { RowDataPacket } from 'mysql2';

// Liste toutes les bières
export const fetchAllBeers = async (): Promise<Beer[]> => {
  const [rows] = await db.execute('SELECT id, brand, type, volume_ml, alcohol_degree FROM beers');
  return rows as Beer[];
};

export const findBeerById = async (id: number): Promise<Beer | null> => {
  const [rows] = await db.execute(
    'SELECT id, brand, type, volume_ml, alcohol_degree FROM beers WHERE id = ? LIMIT 1',
    [id]
  );
  const beer = (rows as Beer[])[0];
  return beer ?? null;
};

// Ajoute une bière (si pas de doublon)
export const createBeer = async (beer: Beer): Promise<number> => {
  const roundedDegree = Math.round(Number(beer.alcohol_degree) * 100) / 100;
  const roundedVolume = Math.round(Number(beer.volume_ml) * 100) / 100;

  // Vérifie l'unicité
  const [rows] = await db.execute(
    'SELECT id FROM beers WHERE brand = ? AND type = ? AND volume_ml = ? AND alcohol_degree = ?',
    [beer.brand, beer.type, roundedVolume, roundedDegree]
  );
  if ((rows as any[]).length > 0) {
    throw new Error("Cette bière existe déjà !");
  }
  const [result] = await db.execute(
    'INSERT INTO beers (brand, type, volume_ml, alcohol_degree) VALUES (?, ?, ?, ?)',
    [beer.brand, beer.type, roundedVolume, roundedDegree]
  );

  // @ts-ignore
  return (result as any).insertId;
};

// Supprime une bière par id
export const removeBeer = async (id: number) => {
  await db.execute('DELETE FROM beers WHERE id = ?', [id]);
};

// Met à jour une bière (évite les doublons à la modif)
export const updateBeerData = async (
  id: number,
  brand: string,
  type: string,
  volume_ml: number,
  alcohol_degree: number
) => {
  const roundedDegree = Math.round(Number(alcohol_degree) * 100) / 100;
  const roundedVolume = Math.round(Number(volume_ml) * 100) / 100;
  // Vérifie unicité sauf sur soi-même
  const [rows] = await db.execute(
    'SELECT id FROM beers WHERE brand = ? AND type = ? AND volume_ml = ? AND alcohol_degree = ? AND id != ?',
    [brand, type, roundedVolume, roundedDegree, id]
  );
  if ((rows as any[]).length > 0) {
    throw new Error("Une autre bière avec ces caractéristiques existe déjà !");
  }
  await db.execute(
    'UPDATE beers SET brand = ?, type = ?, volume_ml = ?, alcohol_degree = ? WHERE id = ?',
    [brand, type, roundedVolume, roundedDegree, id]
  );

};

export class BeerService {
  static async getAllBrands(): Promise<string[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT brand FROM beers ORDER BY brand`
    );
    return rows.map(r => r.brand as string);
  }

  static async getAllTypes(): Promise<string[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT type FROM beers ORDER BY type`
    );
    return rows.map(r => r.type as string);
  }
}
