import { Request, Response } from 'express';
import { createRfidTag, findRfidTagByUid } from '../services/rfidTag.service';

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
