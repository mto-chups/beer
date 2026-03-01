import { Request, Response } from 'express';
import { fetchAllTeams, createTeam, updateTeamName, removeTeam, TeamService  } from '../services/team.service';

export const getTeams = async (_: Request, res: Response) => {
  try {
    const teams = await fetchAllTeams();
    res.json(teams);
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const addTeam = async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Nom d'équipe requis" });
  }
  try {
    const id = await createTeam({ name });
    res.status(201).json({ message: "Équipe créée", id });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const updateTeam = async (req: Request, res: Response) => {
  const { name } = req.body;
  const id = Number(req.params.id);
  if (!name) return res.status(400).json({ message: "Nom requis" });
  try {
    await updateTeamName(id, name);
    res.json({ message: "Équipe modifiée" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const deleteTeam = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  try {
    await removeTeam(id);
    res.json({ message: "Équipe supprimée" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export class TeamController {
  static async list(req: Request, res: Response) {
    try {
      const teams = await TeamService.getAllTeamsWithMembers();
      res.json(teams);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Impossible de charger les équipes" });
    }
  }
}