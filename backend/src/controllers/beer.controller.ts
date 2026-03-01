import { Request, Response } from 'express';
import {
  createBeer,
  fetchAllBeers,
  removeBeer,
  updateBeerData, BeerService 
} from '../services/beer.service';

export const getBeers = async (_: Request, res: Response) => {
  try {
    const beers = await fetchAllBeers();
    res.json(beers);
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const addBeer = async (req: Request, res: Response) => {
  const { brand, type, volume_ml, alcohol_degree } = req.body;
  if (!brand || !type || !volume_ml || !alcohol_degree) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  const roundedDegree = Math.round(Number(alcohol_degree) * 100) / 100;
  const roundedVolume = Math.round(Number(volume_ml) * 100) / 100;

  try {
    const id = await createBeer({
      brand,
      type,
      volume_ml: Number(roundedVolume),
      alcohol_degree: Number(roundedDegree),
    });
    res.status(201).json({ message: "Bière ajoutée", id });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erreur serveur" });
  }
};

export const deleteBeer = async (req: Request, res: Response) => {
  try {
    await removeBeer(Number(req.params.id));
    res.json({ message: "Bière supprimée" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const updateBeer = async (req: Request, res: Response) => {
  const { brand, type, volume_ml, alcohol_degree } = req.body;
  if (!brand || !type || !volume_ml || !alcohol_degree) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }
  const roundedDegree = Math.round(Number(alcohol_degree) * 100) / 100;
  const roundedVolume = Math.round(Number(volume_ml) * 100) / 100;
  try {
    await updateBeerData(
      Number(req.params.id),
      brand,
      type,
      Number(roundedVolume),
      Number(roundedDegree)
    );
    res.json({ message: "Bière modifiée" });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erreur serveur" });
  }
};

export class BeerController {
  static async listBrands(req: Request, res: Response) {
    try {
      const brands = await BeerService.getAllBrands();
      res.json(brands);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Impossible de charger les marques" });
    }
  }

  static async listTypes(req: Request, res: Response) {
    try {
      const types = await BeerService.getAllTypes();
      res.json(types);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Impossible de charger les types" });
    }
  }
}