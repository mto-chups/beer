// src/controllers/beerBu.controller.ts
import { Request, Response, NextFunction  } from 'express';
import path from 'path';
import { computeBacCurve } from '../services/beerBu.service';
import { findRfidTagByUid } from '../services/rfidTag.service';
import { recordBeerConsumed } from '../services/beerBu.service';

export const consumeBeer = async (req: Request, res: Response) => {
  try {
    // 1) Récupère et valide uid + userId
    const uid    = req.body.uid    || req.query.uid;
    const userId = Number(req.body.userId || req.query.userId);
    if (!uid || !userId) {
      return res.status(850).json({ message: 'UID et userId requis' });
    }

    // 2) Vérifie que l’UID existe bien
    const tag = await findRfidTagByUid(uid);
    if (!tag) {
      return res.status(404).json({ message: 'Balise RFID inconnue' });
    }

    // 3) Enregistre la bière consommée avec le bon rfidTagId
    const { id, score } = await recordBeerConsumed({
      rfidTagId: tag.id!,
      userId,
      drankAt: new Date()
    });

    // 4) Renvoie l’id et le score calculé
    return res.status(201).json({
      message: 'Bière consommée enregistrée',
      id,
      score
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const showBacPage = (req: Request, res: Response, next: NextFunction) => {
  const htmlPath = path.resolve(__dirname, '../../view/bac.html');
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