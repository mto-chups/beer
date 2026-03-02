// serial-to-http.js (CommonJS)
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');

const PORT = process.env.SERIAL_PORT || 'COM5';
const BAUD = Number(process.env.SERIAL_BAUD || 9600);
const API_URL =
  process.env.API_URL || 'http://localhost:3000/api/beerbu/consume-current';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 5000);
const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 2000);
const DUPLICATE_COOLDOWN_MS = Number(process.env.DUPLICATE_COOLDOWN_MS || 1500);

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
});

let port = null;
let parser = null;
let reconnectTimer = null;
let processing = false;
let lastUid = null;
let lastUidAt = 0;
const pendingUids = [];

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSerialPort();
  }, RECONNECT_DELAY_MS);

  console.log(`Reconnexion série dans ${RECONNECT_DELAY_MS} ms...`);
}

function enqueueUid(uid) {
  const now = Date.now();
  if (uid === lastUid && now - lastUidAt < DUPLICATE_COOLDOWN_MS) {
    console.log(`Scan ignoré (doublon trop proche): UID=${uid}`);
    return;
  }

  lastUid = uid;
  lastUidAt = now;
  pendingUids.push(uid);
  void processQueue();
}

async function processQueue() {
  if (processing) return;

  processing = true;
  try {
    while (pendingUids.length > 0) {
      const uid = pendingUids.shift();
      if (!uid) continue;

      try {
        console.log(`Lecture UID=${uid}, envoi vers ${API_URL}...`);
        const resp = await http.post(API_URL, { uid });
        console.log(`Status ${resp.status}:`, resp.data);
      } catch (err) {
        if (err.response) {
          console.error(`Erreur HTTP ${err.response.status}:`, err.response.data);
          continue;
        }

        console.error('Erreur requête HTTP:', err.message);
      }
    }
  } finally {
    processing = false;
  }
}

function handleLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return;

  try {
    const payload = JSON.parse(line);
    if (!payload.uid || typeof payload.uid !== 'string') {
      console.warn('Ligne série ignorée (uid absent):', line);
      return;
    }

    enqueueUid(payload.uid.trim().toUpperCase());
  } catch (err) {
    console.warn('Ligne série invalide ignorée:', line, '-', err.message);
  }
}

function attachPortHandlers(serialPort) {
  serialPort.on('open', () => {
    console.log(`Serial ouvert sur ${PORT} @ ${BAUD}`);
  });

  serialPort.on('error', (err) => {
    console.error('Erreur port série:', err.message);
  });

  serialPort.on('close', () => {
    console.error('Port série fermé');
    scheduleReconnect();
  });

  parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
  parser.on('data', handleLine);
  parser.on('error', (err) => {
    console.error('Erreur parser série:', err.message);
  });
}

function openSerialPort() {
  try {
    port = new SerialPort({
      path: PORT,
      baudRate: BAUD,
      autoOpen: false,
    });

    attachPortHandlers(port);

    port.open((err) => {
      if (!err) return;
      console.error(`Impossible d'ouvrir ${PORT}:`, err.message);
      scheduleReconnect();
    });
  } catch (err) {
    console.error('Initialisation série impossible:', err.message);
    scheduleReconnect();
  }
}

process.on('unhandledRejection', (err) => {
  console.error('Promesse non gérée:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Exception non gérée:', err);
});

openSerialPort();
