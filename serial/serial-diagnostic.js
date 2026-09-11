const { SerialPort } = require('serialport');

const portName = process.argv[2] || process.env.SERIAL_PORT || 'COM5';
const baudRate = Number(process.env.SERIAL_BAUD || 9600);
const startupDelayMs = 3000;

let pingReceived = false;

const port = new SerialPort({
  path: portName,
  baudRate,
  autoOpen: false,
});

function sendByte(value, label) {
  const payload = Buffer.from([value]);
  port.write(payload, (writeError) => {
    if (writeError) {
      console.error(`Erreur envoi ${label}:`, writeError.message);
      return;
    }

    port.drain((drainError) => {
      if (drainError) {
        console.error(`Erreur drain ${label}:`, drainError.message);
        return;
      }
      console.log(`[TX] ${label}: 0x${value.toString(16).padStart(2, '0')}`);
    });
  });
}

port.on('data', (chunk) => {
  const text = chunk.toString('utf8');
  const hex = [...chunk].map((value) => value.toString(16).padStart(2, '0')).join(' ');

  console.log(`[RX texte] ${JSON.stringify(text)}`);
  console.log(`[RX hex]   ${hex}`);

  if (text.includes('EVENT:pong')) {
    pingReceived = true;
    console.log('OK: la liaison PC -> Arduino -> PC fonctionne dans les deux sens.');
    console.log('Tape s puis Entree pour tester l ouverture du moteur 1.');
  }
});

port.on('error', (error) => {
  console.error('Erreur port serie:', error.message);
});

port.on('close', () => {
  console.log('Port serie ferme.');
});

port.open((openError) => {
  if (openError) {
    console.error(`Impossible d ouvrir ${portName}:`, openError.message);
    if (/access denied/i.test(openError.message)) {
      console.error(
        `Le port ${portName} est deja utilise. Ferme Arduino IDE et execute stop-rfid-bridge.cmd.`
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Diagnostic ouvert sur ${portName} @ ${baudRate}.`);
  console.log(`Attente du redemarrage Arduino pendant ${startupDelayMs} ms...`);

  setTimeout(() => {
    console.log('Envoi du test PING...');
    sendByte(0x50, 'P');

    setTimeout(() => {
      if (!pingReceived) {
        console.error('ECHEC: aucun EVENT:pong recu apres le PING.');
        console.error('Verifie le sketch televerse et debranche tout element sur D0/RX et D1/TX.');
      }
    }, 2000);
  }, startupDelayMs);
});

if (process.stdin.isTTY) {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (input) => {
    if (input.trim().toUpperCase() === 'S') {
      sendByte(0x53, 'S');
    }
  });
}

process.on('SIGINT', () => {
  if (!port.isOpen) {
    process.exit(0);
    return;
  }

  port.close(() => process.exit(0));
});
