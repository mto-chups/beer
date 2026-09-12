import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const beerServiceMocks = vi.hoisted(() => ({
  createBeer: vi.fn(),
  fetchAllBeers: vi.fn(),
  removeBeer: vi.fn(),
  updateBeerData: vi.fn(),
  getAllBrands: vi.fn(),
  getAllTypes: vi.fn(),
}));

const kioskSessionMocks = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  getCurrentKioskState: vi.fn(),
  setCurrentUserId: vi.fn(),
  clearCurrentUserId: vi.fn(),
  finishCurrentUser: vi.fn(),
  clearMotorAction: vi.fn(),
}));

const beerBuServiceMocks = vi.hoisted(() => ({
  consumeBeerScan: vi.fn(),
  getBacDetails: vi.fn(),
  recordBeerConsumed: vi.fn(),
  recordSelectedBeerConsumed: vi.fn(),
  rejectScan: vi.fn(),
}));

const userServiceMocks = vi.hoisted(() => ({
  findUserById: vi.fn(),
}));

const statsServiceMocks = vi.hoisted(() => ({
  getPointsByEquipeId: vi.fn(),
  getPointsParUtilisateur: vi.fn(),
  getAllTeamScores: vi.fn(),
  getFunStats: vi.fn(),
  getFunLiveStats: vi.fn(),
  getFunMedicalStats: vi.fn(),
  getFunSocialStats: vi.fn(),
  getScoreStreamPayload: vi.fn(),
  getTeamIdForUser: vi.fn(),
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

vi.mock('../../src/services/kioskSession.service', () => ({
  getCurrentUserId: kioskSessionMocks.getCurrentUserId,
  getCurrentKioskState: kioskSessionMocks.getCurrentKioskState,
  setCurrentUserId: kioskSessionMocks.setCurrentUserId,
  clearCurrentUserId: kioskSessionMocks.clearCurrentUserId,
  finishCurrentUser: kioskSessionMocks.finishCurrentUser,
  clearMotorAction: kioskSessionMocks.clearMotorAction,
}));

vi.mock('../../src/services/beerBu.service', () => beerBuServiceMocks);

vi.mock('../../src/services/user.service', () => ({
  findUserById: userServiceMocks.findUserById,
}));

vi.mock('../../src/services/stats.service', () => ({
  StatsService: {
    getPointsByEquipeId: statsServiceMocks.getPointsByEquipeId,
    getPointsParUtilisateur: statsServiceMocks.getPointsParUtilisateur,
    getAllTeamScores: statsServiceMocks.getAllTeamScores,
    getFunStats: statsServiceMocks.getFunStats,
    getFunLiveStats: statsServiceMocks.getFunLiveStats,
    getFunMedicalStats: statsServiceMocks.getFunMedicalStats,
    getFunSocialStats: statsServiceMocks.getFunSocialStats,
    getScoreStreamPayload: statsServiceMocks.getScoreStreamPayload,
    getTeamIdForUser: statsServiceMocks.getTeamIdForUser,
  },
}));

import app from '../../src/app';

describe('API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/beers returns the beer list', async () => {
    beerServiceMocks.fetchAllBeers.mockResolvedValue([
      { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
    ]);

    const response = await request(app).get('/api/beers');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 1, brand: 'Alpha', type: 'Blonde', volume_ml: 250, alcohol_degree: 5 },
    ]);
  });

  it('POST /api/beers rejects incomplete payloads', async () => {
    const response = await request(app)
      .post('/api/beers')
      .send({ brand: 'Alpha', type: 'Blonde', volume_ml: 250 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Tous les champs sont requis.' });
    expect(beerServiceMocks.createBeer).not.toHaveBeenCalled();
  });

  it('POST /api/kiosk-session/current returns 404 when the user does not exist', async () => {
    userServiceMocks.findUserById.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/kiosk-session/current')
      .send({ userId: 999 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Utilisateur introuvable' });
    expect(kioskSessionMocks.setCurrentUserId).not.toHaveBeenCalled();
  });

  it('POST /api/kiosk-session/current stores the selected user', async () => {
    userServiceMocks.findUserById.mockResolvedValue({ id: 7, firstname: 'Ada' });

    const response = await request(app)
      .post('/api/kiosk-session/current')
      .send({ userId: 7 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Utilisateur courant défini', userId: 7 });
    expect(kioskSessionMocks.setCurrentUserId).toHaveBeenCalledWith(7);
  });

  it('DELETE /api/kiosk-session/current clears the selected user', async () => {
    const response = await request(app).delete('/api/kiosk-session/current');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Utilisateur courant effacé', motorAction: null });
    expect(kioskSessionMocks.clearCurrentUserId).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/kiosk-session/current stores the completed motor action', async () => {
    const response = await request(app)
      .delete('/api/kiosk-session/current')
      .query({ motorAction: 'complete' });

    expect(response.status).toBe(200);
    expect(response.body.motorAction).toBe('complete');
    expect(kioskSessionMocks.finishCurrentUser).toHaveBeenCalledWith('complete');
    expect(kioskSessionMocks.clearCurrentUserId).not.toHaveBeenCalled();
  });

  it('POST /api/beerbu/consume-selected records the selected beer', async () => {
    beerBuServiceMocks.recordSelectedBeerConsumed.mockResolvedValue({ id: 42, score: 3 });
    statsServiceMocks.getScoreStreamPayload.mockResolvedValue({ eventId: 'manual-beer-42' });

    const response = await request(app)
      .post('/api/beerbu/consume-selected')
      .send({ userId: 7, beerId: 12 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 42, score: 3, userId: 7, beerId: 12 });
    expect(beerBuServiceMocks.recordSelectedBeerConsumed).toHaveBeenCalledWith({
      userId: 7,
      beerId: 12,
    });
    expect(kioskSessionMocks.clearCurrentUserId).not.toHaveBeenCalled();
    expect(statsServiceMocks.getScoreStreamPayload).toHaveBeenCalledWith('manual-beer-42', 7);
  });

  it('GET /api/stats/fun returns the humorous dashboard payload', async () => {
    statsServiceMocks.getFunStats.mockResolvedValue({
      generatedAt: '2026-03-02T12:00:00.000Z',
      liveWindowMinutes: 60,
      sprintWindowMinutes: 30,
      liveRace: [
        {
          userId: 4,
          firstName: 'Max',
          lastName: 'Mousse',
          teamName: 'Houblon Racing',
          liters: 1.5,
          litersPerHour: 1.5,
          drinks: 3,
          lastDrinkAt: '2026-03-02T11:55:00.000Z',
        },
      ],
      bestSprints: [],
      biggestTanks: [],
    });

    const response = await request(app).get('/api/stats/fun');

    expect(response.status).toBe(200);
    expect(response.body.liveWindowMinutes).toBe(60);
    expect(response.body.liveRace[0]).toMatchObject({
      userId: 4,
      firstName: 'Max',
      litersPerHour: 1.5,
    });
    expect(statsServiceMocks.getFunStats).toHaveBeenCalledTimes(1);
  });

  it('GET /api/stats/fun/live returns the live fun payload', async () => {
    statsServiceMocks.getFunLiveStats.mockResolvedValue({
      generatedAt: '2026-03-02T12:00:00.000Z',
      windows: { shortMinutes: 30, liveMinutes: 60, marketMinutes: 90 },
      liveRace: [],
      teamWeather: [],
      marketBoard: [],
      radarBoard: [],
      horseRace: [],
      tourBoard: [],
    });

    const response = await request(app).get('/api/stats/fun/live');

    expect(response.status).toBe(200);
    expect(response.body.windows.liveMinutes).toBe(60);
    expect(statsServiceMocks.getFunLiveStats).toHaveBeenCalledTimes(1);
  });

  it('GET /api/stats/fun/medical returns the medical fun payload', async () => {
    statsServiceMocks.getFunMedicalStats.mockResolvedValue({
      generatedAt: '2026-03-02T12:00:00.000Z',
      spotlightUsers: [],
    });

    const response = await request(app).get('/api/stats/fun/medical');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      generatedAt: '2026-03-02T12:00:00.000Z',
      spotlightUsers: [],
    });
    expect(statsServiceMocks.getFunMedicalStats).toHaveBeenCalledWith(undefined);
  });

  it('GET /api/stats/fun/medical forwards a valid userId', async () => {
    statsServiceMocks.getFunMedicalStats.mockResolvedValue({
      generatedAt: '2026-03-02T12:00:00.000Z',
      spotlightUsers: [{ userId: 12 }],
    });

    const response = await request(app).get('/api/stats/fun/medical?userId=12');

    expect(response.status).toBe(200);
    expect(response.body.spotlightUsers[0].userId).toBe(12);
    expect(statsServiceMocks.getFunMedicalStats).toHaveBeenCalledWith(12);
  });

  it('GET /api/stats/fun/social returns the social fun payload', async () => {
    statsServiceMocks.getFunSocialStats.mockResolvedValue({
      generatedAt: '2026-03-02T12:00:00.000Z',
      profiles: [],
      datingCards: [],
    });

    const response = await request(app).get('/api/stats/fun/social');

    expect(response.status).toBe(200);
    expect(response.body.datingCards).toEqual([]);
    expect(statsServiceMocks.getFunSocialStats).toHaveBeenCalledTimes(1);
  });
});
