# Backend `beer`

## Lancement

Depuis [`backend/`](/c:/Users/match/Documents/Code/beer/backend):

```bash
npm install
npm run build
npm start
```

Pour le développement:

```bash
npm run dev
```

## Variables d'environnement

Le backend lit [`backend/.env`](/c:/Users/match/Documents/Code/beer/backend/.env):

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=beer
PORT=3000
```

## Flux borne

1. Ouvrir [`public/view/select.html`](/c:/Users/match/Documents/Code/beer/public/view/select.html)
2. Choisir une équipe puis un joueur
3. Le frontend enregistre l'utilisateur courant via `/api/kiosk-session/current`
4. Lancer le bridge série dans [`serial/serial-to-http.js`](/c:/Users/match/Documents/Code/beer/serial/serial-to-http.js)
5. Un scan RFID est posté sur `/api/beerbu/consume-current`

## Notes

- Le backend compile maintenant dans `dist/`
- Le bridge série doit être configuré avec le bon port `COM`
