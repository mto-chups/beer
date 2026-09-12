import { Router } from 'express';
import {
  consumeBeer,
  consumeBeerForCurrentUser,
  consumeSelectedBeer,
  showBacPage,
  getBacData,
} from '../controllers/beerBu.controller';


const router = Router();

// POST (body)
router.post('/consume', consumeBeer);
router.post('/consume-current', consumeBeerForCurrentUser);
router.post('/consume-selected', consumeSelectedBeer);
router.get('/bac/:userId',      showBacPage);
router.get('/bac/data/:userId', getBacData);
export default router;
