import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const beerServiceMocks = vi.hoisted(() => ({
  createBeer: vi.fn(),
  fetchAllBeers: vi.fn(),
  removeBeer: vi.fn(),
  updateBeerData: vi.fn(),
  getAllBrands: vi.fn(),
  getAllTypes: vi.fn(),
}));

vi.mock('../../src/services/beer.service', () => ({
  createBeer: beerServiceMocks.createBeer,
  fetchAllBeers: beerServiceMocks.fetchAllBeers,
  removeBeer: beerServiceMocks.removeBeer,
  updateBeerData: beerServiceMocks.updateBeerData,
  BeerService: {
    getAllBrands: beerServiceMocks.getAllBrands,
    getAllTypes: beerServiceMocks.getAllTypes,
  },
}));

import { addBeer, getBeers, updateBeer } from '../../src/controllers/beer.controller';

function createResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('beer.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects beer creation when a required field is missing', async () => {
    const req = {
      body: {
        brand: 'Brasserie',
        type: 'IPA',
        volume_ml: 330,
      },
    } as Request;
    const res = createResponse();

    await addBeer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Tous les champs sont requis.' });
    expect(beerServiceMocks.createBeer).not.toHaveBeenCalled();
  });

  it('rounds numeric fields before creating a beer', async () => {
    beerServiceMocks.createBeer.mockResolvedValue(12);
    const req = {
      body: {
        brand: 'Brasserie',
        type: 'IPA',
        volume_ml: 333.335,
        alcohol_degree: 6.666,
      },
    } as Request;
    const res = createResponse();

    await addBeer(req, res);

    expect(beerServiceMocks.createBeer).toHaveBeenCalledWith({
      brand: 'Brasserie',
      type: 'IPA',
      volume_ml: 333.34,
      alcohol_degree: 6.67,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Bière ajoutée', id: 12 });
  });

  it('returns beers fetched by the service', async () => {
    beerServiceMocks.fetchAllBeers.mockResolvedValue([
      { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
    ]);
    const res = createResponse();

    await getBeers({} as Request, res);

    expect(beerServiceMocks.fetchAllBeers).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith([
      { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
    ]);
  });

  it('rounds numeric fields before updating a beer', async () => {
    const req = {
      params: { id: '42' },
      body: {
        brand: 'Brasserie',
        type: 'Triple',
        volume_ml: 499.994,
        alcohol_degree: 8.995,
      },
    } as unknown as Request;
    const res = createResponse();

    await updateBeer(req, res);

    expect(beerServiceMocks.updateBeerData).toHaveBeenCalledWith(42, 'Brasserie', 'Triple', 499.99, 8.99);
    expect(res.json).toHaveBeenCalledWith({ message: 'Bière modifiée' });
  });
});
