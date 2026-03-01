// serial-to-http.js (CommonJS)
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');
const FIXED_USER_ID = 1; // provisoire: à remplacer par le vrai user choisi sur ce poste


const PORT = 'COM5';          // adapter selon votre OS (/dev/ttyACM0, /dev/ttyUSB0…)
const BAUD = 9600;
const API_URL = 'http://localhost:3000/api/beerbu/consume';

const port = new SerialPort({ path: PORT, baudRate: BAUD });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

port.on('open', () => console.log(`Serial ouvert sur ${PORT} @ ${BAUD}`));

parser.on('data', async (line) => {
  try {
    // Exemple de line: {"uid":"E659A700"}
    const { uid } = JSON.parse(line);
    console.log(`Lecture UID=${uid}, envoi HTTP…`);
    const resp = await axios.post(API_URL, { uid, userId: FIXED_USER_ID });
    console.log(`Status ${resp.status}:`, resp.data);
  } catch (err) {
    console.error('Erreur traitement ligne série ou requête HTTP', err.message);
  }
});
