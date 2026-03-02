import { RowDataPacket } from 'mysql2';
import { db } from '../config/db';

const DEFAULT_KIOSK_ID = 'default';
const SESSION_TTL_SECONDS = 30;

interface KioskSessionRow extends RowDataPacket {
  current_user_id: number | null;
}

export const getCurrentUserId = async (): Promise<number | null> => {
  const [rows] = await db.execute<KioskSessionRow[]>(
    `SELECT current_user_id
       FROM kiosk_session
      WHERE kiosk_id = ?
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [DEFAULT_KIOSK_ID]
  );

  return rows[0]?.current_user_id ?? null;
};

export const setCurrentUserId = async (userId: number): Promise<void> => {
  await db.execute(
    `INSERT INTO kiosk_session
      (kiosk_id, current_user_id, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE
      current_user_id = VALUES(current_user_id),
      expires_at = VALUES(expires_at),
      updated_at = CURRENT_TIMESTAMP`,
    [DEFAULT_KIOSK_ID, userId, SESSION_TTL_SECONDS]
  );
};

export const clearCurrentUserId = async (): Promise<void> => {
  await db.execute(
    `INSERT INTO kiosk_session
      (kiosk_id, current_user_id, expires_at)
     VALUES (?, NULL, NULL)
     ON DUPLICATE KEY UPDATE
      current_user_id = NULL,
      expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP`,
    [DEFAULT_KIOSK_ID]
  );
};
