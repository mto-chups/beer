import express from 'express';
import { StatsController } from '../controllers/stats.controller';

const router = express.Router();

router.get('/equipe/:id', StatsController.getPoints);
router.get('/utilisateurs', StatsController.getPointsUtilisateurs);
router.get('/equipes/scores', StatsController.getTeamRanking);
router.get('/fun', StatsController.getFunStats);
router.get('/fun/live', StatsController.getFunLiveStats);
router.get('/fun/medical', StatsController.getFunMedicalStats);
router.get('/fun/social', StatsController.getFunSocialStats);
router.get('/stream', StatsController.stream);

export { router as statsRoutes };
