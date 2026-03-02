import { Request, Response } from 'express';
import { clearCurrentUserId, getCurrentUserId, setCurrentUserId } from '../services/kioskSession.service';
import { findUserById } from '../services/user.service';

export const getCurrentKioskUser = async (_: Request, res: Response) => {
  try {
    res.json({ userId: await getCurrentUserId() });
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

export const clearCurrentKioskUser = async (_: Request, res: Response) => {
  try {
    await clearCurrentUserId();
    res.json({ message: 'Utilisateur courant effacé' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};
