import { Router } from 'express';
import { createEvent, listBeerEvents, deleteBeerEvent, updateBeerEvent, getBeerEvent} from '../controllers/beerEvents.controller';

const router = Router();

// POST /api/beer_events
router.post('/', createEvent);
router.get('/', listBeerEvents);  // GET  /api/beer_events
router.delete('/:id', deleteBeerEvent);
router.patch('/:id', updateBeerEvent);
router.get('/:id', getBeerEvent);


export default router;
