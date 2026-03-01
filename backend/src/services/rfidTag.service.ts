import { db } from '../config/db';
import { RfidTag } from '../models/rfidTag';

export const createRfidTag = async (tag: RfidTag): Promise<number> => {
  const [result] = await db.execute(
    'INSERT INTO rfid_tags (uid, beer_id) VALUES (?, ?)',
    [tag.uid, tag.beerId]
  );
  // @ts-ignore
  return (result as any).insertId;
};

export const findRfidTagByUid = async (uid: string): Promise<RfidTag | null> => {
  const [rows] = await db.execute(
    'SELECT id, uid, beer_id AS beerId FROM rfid_tags WHERE uid = ? LIMIT 1',
    [uid]
  );
  const data = (rows as any[])[0];
  return data ? { id: data.id, uid: data.uid, beerId: data.beerId } : null;
};
