#define MFRC522_SPICLOCK (100000u)

#include <SPI.h>
#include <MFRC522.h>
#include <string.h>

// RFID: D10 pour SDA/SS, A2 pour RST, et le bus SPI standard D11-D13.
constexpr uint8_t RST_PIN = A2;
constexpr uint8_t SS_PIN = 10;
constexpr unsigned long SCAN_COOLDOWN_MS = 700;
constexpr unsigned long RFID_POLL_INTERVAL_MS = 75;
constexpr unsigned long RFID_NO_TAG_REPORT_MS = 3000;

// Moteur 1
constexpr uint8_t STEP1_PIN = 6;
constexpr uint8_t DIR1_PIN = 7;

// Moteur 2
constexpr uint8_t STEP2_PIN = 8;
constexpr uint8_t DIR2_PIN = 9;

// Fins de course de fermeture
constexpr uint8_t FC1_FERME_PIN = A5;
constexpr uint8_t FC2_FERME_PIN = A3;

constexpr int PAS_OUVERTURE_M1 = 4500;
constexpr int PAS_OUVERTURE_M2 = 4650;
constexpr int PAS_FERMETURE_MAX_M1 = PAS_OUVERTURE_M1 * 3;
constexpr int PAS_FERMETURE_MAX_M2 = PAS_OUVERTURE_M2 * 3;
constexpr unsigned int DEMI_PERIODE_PAS_US = 600;
constexpr unsigned int DELAI_DIRECTION_US = 20;
constexpr unsigned long ATTENTE_COURTE_MS = 300;
constexpr unsigned long ATTENTE_MOTEUR_2_MS = 2000;

enum EtatCycle : uint8_t {
  REPOS,
  OUVERTURE_M1,
  ATTENTE_APRES_OUVERTURE_M1,
  ATTENTE_RFID,
  FERMETURE_M1_ANNULATION,
  FERMETURE_M1_RFID,
  ATTENTE_APRES_FERMETURE_M1,
  OUVERTURE_M2,
  ATTENTE_APRES_OUVERTURE_M2,
  FERMETURE_M2
};

MFRC522 mfrc522(SS_PIN, RST_PIN);

char lastUid[24] = "";
unsigned long lastScanAt = 0;
unsigned long attenteDepuis = 0;
unsigned long lastRfidPollAt = 0;
unsigned long rfidWaitingSince = 0;
int pasEffectues = 0;
EtatCycle etatCycle = REPOS;
bool rfidNoTagReported = false;

void envoyerEvenement(const __FlashStringHelper* evenement) {
  Serial.print(F("EVENT:"));
  Serial.println(evenement);
  Serial.flush();
}

void faireUnPas(uint8_t stepPin) {
  digitalWrite(stepPin, HIGH);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
  digitalWrite(stepPin, LOW);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
}

void preparerMouvement(uint8_t dirPin, uint8_t direction, EtatCycle nouvelEtat) {
  digitalWrite(dirPin, direction);
  delayMicroseconds(DELAI_DIRECTION_US);
  pasEffectues = 0;
  etatCycle = nouvelEtat;
}

void demarrerOuvertureMoteur1() {
  preparerMouvement(DIR1_PIN, HIGH, OUVERTURE_M1);
}

void demarrerFermetureMoteur1(EtatCycle nouvelEtat) {
  preparerMouvement(DIR1_PIN, LOW, nouvelEtat);
}

void demarrerOuvertureMoteur2() {
  preparerMouvement(DIR2_PIN, LOW, OUVERTURE_M2);
}

void demarrerFermetureMoteur2() {
  preparerMouvement(DIR2_PIN, HIGH, FERMETURE_M2);
}

bool triggerServo() {
  if (etatCycle != REPOS) {
    return false;
  }

  demarrerOuvertureMoteur1();
  return true;
}

void annulerAttenteRfid() {
  if (
    etatCycle == REPOS ||
    etatCycle == OUVERTURE_M1 ||
    etatCycle == ATTENTE_APRES_OUVERTURE_M1 ||
    etatCycle == ATTENTE_RFID
  ) {
    demarrerFermetureMoteur1(FERMETURE_M1_ANNULATION);
    return;
  }

  if (etatCycle != FERMETURE_M1_ANNULATION) {
    envoyerEvenement(F("close_ignored_no_active_cycle"));
  }
}

bool validerDepotManuel() {
  if (
    etatCycle == OUVERTURE_M1 ||
    etatCycle == ATTENTE_APRES_OUVERTURE_M1 ||
    etatCycle == ATTENTE_RFID
  ) {
    demarrerFermetureMoteur1(FERMETURE_M1_RFID);
    return true;
  }

  return false;
}

void handleSerialInput() {
  while (Serial.available() > 0) {
    const char commande = static_cast<char>(Serial.read());

    if (commande == 'P' || commande == 'p') {
      envoyerEvenement(F("pong"));
      continue;
    }

    if (commande == 'S' || commande == 's') {
      envoyerEvenement(F("serial_data_received"));
      envoyerEvenement(F("servo_received"));
      if (!triggerServo()) {
        envoyerEvenement(F("servo_ignored_cycle_active"));
      }
      continue;
    }

    if (commande == 'C' || commande == 'c') {
      envoyerEvenement(F("close_received"));
      annulerAttenteRfid();
      continue;
    }

    if (commande == 'V' || commande == 'v') {
      envoyerEvenement(F("complete_received"));
      if (!validerDepotManuel()) {
        envoyerEvenement(F("complete_ignored_cycle_active"));
      }
      continue;
    }

    if (commande != '\r' && commande != '\n' && commande != ' ' && commande != '\t') {
      envoyerEvenement(F("serial_command_unknown"));
    }
  }
}

void terminerFermetureMoteur1(bool annulation) {
  if (annulation) {
    etatCycle = REPOS;
    envoyerEvenement(F("motor1_closed_after_cancel"));
    return;
  }

  attenteDepuis = millis();
  etatCycle = ATTENTE_APRES_FERMETURE_M1;
}

void signalerErreurFinCourse(const __FlashStringHelper* evenement) {
  etatCycle = REPOS;
  envoyerEvenement(evenement);
}

void envoyerDiagnosticRfid() {
  const byte version = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
  const byte antenna = mfrc522.PCD_ReadRegister(MFRC522::TxControlReg) & 0x03;
  const byte gain = mfrc522.PCD_GetAntennaGain();

  Serial.print(F("RFID_DIAG:version=0x"));
  if (version < 0x10) Serial.print('0');
  Serial.print(version, HEX);
  Serial.print(F(",antenna=0x"));
  if (antenna < 0x10) Serial.print('0');
  Serial.print(antenna, HEX);
  Serial.print(F(",gain=0x"));
  if (gain < 0x10) Serial.print('0');
  Serial.println(gain, HEX);
  Serial.flush();
}

void initialiserLecteurRfid() {
  pinMode(RST_PIN, OUTPUT);
  digitalWrite(RST_PIN, LOW);
  delay(5);
  digitalWrite(RST_PIN, HIGH);
  delay(50);

  mfrc522.PCD_Init();
  delay(50);
  mfrc522.PCD_Init();
  delay(10);
  mfrc522.PCD_WriteRegister(MFRC522::TxModeReg, 0x00);
  mfrc522.PCD_WriteRegister(MFRC522::RxModeReg, 0x00);
  mfrc522.PCD_WriteRegister(MFRC522::ModWidthReg, 0x26);
  mfrc522.PCD_AntennaOn();
  mfrc522.PCD_SetAntennaGain(MFRC522::RxGain_max);
}

void preparerLectureRfid() {
  mfrc522.PCD_WriteRegister(MFRC522::TxModeReg, 0x00);
  mfrc522.PCD_WriteRegister(MFRC522::RxModeReg, 0x00);
  mfrc522.PCD_WriteRegister(MFRC522::ModWidthReg, 0x26);
  mfrc522.PCD_AntennaOn();
  mfrc522.PCD_SetAntennaGain(MFRC522::RxGain_max);
  const byte version = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    envoyerEvenement(F("rfid_reader_not_detected"));
    return;
  }

  lastRfidPollAt = 0;
  rfidWaitingSince = millis();
  rfidNoTagReported = false;
  envoyerDiagnosticRfid();
  envoyerEvenement(F("rfid_waiting"));
}

void mettreAJourCycleMoteurs() {
  switch (etatCycle) {
    case REPOS:
    case ATTENTE_RFID:
      return;

    case OUVERTURE_M1:
      if (pasEffectues < PAS_OUVERTURE_M1) {
        faireUnPas(STEP1_PIN);
        pasEffectues++;
        return;
      }
      attenteDepuis = millis();
      etatCycle = ATTENTE_APRES_OUVERTURE_M1;
      return;

    case ATTENTE_APRES_OUVERTURE_M1:
      if (millis() - attenteDepuis >= ATTENTE_COURTE_MS) {
        etatCycle = ATTENTE_RFID;
        envoyerEvenement(F("motor1_opened"));
        preparerLectureRfid();
      }
      return;

    case FERMETURE_M1_ANNULATION:
    case FERMETURE_M1_RFID: {
      const bool annulation = etatCycle == FERMETURE_M1_ANNULATION;
      if (digitalRead(FC1_FERME_PIN) == LOW) {
        terminerFermetureMoteur1(annulation);
        return;
      }
      if (pasEffectues >= PAS_FERMETURE_MAX_M1) {
        signalerErreurFinCourse(F("motor1_limit_not_detected"));
        return;
      }
      faireUnPas(STEP1_PIN);
      pasEffectues++;
      return;
    }

    case ATTENTE_APRES_FERMETURE_M1:
      if (millis() - attenteDepuis >= ATTENTE_COURTE_MS) {
        demarrerOuvertureMoteur2();
      }
      return;

    case OUVERTURE_M2:
      if (pasEffectues < PAS_OUVERTURE_M2) {
        faireUnPas(STEP2_PIN);
        pasEffectues++;
        return;
      }
      attenteDepuis = millis();
      etatCycle = ATTENTE_APRES_OUVERTURE_M2;
      return;

    case ATTENTE_APRES_OUVERTURE_M2:
      if (millis() - attenteDepuis >= ATTENTE_MOTEUR_2_MS) {
        demarrerFermetureMoteur2();
      }
      return;

    case FERMETURE_M2:
      if (digitalRead(FC2_FERME_PIN) == LOW) {
        etatCycle = REPOS;
        envoyerEvenement(F("motor_cycle_complete"));
        return;
      }
      if (pasEffectues >= PAS_FERMETURE_MAX_M2) {
        signalerErreurFinCourse(F("motor2_limit_not_detected"));
        return;
      }
      faireUnPas(STEP2_PIN);
      pasEffectues++;
      return;
  }
}

bool shouldSkipUid(const char* uid) {
  const unsigned long now = millis();
  if (strcmp(lastUid, uid) == 0 && now - lastScanAt < SCAN_COOLDOWN_MS) {
    return true;
  }

  strncpy(lastUid, uid, sizeof(lastUid) - 1);
  lastUid[sizeof(lastUid) - 1] = '\0';
  lastScanAt = now;
  return false;
}

bool printUidAsJson() {
  char uidHex[24];
  uint8_t pos = 0;

  for (byte i = 0; i < mfrc522.uid.size && pos + 2 < sizeof(uidHex); i++) {
    const byte value = mfrc522.uid.uidByte[i];
    const char high = value >> 4;
    const char low = value & 0x0F;

    uidHex[pos++] = high < 10 ? ('0' + high) : ('A' + high - 10);
    uidHex[pos++] = low < 10 ? ('0' + low) : ('A' + low - 10);
  }
  uidHex[pos] = '\0';

  if (shouldSkipUid(uidHex)) {
    return false;
  }

  Serial.print(F("{\"uid\":\""));
  Serial.print(uidHex);
  Serial.println(F("\"}"));
  return true;
}

void lireRfid() {
  if (etatCycle != ATTENTE_RFID) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastRfidPollAt < RFID_POLL_INTERVAL_MS) {
    return;
  }
  lastRfidPollAt = now;

  byte atqa[2];
  byte atqaSize = sizeof(atqa);
  const MFRC522::StatusCode wakeStatus = mfrc522.PICC_WakeupA(atqa, &atqaSize);
  if (wakeStatus != MFRC522::STATUS_OK && wakeStatus != MFRC522::STATUS_COLLISION) {
    if (!rfidNoTagReported && now - rfidWaitingSince >= RFID_NO_TAG_REPORT_MS) {
      rfidNoTagReported = true;
      envoyerEvenement(F("rfid_no_tag_seen"));
      envoyerDiagnosticRfid();
    }
    return;
  }

  envoyerEvenement(F("rfid_tag_detected"));

  if (!mfrc522.PICC_ReadCardSerial()) {
    envoyerEvenement(F("rfid_read_failed"));
    return;
  }

  const bool nouvellePuce = printUidAsJson();
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  if (nouvellePuce) {
    envoyerEvenement(F("rfid_cycle_started"));
    demarrerFermetureMoteur1(FERMETURE_M1_RFID);
  }
}

void setup() {
  Serial.begin(9600);

  digitalWrite(STEP1_PIN, LOW);
  digitalWrite(STEP2_PIN, LOW);
  pinMode(STEP1_PIN, OUTPUT);
  pinMode(DIR1_PIN, OUTPUT);
  pinMode(STEP2_PIN, OUTPUT);
  pinMode(DIR2_PIN, OUTPUT);

  pinMode(FC1_FERME_PIN, INPUT_PULLUP);
  pinMode(FC2_FERME_PIN, INPUT_PULLUP);

  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  SPI.begin();
  initialiserLecteurRfid();

  const byte rfidVersion = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
  envoyerEvenement(F("firmware_motor_state_v9"));
  envoyerDiagnosticRfid();
  if (rfidVersion == 0x00 || rfidVersion == 0xFF) {
    envoyerEvenement(F("rfid_reader_not_detected"));
  } else {
    envoyerEvenement(F("rfid_reader_ready"));
  }
  envoyerEvenement(F("arduino_ready"));
}

void loop() {
  handleSerialInput();
  mettreAJourCycleMoteurs();
  lireRfid();
  handleSerialInput();
}
