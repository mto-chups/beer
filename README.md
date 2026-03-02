# Beer

Projet borne RFID + backend Node/TypeScript + pages web pour enregistrer des consommations de biere, afficher des scores et suivre les joueurs.

## Acces rapide

- Page principale borne: [http://localhost:3000/](http://localhost:3000/)
- Selection utilisateur: [http://localhost:3000/select.html](http://localhost:3000/select.html)
- Ancienne selection: [http://localhost:3000/selectV1.html](http://localhost:3000/selectV1.html)
- Score equipes: [http://localhost:3000/teamScore.html](http://localhost:3000/teamScore.html)
- Meilleure equipe: [http://localhost:3000/bestTeamScore.html](http://localhost:3000/bestTeamScore.html)
- Stats utilisateur: [http://localhost:3000/statsUser.html](http://localhost:3000/statsUser.html)

## Ou aller selon le besoin

### Frontend

- Page de selection actuelle: [public/view/select.html](public/view/select.html)
- Ancienne page de selection: [public/view/selectV1.html](public/view/selectV1.html)
- Page score equipes: [public/view/teamScore.html](public/view/teamScore.html)
- Page meilleure equipe: [public/view/bestTeamScore.html](public/view/bestTeamScore.html)
- Page stats utilisateur: [public/view/statsUser.html](public/view/statsUser.html)
- Page BAC: [public/view/bac.html](public/view/bac.html)

### Backend

- Point d'entree serveur: [backend/src/server.ts](backend/src/server.ts)
- Configuration Express: [backend/src/app.ts](backend/src/app.ts)
- Connexion base de donnees: [backend/src/config/db.ts](backend/src/config/db.ts)
- Routes conso / BAC: [backend/src/routes/beerBu.routes.ts](backend/src/routes/beerBu.routes.ts)
- Controleur borne / scan RFID: [backend/src/controllers/beerBu.controller.ts](backend/src/controllers/beerBu.controller.ts)
- Session utilisateur de la borne: [backend/src/routes/kioskSession.routes.ts](backend/src/routes/kioskSession.routes.ts)

### RFID / Arduino / Bridge serie

- Sketch Arduino: [arduino/arduinov1.2/arduinov1.2.ino](arduino/arduinov1.2/arduinov1.2.ino)
- Bridge serie mode consommation: [serial/serial-to-http.js](serial/serial-to-http.js)
- Bridge serie mode association RFID: [serial/serial-rfid-to-http.js](serial/serial-rfid-to-http.js)

## Demarrage

### 1. Backend

Depuis [backend/](backend/):

```bash
npm install
npm run dev
```

Le serveur demarre sur [http://localhost:3000](http://localhost:3000).

### 2. Bridge serie

Il y a maintenant deux scripts differents selon le besoin.

#### Mode consommation

Utilise ce mode pendant l'utilisation normale de la borne.
Le tag RFID scanne doit deja etre connu en base et associe a une biere.
Le script envoie le scan vers l'endpoint de consommation pour l'utilisateur courant selectionne sur la borne.

Depuis [serial/](serial/):

```bash
npm install
npm run consume
```

Ce script correspond a [serial/serial-to-http.js](serial/serial-to-http.js) et poste sur:

- `POST /api/beerbu/consume-current`

Flux:

1. Un utilisateur est selectionne sur la borne
2. Un tag RFID deja associe a une biere est scanne
3. Le bridge envoie `{ scanId, uid, scannedAt, source }` au backend
4. Le backend traite le scan de facon idempotente, journalise l'evenement et enregistre la consommation

#### Mode association RFID en rafale

Utilise ce mode pour enregistrer rapidement une pile de tags neufs sur une meme biere.
Dans ce flux, on choisit d'abord la biere dans l'interface admin, puis chaque tag scanne est associe a cette biere.

Depuis [serial/](serial/):

```bash
npm install
npm run rfid-batch
```

Ce script correspond a [serial/serial-rfid-to-http.js](serial/serial-rfid-to-http.js) et poste sur:

- `POST /api/rfid/scan-current`

Flux:

1. Ouvrir [http://localhost:3000/admin/rfid-batch.html](http://localhost:3000/admin/rfid-batch.html)
2. Choisir la biere a associer
3. Lancer `npm run rfid-batch`
4. Scanner les tags RFID les uns apres les autres
5. Chaque scan cree une association `uid -> beerId`

Variables utiles dans les scripts:

- `SERIAL_PORT=COM5`
- `SERIAL_BAUD=9600`
- `API_URL=http://localhost:3000/api/beerbu/consume-current`

### 3. Arduino

- Ouvrir [arduino/arduinov1.2/arduinov1.2.ino](arduino/arduinov1.2/arduinov1.2.ino)
- Verifier le port dans l'IDE Arduino
- Flasher la carte

## Flux de la borne

1. Ouvrir [http://localhost:3000/](http://localhost:3000/)
2. Choisir une equipe puis un joueur
3. Le frontend enregistre l'utilisateur courant via `POST /api/kiosk-session/current`
4. Le lecteur RFID lit un tag
5. Le bridge envoie le tag vers `POST /api/beerbu/consume-current`
6. Le backend enregistre la consommation puis vide l'utilisateur courant

## Flux d'association RFID

1. Ouvrir [http://localhost:3000/admin/rfid-batch.html](http://localhost:3000/admin/rfid-batch.html)
2. Selectionner la biere a associer
3. Lancer le bridge [serial/serial-rfid-to-http.js](serial/serial-rfid-to-http.js)
4. Scanner les tags RFID un par un
5. Le bridge appelle `POST /api/rfid/scan-current`
6. Le backend associe chaque `uid` a la biere courante

## API utile

- Conso pour utilisateur courant: `POST /api/beerbu/consume-current`
- Conso manuelle: `POST /api/beerbu/consume`
- Flux SSE scores temps reel: `GET /api/stats/stream`
- Lire la biere courante pour association RFID: `GET /api/rfid/current-beer`
- Definir la biere courante pour association RFID: `POST /api/rfid/current-beer`
- Effacer la biere courante pour association RFID: `DELETE /api/rfid/current-beer`
- Associer un scan RFID a la biere courante: `POST /api/rfid/scan-current`
- Utilisateur borne courant: `GET /api/kiosk-session/current`
- Definir utilisateur borne courant: `POST /api/kiosk-session/current`
- Effacer utilisateur borne courant: `DELETE /api/kiosk-session/current`
- BAC HTML: `GET /api/beerbu/bac/:userId`
- BAC data: `GET /api/beerbu/bac/data/:userId`

## Dossiers

- [backend/](backend/): API Express + logique metier + acces BDD
- [public/](public/): pages HTML/CSS/JS servies par Express
- [arduino/](arduino/): code de la carte RFID / servo
- [serial/](serial/): pont entre le port serie et l'API HTTP
- [db/](db/): fichiers lies a la base si besoin

## Fiabilite des scans

- Les scans de consommation sont dedoublonnes par `scanId` cote backend.
- Le backend cree et maintient les tables de fiabilite au demarrage si elles n'existent pas encore.
- Un journal backup append-only est ecrit dans `backend/logs/scan-events-YYYY-MM-DD.log`.
- Une migration SQL de reference est fournie dans [backend/migrations/20260302_reliable_scans.sql](backend/migrations/20260302_reliable_scans.sql).

## Si quelque chose ne marche pas

### J'ai un `409 Aucun utilisateur selectionne sur la borne`

Ca veut dire qu'aucun joueur n'a ete choisi avant le scan. Retourner sur:

- [http://localhost:3000/](http://localhost:3000/)
- ou [public/view/select.html](public/view/select.html)

### Le scan RFID ne part pas

Verifier dans cet ordre:

1. Le backend tourne bien sur [http://localhost:3000](http://localhost:3000)
2. Le bon script serie tourne:
   `serial-to-http.js` pour la consommation
   `serial-rfid-to-http.js` pour l'association de tags
3. Le bon port serie est configure dans le script choisi
4. La carte Arduino est bien flashee avec [arduino/arduinov1.2/arduinov1.2.ino](arduino/arduinov1.2/arduinov1.2.ino)

### J'ai un `409 Aucune biere selectionnee pour l association`

Ca veut dire que le mode association RFID est bien lance, mais qu'aucune biere n'a ete activee dans:

- [http://localhost:3000/admin/rfid-batch.html](http://localhost:3000/admin/rfid-batch.html)

## README secondaires

- Backend detaille: [backend/README.md](backend/README.md)
