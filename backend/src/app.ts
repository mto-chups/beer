// src/app.ts
import express from 'express';
import path from 'path';
import manualBonusRoutes from './routes/manualBonus.routes';
import beerBuRoutes from './routes/beerBu.routes';
import rfidTagRoutes from './routes/rfidTag.routes';
import userRoutes from './routes/user.routes';
import teamRoutes from './routes/team.routes';
import beerRoutes from './routes/beer.routes';
import scanCallbackRoutes from './routes/scanCallback.routes';
import beerEventsRoutes from './routes/beerEvents.routes';
import kioskSessionRoutes from './routes/kioskSession.routes';
import { statsRoutes } from './routes/stats.routes';

const app = express();

app.use(express.json());

// Routes API
app.use('/api/beerbu', beerBuRoutes);
app.use('/api/rfid', rfidTagRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/beers', beerRoutes);
app.use('/api/manual_bonus', manualBonusRoutes)
app.use('/api/scan_callback', scanCallbackRoutes);
app.use('/api/beer_events', beerEventsRoutes);
app.use('/api/kiosk-session', kioskSessionRoutes);
app.use('/api/stats', statsRoutes);

// Fichiers statiques
app.use('/admin', express.static(path.join(__dirname, '../../public/admin')));
app.use('/', express.static(path.join(__dirname, '../../public/view')));
app.use('/assets', express.static(path.join(__dirname, '../../public/assets')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/view/select.html'));
});

export default app;
