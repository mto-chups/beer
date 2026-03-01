// src/controllers/manualBonus.controller.ts
import { Request, Response } from 'express';
import { createManualBonus, ManualBonus } from '../services/manualBonus.service';

export const addManualBonus = async (req: Request, res: Response) => {
const teamIdRaw = req.body.teamId;
  const pointsRaw = req.body.points;
  const reason = req.body.reason;

  const teamId = Number(teamIdRaw);
  const points = Number(pointsRaw);
  // Validation
  if (typeof teamId !== 'number' || isNaN(teamId)) {
    return res.status(400).json({ message: 'Identifiant d’équipe invalide.' });
  }
  if (typeof points !== 'number' || isNaN(points)) {
    return res.status(400).json({ message: 'Nombre de points invalide.' });
  }

  try {
    const bonusData: ManualBonus = { teamId, points, reason };
    const id = await createManualBonus(bonusData);
    return res
      .status(201)
      .json({ message: 'Bonus manuel ajouté.', id });
  } catch (err: any) {
    console.error('Erreur création manual_bonus :', err);
    return res
      .status(500)
      .json({ message: err.message || 'Erreur serveur.' });
  }
};
