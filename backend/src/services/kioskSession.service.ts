import { RowDataPacket } from 'mysql2';
import { db } from '../config/db';

const DEFAULT_KIOSK_ID = 'default';
const SESSION_TTL_SECONDS = 30;

interface KioskSessionRow extends RowDataPacket {
  current_user_id: number | null;
  motor_action: MotorAction | null;
}

export type MotorAction = 'cancel' | 'complete';

export interface KioskSessionState {
  userId: number | null;
  motorAction: MotorAction | null;
}

export const getCurrentKioskState = async (): Promise<KioskSessionState> => {
  const [rows] = await db.execute<KioskSessionRow[]>(
    `SELECT CASE
              WHEN expires_at IS NULL OR expires_at > NOW() THEN current_user_id
              ELSE NULL
            END AS current_user_id,
            motor_action
       FROM kiosk_session
      WHERE kiosk_id = ?
      LIMIT 1`,
    [DEFAULT_KIOSK_ID]
  );

  const row = rows[0];
  const sessionActive = row && row.current_user_id !== null;
  return {
    userId: sessionActive ? row.current_user_id : null,
    motorAction: row?.motor_action ?? null,
  };
};

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
      (kiosk_id, current_user_id, motor_action, expires_at)
     VALUES (?, ?, NULL, DATE_ADD(NOW(), INTERVAL ? SECOND))
     ON DUPLICATE KEY UPDATE
      current_user_id = VALUES(current_user_id),
      motor_action = NULL,
      expires_at = VALUES(expires_at),
      updated_at = CURRENT_TIMESTAMP`,
    [DEFAULT_KIOSK_ID, userId, SESSION_TTL_SECONDS]
  );
};

export const finishCurrentUser = async (motorAction: MotorAction): Promise<void> => {
  await db.execute(
    `INSERT INTO kiosk_session
      (kiosk_id, current_user_id, motor_action, expires_at)
     VALUES (?, NULL, ?, NULL)
     ON DUPLICATE KEY UPDATE
      current_user_id = NULL,
      motor_action = VALUES(motor_action),
      expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP`,
    [DEFAULT_KIOSK_ID, motorAction]
  );
};

export const clearMotorAction = async (): Promise<void> => {
  await db.execute(
    `UPDATE kiosk_session
        SET motor_action = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE kiosk_id = ?`,
    [DEFAULT_KIOSK_ID]
  );
};

export const clearCurrentUserId = async (): Promise<void> => {
  await db.execute(
    `INSERT INTO kiosk_session
      (kiosk_id, current_user_id, motor_action, expires_at)
     VALUES (?, NULL, NULL, NULL)
     ON DUPLICATE KEY UPDATE
      current_user_id = NULL,
      motor_action = NULL,
      expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP`,
    [DEFAULT_KIOSK_ID]
  );
};
