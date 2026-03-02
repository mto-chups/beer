import { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { db } from '../config/db';
import { ConsumeCurrentResponse, ScanEvent, ScanEventStatus } from '../models/scanEvent';

type Executor = Pool | PoolConnection;

interface ScanEventRow extends RowDataPacket {
  scan_id: string;
  uid: string;
  user_id: number | null;
  rfid_tag_id: number | null;
  status: ScanEventStatus;
  error_code: string | null;
  error_message: string | null;
  beer_bu_id: number | null;
  score: number | null;
  source: string | null;
  scanned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function executor(conn?: PoolConnection): Executor {
  return conn ?? db;
}

function mapRow(row: ScanEventRow): ScanEvent {
  return {
    scanId: row.scan_id,
    uid: row.uid,
    userId: row.user_id,
    rfidTagId: row.rfid_tag_id,
    status: row.status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    beerBuId: row.beer_bu_id,
    score: row.score,
    source: row.source,
    scannedAt: row.scanned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createOrGetScanEvent(
  params: {
    scanId: string;
    uid: string;
    userId?: number | null;
    source?: string | null;
    scannedAt?: Date | null;
  },
  conn?: PoolConnection
): Promise<ScanEvent> {
  const exec = executor(conn);
  await exec.execute<ResultSetHeader>(
    `INSERT INTO scan_events
      (scan_id, uid, user_id, status, source, scanned_at)
     VALUES (?, ?, ?, 'received', ?, ?)
     ON DUPLICATE KEY UPDATE
      uid = VALUES(uid),
      user_id = COALESCE(VALUES(user_id), user_id),
      source = COALESCE(VALUES(source), source),
      scanned_at = COALESCE(VALUES(scanned_at), scanned_at),
      updated_at = CURRENT_TIMESTAMP`,
    [
      params.scanId,
      params.uid,
      params.userId ?? null,
      params.source ?? null,
      params.scannedAt ?? null,
    ]
  );

  const [rows] = await exec.execute<ScanEventRow[]>(
    `SELECT *
       FROM scan_events
      WHERE scan_id = ?
      LIMIT 1`,
    [params.scanId]
  );

  return mapRow(rows[0]);
}

export async function getScanEventById(scanId: string, conn?: PoolConnection): Promise<ScanEvent | null> {
  const exec = executor(conn);
  const [rows] = await exec.execute<ScanEventRow[]>(
    `SELECT *
       FROM scan_events
      WHERE scan_id = ?
      LIMIT 1`,
    [scanId]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function lockScanEvent(scanId: string, conn: PoolConnection): Promise<ScanEvent | null> {
  const [rows] = await conn.execute<ScanEventRow[]>(
    `SELECT *
       FROM scan_events
      WHERE scan_id = ?
      LIMIT 1
      FOR UPDATE`,
    [scanId]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateScanEvent(
  scanId: string,
  patch: {
    userId?: number | null;
    rfidTagId?: number | null;
    status?: ScanEventStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
    beerBuId?: number | null;
    score?: number | null;
  },
  conn?: PoolConnection
): Promise<void> {
  const exec = executor(conn);
  await exec.execute(
    `UPDATE scan_events
        SET user_id = COALESCE(?, user_id),
            rfid_tag_id = COALESCE(?, rfid_tag_id),
            status = COALESCE(?, status),
            error_code = ?,
            error_message = ?,
            beer_bu_id = COALESCE(?, beer_bu_id),
            score = COALESCE(?, score),
            updated_at = CURRENT_TIMESTAMP
      WHERE scan_id = ?`,
    [
      patch.userId ?? null,
      patch.rfidTagId ?? null,
      patch.status ?? null,
      patch.errorCode ?? null,
      patch.errorMessage ?? null,
      patch.beerBuId ?? null,
      patch.score ?? null,
      scanId,
    ]
  );
}

export async function markValidated(
  scanId: string,
  params: { userId: number; rfidTagId: number },
  conn: PoolConnection
): Promise<void> {
  await updateScanEvent(
    scanId,
    {
      userId: params.userId,
      rfidTagId: params.rfidTagId,
      status: 'validated',
      errorCode: null,
      errorMessage: null,
    },
    conn
  );
}

export async function markCommitted(
  scanId: string,
  params: { userId: number; rfidTagId: number; beerBuId: number; score: number },
  conn: PoolConnection
): Promise<void> {
  await updateScanEvent(
    scanId,
    {
      userId: params.userId,
      rfidTagId: params.rfidTagId,
      beerBuId: params.beerBuId,
      score: params.score,
      status: 'committed',
      errorCode: null,
      errorMessage: null,
    },
    conn
  );
}

export async function markRejected(
  scanId: string,
  params: { userId?: number | null; errorCode: string; errorMessage: string },
  conn?: PoolConnection
): Promise<void> {
  await updateScanEvent(
    scanId,
    {
      userId: params.userId ?? null,
      status: 'rejected',
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
    },
    conn
  );
}

export async function markError(
  scanId: string,
  params: { userId?: number | null; errorCode: string; errorMessage: string },
  conn?: PoolConnection
): Promise<void> {
  await updateScanEvent(
    scanId,
    {
      userId: params.userId ?? null,
      status: 'error',
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
    },
    conn
  );
}

export function toCommittedResponse(scanEvent: ScanEvent, duplicate = false): ConsumeCurrentResponse {
  return {
    message: duplicate ? 'Scan deja traite' : 'Biere consommee enregistree',
    status: 'committed',
    scanId: scanEvent.scanId,
    id: scanEvent.beerBuId ?? undefined,
    score: scanEvent.score ?? undefined,
    userId: scanEvent.userId ?? undefined,
    duplicate,
  };
}

export function toRejectedResponse(scanEvent: ScanEvent): ConsumeCurrentResponse {
  return {
    message: scanEvent.errorMessage || 'Scan rejete',
    status: 'rejected_final',
    scanId: scanEvent.scanId,
    code: scanEvent.errorCode || 'rejected',
    userId: scanEvent.userId ?? undefined,
  };
}
