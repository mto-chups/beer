// serial-to-http.js (CommonJS)
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');
const { randomUUID } = require('crypto');

const PORT = process.env.SERIAL_PORT || 'COM5';
const BAUD = Number(process.env.SERIAL_BAUD || 9600);
const API_URL =
  process.env.API_URL || 'http://localhost:3000/api/beerbu/consume-current';
const KIOSK_SESSION_URL =
  process.env.KIOSK_SESSION_URL || 'http://localhost:3000/api/kiosk-session/current';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 5000);
const RECONNECT_DELAY_MS = Number(process.env.RECONNECT_DELAY_MS || 2000);
const DUPLICATE_COOLDOWN_MS = Number(process.env.DUPLICATE_COOLDOWN_MS || 1500);
const RETRY_BASE_DELAY_MS = Number(process.env.RETRY_BASE_DELAY_MS || 1000);
const RETRY_MAX_DELAY_MS = Number(process.env.RETRY_MAX_DELAY_MS || 30000);
const USER_POLL_MS = Number(process.env.USER_POLL_MS || 500);
const SERVO_COMMAND = process.env.SERVO_COMMAND || 'SERVO';

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
});

let port = null;
let parser = null;
let reconnectTimer = null;
let processing = false;
let lastUid = null;
let lastUidAt = 0;
const pendingScans = [];
let retryTimer = null;
let currentObservedUserId = null;
let pollingUser = false;

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSerialPort();
  }, RECONNECT_DELAY_MS);

  console.log(`Reconnexion série dans ${RECONNECT_DELAY_MS} ms...`);
}

function sendSerialCommand(command) {
  if (!port || !port.isOpen) {
    console.warn(`Commande serie non envoyee, port ferme: ${command}`);
    return;
  }

  port.write(`${command}\n`, (err) => {
    if (err) {
      console.error(`Erreur envoi commande serie "${command}":`, err.message);
      return;
    }

    console.log(`Commande serie envoyee: ${command}`);
  });
}

async function pollCurrentUser() {
  if (pollingUser) return;

  pollingUser = true;
  try {
    const resp = await http.get(KIOSK_SESSION_URL);
    const userId = resp.data?.userId ?? null;

    if (userId && userId !== currentObservedUserId) {
      currentObservedUserId = userId;
      sendSerialCommand(SERVO_COMMAND);
      return;
    }

    if (!userId) {
      currentObservedUserId = null;
    }
  } catch (err) {
    console.error('Lecture utilisateur courant impossible:', err.message);
  } finally {
    pollingUser = false;
  }
}

function enqueueUid(uid) {
  const now = Date.now();
  if (uid === lastUid && now - lastUidAt < DUPLICATE_COOLDOWN_MS) {
    console.log(`Scan ignoré (doublon trop proche): UID=${uid}`);
    return;
  }

  lastUid = uid;
  lastUidAt = now;
  pendingScans.push({
    scanId: randomUUID(),
    uid,
    scannedAt: new Date(now).toISOString(),
    attempts: 0,
    nextRetryAt: now,
  });
  void processQueue();
}

function computeRetryDelay(attempts) {
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_DELAY_MS);
}

function scheduleQueueWake(delayMs) {
  if (retryTimer) return;

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void processQueue();
  }, delayMs);
}

async function processQueue() {
  if (processing) return;

  processing = true;
  try {
    while (pendingScans.length > 0) {
      const scan = pendingScans[0];
      if (!scan) break;

      const waitMs = scan.nextRetryAt - Date.now();
      if (waitMs > 0) {
        scheduleQueueWake(waitMs);
        break;
      }

      try {
        console.log(`Lecture UID=${scan.uid}, scanId=${scan.scanId}, envoi vers ${API_URL}...`);
        const resp = await http.post(API_URL, {
          scanId: scan.scanId,
          uid: scan.uid,
          scannedAt: scan.scannedAt,
          source: 'serial-bridge',
        });
        console.log(`Status ${resp.status}:`, resp.data);
        if (resp.data?.status === 'committed' || resp.data?.status === 'rejected_final') {
          pendingScans.shift();
          continue;
        }

        scan.attempts += 1;
        scan.nextRetryAt = Date.now() + computeRetryDelay(scan.attempts);
        pendingScans.push(pendingScans.shift());
      } catch (err) {
        if (err.response) {
          console.error(`Erreur HTTP ${err.response.status}:`, err.response.data);
          if (err.response.data?.status === 'rejected_final') {
            pendingScans.shift();
            continue;
          }
        }

        console.error('Erreur requête HTTP:', err.message);
        scan.attempts += 1;
        scan.nextRetryAt = Date.now() + computeRetryDelay(scan.attempts);
        pendingScans.push(pendingScans.shift());
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
setInterval(() => {
  void pollCurrentUser();
}, USER_POLL_MS);
