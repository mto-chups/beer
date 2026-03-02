const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');

const PORT = 'COM5';
const BAUD = 9600;
const API_URL = 'http://localhost:3000/api/rfid/scan-current';

const port = new SerialPort({ path: PORT, baudRate: BAUD });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

port.on('open', () => {
  console.log(`Serial ouvert sur ${PORT} @ ${BAUD}`);
  console.log(`Envoi des scans vers ${API_URL}`);
});

port.on('error', (error) => {
  console.error('Erreur port serie:', error.message);
});

parser.on('data', async (line) => {
  try {
    const { uid } = JSON.parse(line);
    if (!uid) {
      console.error('Trame sans uid:', line);
      return;
    }

    console.log(`Scan UID=${uid}`);
    const response = await axios.post(API_URL, { uid });
    console.log(`OK ${response.status}: ${response.data.message}`);
  } catch (error) {
    if (error.response) {
      console.error(`Erreur HTTP ${error.response.status}:`, error.response.data);
      return;
    }

    console.error('Erreur traitement ligne serie ou requete HTTP', error.message);
  }
});
