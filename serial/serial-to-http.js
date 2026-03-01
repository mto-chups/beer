// serial-to-http.js (CommonJS)
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');

const PORT = 'COM5';          // adapter selon votre OS (/dev/ttyACM0, /dev/ttyUSB0…)
const BAUD = 9600;
const API_URL = 'http://localhost:3000/api/beerbu/consume-current';

const port = new SerialPort({ path: PORT, baudRate: BAUD });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

port.on('open', () => console.log(`Serial ouvert sur ${PORT} @ ${BAUD}`));

parser.on('data', async (line) => {
  try {
    // Exemple de line: {"uid":"E659A700"}
    const { uid } = JSON.parse(line);
    console.log(`Lecture UID=${uid}, envoi vers ${API_URL}...`);
    const resp = await axios.post(API_URL, { uid });
    console.log(`Status ${resp.status}:`, resp.data);
  } catch (err) {
    if (err.response) {
      console.error(`Erreur HTTP ${err.response.status}:`, err.response.data);
      return;
    }
    console.error('Erreur traitement ligne série ou requête HTTP', err.message);
  }
});
