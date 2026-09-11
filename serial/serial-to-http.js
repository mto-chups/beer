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
const SERVO_COMMAND = 'S';
const CLOSE_COMMAND = 'C';
const PING_COMMAND = 'P';
const SERIAL_READY_DELAY_MS = Number(process.env.SERIAL_READY_DELAY_MS || 3000);
const SERIAL_PING_RETRY_MS = 1000;
const COMMAND_ACK_TIMEOUT_MS = 1200;
const COMMAND_MAX_ATTEMPTS = 2;
const BRIDGE_PROTOCOL = 'motor-byte-v1';
const KNOWN_ARDUINO_EVENTS = [
  'firmware_motor_byte_v1',
  'arduino_ready',
  'pong',
  'serial_data_received',
  'servo_received',
  'motor1_opened',
  'servo_ignored_cycle_active',
  'rfid_cycle_started',
  'motor1_limit_not_detected',
  'motor2_limit_not_detected',
  'motor_cycle_complete',
  'close_received',
  'motor1_closed_after_cancel',
  'close_ignored_no_active_cycle',
  'serial_command_unknown',
];

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
let serialReady = false;
let serialReadyTimer = null;
let pendingServoUserId = null;
let lastServoCommandAt = 0;
const SERVO_RETRY_MS = 1500;
let serialLinkValidated = false;
let serialPingTimer = null;
let serialPingAttempts = 0;
let waitingForSerialLinkLogged = false;
let firmwareDetected = false;
let arduinoBootCount = 0;
let motor1AwaitingRfid = false;
let lastCloseCommandAt = 0;
const commandAckTimers = new Map();

function clearCommandAck(command) {
  const timer = commandAckTimers.get(command);
  if (timer) {
    clearTimeout(timer);
    commandAckTimers.delete(command);
  }
}

function armCommandAck(command, attempt) {
  if (command !== SERVO_COMMAND && command !== CLOSE_COMMAND) return;

  clearCommandAck(command);
  const timer = setTimeout(async () => {
    commandAckTimers.delete(command);

    if (attempt >= COMMAND_MAX_ATTEMPTS) {
      console.error(
        `Arduino ne confirme pas la commande ${command} apres ${attempt} essais. ` +
          'Televerse arduino/arduinov1.2/arduinov1.2.ino puis relance le bridge.'
      );
      return;
    }

    console.warn(`Aucun accuse Arduino pour ${command}, nouvel essai unique...`);
    await sendSerialCommand(command, attempt + 1);
  }, COMMAND_ACK_TIMEOUT_MS);

  commandAckTimers.set(command, timer);
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSerialPort();
  }, RECONNECT_DELAY_MS);

  console.log(`Reconnexion série dans ${RECONNECT_DELAY_MS} ms...`);
}

function setSerialReady(source) {
  if (serialReadyTimer) {
    clearTimeout(serialReadyTimer);
    serialReadyTimer = null;
  }

  if (serialReady) return;
  serialReady = true;
  serialLinkValidated = false;
  serialPingAttempts = 0;
  currentObservedUserId = null;
  pendingServoUserId = null;
  lastServoCommandAt = 0;
  console.log(`Arduino pret (${source})`);
  scheduleSerialPing(100);
}

function scheduleSerialPing(delayMs = SERIAL_PING_RETRY_MS) {
  if (serialPingTimer || !serialReady || serialLinkValidated) return;

  serialPingTimer = setTimeout(async () => {
    serialPingTimer = null;
    if (!serialReady || serialLinkValidated) return;

    const sent = await sendSerialCommand(PING_COMMAND);
    if (sent) {
      serialPingAttempts += 1;
      if (serialPingAttempts === 3) {
        console.error(
          'Aucun PONG apres 3 essais: verifie le firmware Arduino et libere les broches D0/RX et D1/TX.'
        );
      }
    }
    scheduleSerialPing();
  }, delayMs);
}

function handleArduinoEvent(event) {
  if (
    event === 'serial_data_received' ||
    event === 'servo_received' ||
    event === 'motor1_opened' ||
    event === 'servo_ignored_cycle_active'
  ) {
    clearCommandAck(SERVO_COMMAND);
  }

  if (
    event === 'close_received' ||
    event === 'motor1_closed_after_cancel' ||
    event === 'close_ignored_no_active_cycle'
  ) {
    clearCommandAck(CLOSE_COMMAND);
  }

  if (event === 'arduino_ready') {
    if (!serialReady) {
      console.log('Arduino: arduino_ready');
    }
    setSerialReady('message de la carte');
    return;
  }

  if (event === 'firmware_motor_byte_v1') {
    arduinoBootCount += 1;
    if (!firmwareDetected) {
      firmwareDetected = true;
      console.log('Firmware Arduino compatible detecte.');
    } else if (arduinoBootCount === 2) {
      console.error(
        'Arduino redemarre plusieurs fois: verifie son alimentation et separe l alimentation des moteurs.'
      );
    }
    return;
  }

  if (event === 'pong') {
    serialLinkValidated = true;
    serialPingAttempts = 0;
    waitingForSerialLinkLogged = false;
    if (serialPingTimer) {
      clearTimeout(serialPingTimer);
      serialPingTimer = null;
    }
    console.log('Liaison serie PC <-> Arduino validee.');
    return;
  }

  console.log(`Arduino: ${event}`);

  if (event === 'servo_received') {
    motor1AwaitingRfid = true;
    if (pendingServoUserId !== null) {
      currentObservedUserId = pendingServoUserId;
      pendingServoUserId = null;
      lastServoCommandAt = 0;
    }
    return;
  }

  if (event === 'rfid_cycle_started') {
    motor1AwaitingRfid = false;
    lastCloseCommandAt = 0;
    return;
  }

  if (
    event === 'close_received' ||
    event === 'motor1_closed_after_cancel' ||
    event === 'close_ignored_no_active_cycle' ||
    event === 'motor_cycle_complete' ||
    event === 'motor1_limit_not_detected'
  ) {
    motor1AwaitingRfid = false;
    lastCloseCommandAt = 0;
  }
}

function sendSerialCommand(command, attempt = 1) {
  return new Promise((resolve) => {
    if (!port || !port.isOpen || !serialReady) {
      console.warn(`Commande serie en attente, Arduino non pret: ${command}`);
      resolve(false);
      return;
    }

    armCommandAck(command, attempt);
    port.write(Buffer.from(`${command}\n`, 'ascii'), (writeError) => {
      if (writeError) {
        clearCommandAck(command);
        console.error(`Erreur envoi commande serie "${command}":`, writeError.message);
        resolve(false);
        return;
      }

      port.drain((drainError) => {
        if (drainError) {
          clearCommandAck(command);
          console.error(`Erreur vidage port serie "${command}":`, drainError.message);
          resolve(false);
          return;
        }

        if (command !== PING_COMMAND || serialPingAttempts === 0) {
          const attemptLabel = attempt > 1 ? ` (essai ${attempt})` : '';
          console.log(`Commande serie envoyee: ${command}${attemptLabel}`);
        }
        resolve(true);
      });
    });
  });
}

async function pollCurrentUser() {
  if (pollingUser) return;

  pollingUser = true;
  try {
    const resp = await http.get(KIOSK_SESSION_URL);
    const userId = resp.data?.userId ?? null;

    if (userId && userId !== currentObservedUserId) {
      if (!serialLinkValidated) {
        if (!waitingForSerialLinkLogged) {
          console.warn('Selection detectee, attente de la validation PC <-> Arduino.');
          waitingForSerialLinkLogged = true;
        }
        return;
      }

      if (
        pendingServoUserId === userId &&
        Date.now() - lastServoCommandAt < SERVO_RETRY_MS
      ) {
        return;
      }

      const sent = await sendSerialCommand(SERVO_COMMAND);
      if (sent) {
        currentObservedUserId = userId;
        pendingServoUserId = userId;
        lastServoCommandAt = Date.now();
        motor1AwaitingRfid = true;
      }
      return;
    }

    if (!userId) {
      if (
        motor1AwaitingRfid &&
        serialLinkValidated &&
        Date.now() - lastCloseCommandAt >= SERVO_RETRY_MS
      ) {
        const sent = await sendSerialCommand(CLOSE_COMMAND);
        if (sent) {
          lastCloseCommandAt = Date.now();
        }
      }

      currentObservedUserId = null;
      pendingServoUserId = null;
      lastServoCommandAt = 0;
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

  const embeddedEvents = KNOWN_ARDUINO_EVENTS.filter((event) => line.includes(event));
  if (embeddedEvents.length > 0) {
    for (const event of embeddedEvents) {
      handleArduinoEvent(event);
    }
    return;
  }

  if (line.startsWith('EVENT:')) {
    handleArduinoEvent(line.slice('EVENT:'.length).trim());
    return;
  }

  try {
    const payload = JSON.parse(line);
    if (payload.event && typeof payload.event === 'string') {
      handleArduinoEvent(payload.event);
      return;
    }

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
    serialReady = false;
    serialLinkValidated = false;
    serialPingAttempts = 0;
    firmwareDetected = false;
    arduinoBootCount = 0;
    if (serialReadyTimer) clearTimeout(serialReadyTimer);
    console.log(`Attente initialisation Arduino: ${SERIAL_READY_DELAY_MS} ms...`);
    serialReadyTimer = setTimeout(() => {
      setSerialReady(`delai de secours de ${SERIAL_READY_DELAY_MS} ms`);
    }, SERIAL_READY_DELAY_MS);
  });

  serialPort.on('error', (err) => {
    console.error('Erreur port série:', err.message);
  });

  serialPort.on('close', () => {
    console.error('Port série fermé');
    serialReady = false;
    serialLinkValidated = false;
    clearCommandAck(SERVO_COMMAND);
    clearCommandAck(CLOSE_COMMAND);
    if (serialPingTimer) {
      clearTimeout(serialPingTimer);
      serialPingTimer = null;
    }
    if (serialReadyTimer) {
      clearTimeout(serialReadyTimer);
      serialReadyTimer = null;
    }
    scheduleReconnect();
  });

  parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
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
      if (/access denied/i.test(err.message)) {
        console.error(
          `Le port ${PORT} est deja utilise. Ferme Arduino IDE et execute stop-rfid-bridge.cmd.`
        );
      }
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
if (process.stdin.isTTY) {
  process.stdin.setEncoding('utf8');
  console.log('Test manuel: s + Entree ouvre M1, c + Entree ferme M1.');
  process.stdin.on('data', (input) => {
    const command = input.trim().toUpperCase();
    if (command === 'S') {
      void sendSerialCommand(SERVO_COMMAND);
    } else if (command === 'C') {
      void sendSerialCommand(CLOSE_COMMAND);
    }
  });
}

console.log(`Bridge RFID demarre depuis: ${__filename}`);
console.log(`Protocole ${BRIDGE_PROTOCOL}, commande moteur: octet S (0x53).`);

setInterval(() => {
  void pollCurrentUser();
}, USER_POLL_MS);
