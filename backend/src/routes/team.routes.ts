import { Router } from 'express';
import { getTeams, addTeam, updateTeam, deleteTeam, TeamController} from '../controllers/team.controller';

const router = Router();

router.get('/', getTeams);    // GET /api/teams
router.post('/', addTeam);    // POST /api/teams
// src/routes/team.routes.ts
router.patch('/:id', updateTeam);
router.delete('/:id', deleteTeam);
router.get('/equipes', TeamController.list);
export { router as teamRoutes };
export default router;
