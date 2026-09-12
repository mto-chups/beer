// src/controllers/beerBu.controller.ts
import { Request, Response, NextFunction  } from 'express';
import path from 'path';
import {
  getBacDetails,
  consumeBeerScan,
  recordBeerConsumed,
  recordSelectedBeerConsumed,
  rejectScan,
} from '../services/beerBu.service';
import { findRfidTagByUid } from '../services/rfidTag.service';
import { getCurrentUserId, clearCurrentUserId } from '../services/kioskSession.service';
import { broadcastScanEvent } from './scanCallback.controller';
import { StatsService } from '../services/stats.service';
import { broadcastScoreUpdate } from '../services/scoreStream.service';
import { appendScanAuditLog } from '../services/scanAuditLog.service';

const consumeBeerForUser = async (uid: string, userId: number) => {
  const tag = await findRfidTagByUid(uid);
  if (!tag) {
    const error = new Error('Balise RFID inconnue');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const result = await recordBeerConsumed({
    rfidTagId: tag.id!,
    userId,
    drankAt: new Date()
  });

  return result;
};

export const consumeBeer = async (req: Request, res: Response) => {
  try {
    const uid    = req.body.uid    || req.query.uid;
    const userId = Number(req.body.userId || req.query.userId);
    if (!uid || !userId) {
      return res.status(400).json({ message: 'UID et userId requis' });
    }

    const { id, score } = await consumeBeerForUser(uid, userId);
    return res.status(201).json({
      message: 'Bière consommée enregistrée',
      id,
      score
    });
  } catch (err: any) {
    console.error(err);
    return res.status(err.status || 500).json({ message: err.message || 'Erreur serveur' });
  }
};

export const consumeSelectedBeer = async (req: Request, res: Response) => {
  const userId = Number(req.body.userId);
  const beerId = Number(req.body.beerId);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(beerId) || beerId <= 0) {
    return res.status(400).json({ message: 'userId et beerId valides requis' });
  }

  try {
    const result = await recordSelectedBeerConsumed({ userId, beerId });
    try {
      const eventId = `manual-beer-${result.id}`;
      const scorePayload = await StatsService.getScoreStreamPayload(eventId, userId);
      broadcastScoreUpdate(scorePayload);
    } catch (notificationError) {
      console.error('Biere enregistree, mais notification temps reel impossible:', notificationError);
    }

    return res.status(201).json({
      message: 'Biere consommee enregistree',
      id: result.id,
      score: result.score,
      userId,
      beerId,
    });
  } catch (err: any) {
    const status = err.message === 'Biere introuvable' ? 404 : 500;
    return res.status(status).json({ message: err.message || 'Erreur serveur' });
  }
};

export const consumeBeerForCurrentUser = async (req: Request, res: Response) => {
  try {
    const uid = String(req.body.uid || req.query.uid || '').trim().toUpperCase();
    const scanId = String(req.body.scanId || req.query.scanId || '').trim();
    const scannedAtRaw = req.body.scannedAt || req.query.scannedAt;
    const source = String(req.body.source || req.query.source || 'serial-bridge');

    if (!uid || !scanId) {
      return res.status(400).json({
        message: 'scanId et UID requis',
        status: 'rejected_final',
        code: 'invalid_payload',
      });
    }

    const scannedAt = scannedAtRaw ? new Date(String(scannedAtRaw)) : new Date();
    const userId = await getCurrentUserId();
    if (!userId) {
      const rejection = await rejectScan({
        scanId,
        uid,
        scannedAt,
        source,
        errorCode: 'no_current_user',
        errorMessage: 'Aucun utilisateur sélectionné sur la borne',
      });
      const payload = {
        scanId,
        uid,
        success: false,
        message: rejection.message,
        code: rejection.code,
      };
      broadcastScanEvent(payload);
      return res.status(409).json(rejection);
    }

    const result = await consumeBeerScan({
      scanId,
      uid,
      userId,
      scannedAt: Number.isNaN(scannedAt.getTime()) ? new Date() : scannedAt,
      source,
    });

    if (result.response.status === 'committed') {
      if (result.newlyCommitted) {
        const payload = {
          scanId,
          uid,
          userId,
          success: true,
          message: 'Biere consommee enregistree',
          score: result.response.score,
          id: result.response.id,
        };
        broadcastScanEvent(payload);
        await appendScanAuditLog({
          scanId,
          uid,
          userId,
          phase: 'broadcasted',
          status: 'success',
          beerBuId: result.response.id ?? null,
          score: result.response.score ?? null,
        });
        const scorePayload = await StatsService.getScoreStreamPayload(scanId, userId);
        broadcastScoreUpdate(scorePayload);
      }

      await clearCurrentUserId();
      return res.status(result.response.duplicate ? 200 : 201).json(result.response);
    }

    if (result.response.status === 'rejected_final') {
      broadcastScanEvent({
        scanId,
        uid,
        userId,
        success: false,
        message: result.response.message,
        code: result.response.code,
      });
      return res.status(409).json(result.response);
    }

    broadcastScanEvent({
      scanId,
      uid,
      userId,
      success: false,
      message: result.response.message,
      code: result.response.code,
    });
    return res.status(503).json(result.response);
  } catch (err: any) {
    const status = err.status || 500;
    const payload = {
      scanId: req.body.scanId || req.query.scanId || null,
      uid: req.body.uid || req.query.uid || null,
      success: false,
      message: err.message || 'Erreur serveur'
    };
    broadcastScanEvent(payload);
    return res.status(status).json({ message: payload.message });
  }
};

export const showBacPage = (req: Request, res: Response, next: NextFunction) => {
  const htmlPath = path.resolve(__dirname, '../../../public/view/bac.html');
  res.sendFile(htmlPath, err => {
    if (err) next(err);
  });
};

// --- nouvelle API JSON pour history + forecast ---
export const getBacData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = +req.params.userId;
    const bac = await getBacDetails(userId);
    res.json(bac);
  } catch (err) {
    next(err);
  }
};
