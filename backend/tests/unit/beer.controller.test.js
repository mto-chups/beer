"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const beerServiceMocks = vitest_1.vi.hoisted(() => ({
    createBeer: vitest_1.vi.fn(),
    fetchAllBeers: vitest_1.vi.fn(),
    removeBeer: vitest_1.vi.fn(),
    updateBeerData: vitest_1.vi.fn(),
    getAllBrands: vitest_1.vi.fn(),
    getAllTypes: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../../src/services/beer.service', () => ({
    createBeer: beerServiceMocks.createBeer,
    fetchAllBeers: beerServiceMocks.fetchAllBeers,
    removeBeer: beerServiceMocks.removeBeer,
    updateBeerData: beerServiceMocks.updateBeerData,
    BeerService: {
        getAllBrands: beerServiceMocks.getAllBrands,
        getAllTypes: beerServiceMocks.getAllTypes,
    },
}));
const beer_controller_1 = require("../../src/controllers/beer.controller");
function createResponse() {
    const res = {};
    res.status = vitest_1.vi.fn().mockReturnValue(res);
    res.json = vitest_1.vi.fn().mockReturnValue(res);
    return res;
}
(0, vitest_1.describe)('beer.controller', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('rejects beer creation when a required field is missing', () => __awaiter(void 0, void 0, void 0, function* () {
        const req = {
            body: {
                brand: 'Brasserie',
                type: 'IPA',
                volume_ml: 330,
            },
        };
        const res = createResponse();
        yield (0, beer_controller_1.addBeer)(req, res);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(400);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ message: 'Tous les champs sont requis.' });
        (0, vitest_1.expect)(beerServiceMocks.createBeer).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('rounds numeric fields before creating a beer', () => __awaiter(void 0, void 0, void 0, function* () {
        beerServiceMocks.createBeer.mockResolvedValue(12);
        const req = {
            body: {
                brand: 'Brasserie',
                type: 'IPA',
                volume_ml: 333.335,
                alcohol_degree: 6.666,
            },
        };
        const res = createResponse();
        yield (0, beer_controller_1.addBeer)(req, res);
        (0, vitest_1.expect)(beerServiceMocks.createBeer).toHaveBeenCalledWith({
            brand: 'Brasserie',
            type: 'IPA',
            volume_ml: 333.34,
            alcohol_degree: 6.67,
        });
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(201);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ message: 'Bière ajoutée', id: 12 });
    }));
    (0, vitest_1.it)('returns beers fetched by the service', () => __awaiter(void 0, void 0, void 0, function* () {
        beerServiceMocks.fetchAllBeers.mockResolvedValue([
            { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
        ]);
        const res = createResponse();
        yield (0, beer_controller_1.getBeers)({}, res);
        (0, vitest_1.expect)(beerServiceMocks.fetchAllBeers).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith([
            { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
        ]);
    }));
    (0, vitest_1.it)('rounds numeric fields before updating a beer', () => __awaiter(void 0, void 0, void 0, function* () {
        const req = {
            params: { id: '42' },
            body: {
                brand: 'Brasserie',
                type: 'Triple',
                volume_ml: 499.994,
                alcohol_degree: 8.995,
            },
        };
        const res = createResponse();
        yield (0, beer_controller_1.updateBeer)(req, res);
        (0, vitest_1.expect)(beerServiceMocks.updateBeerData).toHaveBeenCalledWith(42, 'Brasserie', 'Triple', 499.99, 8.99);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ message: 'Bière modifiée' });
    }));
});
