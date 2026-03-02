import { Router } from 'express';
import { attachScoreStreamCloseHandler, streamScores } from '../controllers/scoreStream.controller';

const router = Router();

router.get('/', (req, res) => {
  streamScores(req, res);
  attachScoreStreamCloseHandler(req, res);
});

export default router;
