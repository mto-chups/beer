// controllers/stats.controller.ts
import { Request, Response } from 'express';
import { StatsService } from '../services/stats.service';
import { initScoreStream, removeScoreStreamClient } from '../services/scoreStream.service';

export class StatsController {
  static async getPoints(req: Request, res: Response) {
    const equipeId = Number(req.params.id);
    if (isNaN(equipeId)) {
      return res.status(400).json({ error: "ID équipe invalide" });
    }

    const raw   = req.query;
    const from  = raw.from  as string | undefined;
    const to    = raw.to    as string | undefined;
    const brand = (raw.brand ?? raw.Brand) as string | undefined;
    const type  = (raw.type  ?? raw.Type)  as string | undefined;

    try {
      const points = await StatsService.getPointsByEquipeId(
        equipeId, from, to, brand, type
      );
      res.json({ equipeId, points });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur interne serveur" });
    }
  }

  static async getPointsUtilisateurs(req: Request, res: Response) {
    const raw    = req.query;
    const equipe = raw.equipe as string | undefined;
    const from   = raw.from   as string | undefined;
    const to     = raw.to     as string | undefined;
    const brand  = (raw.brand ?? raw.Brand) as string | undefined;
    const type   = (raw.type  ?? raw.Type ) as string | undefined;

    const equipeId = equipe !== undefined ? Number(equipe) : undefined;
    if (equipe !== undefined && isNaN(equipeId!)) {
      return res.status(400).json({ error: "Paramètre `equipe` invalide" });
    }

    try {
      const stats = await StatsService.getPointsParUtilisateur(
        equipeId, from, to, brand, type
      );
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur interne serveur" });
    }
  }

  // controllers/stats.controller.ts
  static async getTeamRanking(_: Request, res: Response) {
    try {
      const ranking = await StatsService.getAllTeamScores();
      res.json(ranking);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Impossible de récupérer le classement équipes" });
    }
  }

  static async getFunStats(_: Request, res: Response) {
    try {
      const stats = await StatsService.getFunStats();
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Impossible de recuperer les stats fun' });
    }
  }

  static async getFunLiveStats(_: Request, res: Response) {
    try {
      const stats = await StatsService.getFunLiveStats();
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Impossible de recuperer les stats live fun' });
    }
  }

  static async getFunMedicalStats(req: Request, res: Response) {
    const rawUserId = req.query.userId as string | undefined;
    let userId: number | undefined;
    if (rawUserId !== undefined) {
      const parsedUserId = Number(rawUserId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        return res.status(400).json({ error: 'Parametre userId invalide' });
      }
      userId = parsedUserId;
    }

    try {
      const stats = await StatsService.getFunMedicalStats(userId);
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Impossible de recuperer les stats medicales fun' });
    }
  }

  static async getFunSocialStats(_: Request, res: Response) {
    try {
      const stats = await StatsService.getFunSocialStats();
      res.json(stats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Impossible de recuperer les stats sociales fun' });
    }
  }

  static stream(req: Request, res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    initScoreStream(res);
    req.on('close', () => {
      removeScoreStreamClient(res);
    });
  }


}
