import { db } from '../config/db';

export interface ManualBonus {
  id?: number;
  teamId: number;
  points: number;
  reason?: string;
}

/**
 * Insère un bonus manuel dans la BDD.
 * @returns l'ID auto‐généré du nouvel enregistrement
 */
export async function createManualBonus(bonus: ManualBonus): Promise<number> {
  const sql = `
    INSERT INTO manual_bonus (team_id, points, reason)
    VALUES (?, ?, ?)
  `;
  const params = [
    bonus.teamId,
    bonus.points,
    bonus.reason || null
  ];
  const [result] = await db.execute(sql, params);
  // @ts-ignore
  return (result as any).insertId as number;
}
