// src/controllers/beerBu.controller.ts
import { Request, Response, NextFunction  } from 'express';
import path from 'path';
import { computeBacCurve } from '../services/beerBu.service';
import { findRfidTagByUid } from '../services/rfidTag.service';
import { recordBeerConsumed } from '../services/beerBu.service';
import { getCurrentUserId, clearCurrentUserId } from '../services/kioskSession.service';
import { broadcastScanEvent } from './scanCallback.controller';

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

export const consumeBeerForCurrentUser = async (req: Request, res: Response) => {
  try {
    const uid = req.body.uid || req.query.uid;
    if (!uid) {
      return res.status(400).json({ message: 'UID requis' });
    }

    const userId = getCurrentUserId();
    if (!userId) {
      const payload = {
        uid,
        success: false,
        message: 'Aucun utilisateur sélectionné sur la borne'
      };
      broadcastScanEvent(payload);
      return res.status(409).json({ message: payload.message });
    }

    const { id, score } = await consumeBeerForUser(uid, userId);
    const payload = {
      uid,
      userId,
      success: true,
      message: 'Bière consommée enregistrée',
      score,
      id
    };
    broadcastScanEvent(payload);
    clearCurrentUserId();

    return res.status(201).json({
      message: payload.message,
      id,
      score,
      userId
    });
  } catch (err: any) {
    const status = err.status || 500;
    const payload = {
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
    const history = await computeBacCurve(userId);
    res.json({ history });
  } catch (err) {
    next(err);
  }
};
