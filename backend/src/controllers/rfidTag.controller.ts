import { Request, Response } from 'express';
import { createRfidTag, findRfidTagByUid } from '../services/rfidTag.service';
import { findBeerById } from '../services/beer.service';
import {
  clearCurrentRegistrationBeerId,
  getCurrentRegistrationBeerId,
  setCurrentRegistrationBeerId,
} from '../services/rfidRegistrationSession.service';
import { broadcastScanEvent } from './scanCallback.controller';

export const addRfidTag = async (req: Request, res: Response) => {
  const { uid, beerId } = req.body;

  if (!uid || beerId == null) {
    return res.status(400).json({ message: 'UID et beerId sont requis.' });
  }

  const beerIdNum = Number(beerId);
  if (isNaN(beerIdNum) || beerIdNum <= 0) {
    return res.status(400).json({ message: 'beerId doit être un nombre valide.' });
  }

  try {
    const exists = await findRfidTagByUid(uid);
    if (exists) {
      return res.status(409).json({ message: 'Cet UID est déjà enregistré.' });
    }

    const insertId = await createRfidTag({ uid, beerId: beerIdNum });
    return res
      .status(201)
      .json({ message: 'UID associé avec succès.', id: insertId });
  } catch (err: any) {
    console.error('addRfidTag error:', err);
    // MySQL ER_DUP_ENTRY si contrainte UNIQUE sur uid
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cet UID existe déjà.' });
    }
    return res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};

const formatBeerLabel = (beer: {
  brand: string;
  type: string;
  volume_ml: number;
  alcohol_degree: number;
}) => `${beer.brand} ${beer.type} ${Number(beer.volume_ml)}ml ${Number(beer.alcohol_degree)}%`;

export const getCurrentRfidBeer = async (_: Request, res: Response) => {
  const beerId = getCurrentRegistrationBeerId();
  if (!beerId) {
    return res.json({ beerId: null, beer: null });
  }

  const beer = await findBeerById(beerId);
  if (!beer) {
    clearCurrentRegistrationBeerId();
    return res.json({ beerId: null, beer: null });
  }

  return res.json({ beerId, beer });
};

export const setCurrentRfidBeer = async (req: Request, res: Response) => {
  const beerId = Number(req.body.beerId);
  if (!Number.isInteger(beerId) || beerId <= 0) {
    return res.status(400).json({ message: 'beerId invalide' });
  }

  try {
    const beer = await findBeerById(beerId);
    if (!beer) {
      return res.status(404).json({ message: 'Biere introuvable' });
    }

    setCurrentRegistrationBeerId(beerId);
    return res.json({
      message: 'Biere courante definie',
      beerId,
      beer,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};

export const clearCurrentRfidBeer = (_: Request, res: Response) => {
  clearCurrentRegistrationBeerId();
  res.json({ message: 'Biere courante effacee' });
};

export const addRfidTagForCurrentBeer = async (req: Request, res: Response) => {
  const uid = req.body.uid || req.query.uid;
  if (!uid) {
    return res.status(400).json({ message: 'UID requis' });
  }

  const beerId = getCurrentRegistrationBeerId();
  if (!beerId) {
    const payload = {
      eventType: 'rfid-registration',
      success: false,
      uid,
      message: 'Aucune biere selectionnee pour l association',
    };
    broadcastScanEvent(payload);
    return res.status(409).json({ message: payload.message });
  }

  try {
    const beer = await findBeerById(beerId);
    if (!beer) {
      clearCurrentRegistrationBeerId();
      const payload = {
        eventType: 'rfid-registration',
        success: false,
        uid,
        message: 'La biere courante n existe plus',
      };
      broadcastScanEvent(payload);
      return res.status(409).json({ message: payload.message });
    }

    const existingTag = await findRfidTagByUid(uid);
    if (existingTag) {
      const payload = {
        eventType: 'rfid-registration',
        success: false,
        uid,
        beerId,
        beerLabel: formatBeerLabel(beer),
        message: 'Cet UID est deja enregistre',
      };
      broadcastScanEvent(payload);
      return res.status(409).json({ message: payload.message });
    }

    const id = await createRfidTag({ uid, beerId });
    const payload = {
      eventType: 'rfid-registration',
      success: true,
      uid,
      beerId,
      beerLabel: formatBeerLabel(beer),
      tagId: id,
      message: 'Tag RFID associe avec succes',
    };
    broadcastScanEvent(payload);
    return res.status(201).json(payload);
  } catch (err: any) {
    const payload = {
      eventType: 'rfid-registration',
      success: false,
      uid,
      beerId,
      message: err.message || 'Erreur serveur.',
    };
    broadcastScanEvent(payload);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Cet UID existe deja.' });
    }
    return res.status(500).json({ message: payload.message });
  }
};
