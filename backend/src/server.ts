// src/server.ts
import dotenv from 'dotenv';
import app from './app';
  import listEndpoints from 'express-list-endpoints';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  // console.log('--- Routes disponibles ---');
  // console.table(listEndpoints(app));
});
