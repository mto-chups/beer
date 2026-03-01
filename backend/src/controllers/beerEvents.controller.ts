import { Request, Response } from 'express';
import { insertBeerEvent, getAllBeerEvents, deleteEventById, getEventById, updateEventById} from '../services/beerEvents.service';

export const createEvent = async (req: Request, res: Response) => {
  try {
    // On récupère brand, type (optionnels), bonus_pts, multiplier, starts_at, ends_at
    const { id } = await insertBeerEvent(req.body);
    res.status(201).json({ id, message: 'Événement créé' });
  } catch (err: any) {
    console.error('createEvent error:', err);
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

export const listBeerEvents = async (_: Request, res: Response) => {
  try {
    const events = await getAllBeerEvents();
    res.json(events);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Erreur serveur' });
  }
};

export const deleteBeerEvent = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await deleteEventById(id);
    res.status(204).send();
  } catch (e) {
    console.error("Erreur suppression :", e);
    res.status(500).json({ message: "Erreur serveur lors de la suppression" });
  }
};

export const getBeerEvent = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const event = await getEventById(id);
  if (!event) return res.status(404).json({ message: "Introuvable" });
  res.json(event);
};

export const updateBeerEvent = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  await updateEventById(id, req.body);
  res.json({ message: "Événement mis à jour" });
};