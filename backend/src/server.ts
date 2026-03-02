// src/server.ts
import dotenv from 'dotenv';
import app from './app';
import { testDbConnection } from './config/db';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
  await testDbConnection();
  console.log('Connexion a la base de donnees validee');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur demarre sur http://localhost:${PORT}`);
    // console.log('--- Routes disponibles ---');
    // console.table(listEndpoints(app));
  });
}

startServer().catch((error: unknown) => {
  console.error('Echec de connexion a la base de donnees, arret du serveur.');
  console.error(error);
  process.exit(1);
});
