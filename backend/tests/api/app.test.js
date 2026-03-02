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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const beerServiceMocks = vitest_1.vi.hoisted(() => ({
    createBeer: vitest_1.vi.fn(),
    fetchAllBeers: vitest_1.vi.fn(),
    removeBeer: vitest_1.vi.fn(),
    updateBeerData: vitest_1.vi.fn(),
    getAllBrands: vitest_1.vi.fn(),
    getAllTypes: vitest_1.vi.fn(),
}));
const kioskSessionMocks = vitest_1.vi.hoisted(() => ({
    getCurrentUserId: vitest_1.vi.fn(),
    setCurrentUserId: vitest_1.vi.fn(),
    clearCurrentUserId: vitest_1.vi.fn(),
}));
const userServiceMocks = vitest_1.vi.hoisted(() => ({
    findUserById: vitest_1.vi.fn(),
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
vitest_1.vi.mock('../../src/services/kioskSession.service', () => ({
    getCurrentUserId: kioskSessionMocks.getCurrentUserId,
    setCurrentUserId: kioskSessionMocks.setCurrentUserId,
    clearCurrentUserId: kioskSessionMocks.clearCurrentUserId,
}));
vitest_1.vi.mock('../../src/services/user.service', () => ({
    findUserById: userServiceMocks.findUserById,
}));
const app_1 = __importDefault(require("../../src/app"));
(0, vitest_1.describe)('API routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('GET /api/beers returns the beer list', () => __awaiter(void 0, void 0, void 0, function* () {
        beerServiceMocks.fetchAllBeers.mockResolvedValue([
            { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
        ]);
        const response = yield (0, supertest_1.default)(app_1.default).get('/api/beers');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toEqual([
            { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
        ]);
    }));
    (0, vitest_1.it)('POST /api/beers rejects incomplete payloads', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield (0, supertest_1.default)(app_1.default)
            .post('/api/beers')
            .send({ brand: 'Alpha', type: 'Blonde', volume_ml: 250 });
        (0, vitest_1.expect)(response.status).toBe(400);
        (0, vitest_1.expect)(response.body).toEqual({ message: 'Tous les champs sont requis.' });
        (0, vitest_1.expect)(beerServiceMocks.createBeer).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('POST /api/kiosk-session/current returns 404 when the user does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
        userServiceMocks.findUserById.mockResolvedValue(null);
        const response = yield (0, supertest_1.default)(app_1.default)
            .post('/api/kiosk-session/current')
            .send({ userId: 999 });
        (0, vitest_1.expect)(response.status).toBe(404);
        (0, vitest_1.expect)(response.body).toEqual({ message: 'Utilisateur introuvable' });
        (0, vitest_1.expect)(kioskSessionMocks.setCurrentUserId).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('POST /api/kiosk-session/current stores the selected user', () => __awaiter(void 0, void 0, void 0, function* () {
        userServiceMocks.findUserById.mockResolvedValue({ id: 7, firstname: 'Ada' });
        const response = yield (0, supertest_1.default)(app_1.default)
            .post('/api/kiosk-session/current')
            .send({ userId: 7 });
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toEqual({ message: 'Utilisateur courant défini', userId: 7 });
        (0, vitest_1.expect)(kioskSessionMocks.setCurrentUserId).toHaveBeenCalledWith(7);
    }));
    (0, vitest_1.it)('DELETE /api/kiosk-session/current clears the selected user', () => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield (0, supertest_1.default)(app_1.default).delete('/api/kiosk-session/current');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body).toEqual({ message: 'Utilisateur courant effacé' });
        (0, vitest_1.expect)(kioskSessionMocks.clearCurrentUserId).toHaveBeenCalledTimes(1);
    }));
});
