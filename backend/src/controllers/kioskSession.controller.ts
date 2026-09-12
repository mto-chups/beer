import { Request, Response } from 'express';
import {
  clearCurrentUserId,
  clearMotorAction,
  finishCurrentUser,
  getCurrentKioskState,
  setCurrentUserId,
  type MotorAction,
} from '../services/kioskSession.service';
import { findUserById } from '../services/user.service';

export const getCurrentKioskUser = async (_: Request, res: Response) => {
  try {
    res.json(await getCurrentKioskState());
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

export const setCurrentKioskUser = async (req: Request, res: Response) => {
  const userId = Number(req.body.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'userId invalide' });
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    await setCurrentUserId(userId);
    return res.json({ message: 'Utilisateur courant défini', userId });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

export const clearCurrentKioskUser = async (req: Request, res: Response) => {
  try {
    const motorAction = String(req.query.motorAction || '');
    if (motorAction && motorAction !== 'cancel' && motorAction !== 'complete') {
      return res.status(400).json({ message: 'motorAction invalide' });
    }

    if (motorAction) {
      await finishCurrentUser(motorAction as MotorAction);
    } else {
      await clearCurrentUserId();
    }

    res.json({
      message: 'Utilisateur courant effacé',
      motorAction: motorAction || null,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

export const acknowledgeMotorAction = async (_: Request, res: Response) => {
  try {
    await clearMotorAction();
    res.json({ message: 'Commande moteur acquittee' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};
