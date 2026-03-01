import { Router } from 'express';
import {addBeer, getBeers, updateBeer, deleteBeer, BeerController } from '../controllers/beer.controller';

const router = Router();

// GET (query params)
router.post('/', addBeer);
router.get('/', getBeers);
router.patch('/:id', updateBeer);
router.delete('/:id', deleteBeer);
router.get('/brands', BeerController.listBrands);
router.get('/types',  BeerController.listTypes);
export { router as beerRoutes };
export default router;