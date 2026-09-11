#include <SPI.h>
#include <MFRC522.h>
#include <string.h>

// Le reset RFID est deplace sur A2 pour laisser la broche 9 au moteur 2.
constexpr uint8_t RST_PIN = A2;
constexpr uint8_t SS_PIN = 10;
constexpr unsigned long SCAN_COOLDOWN_MS = 700;

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

MFRC522 mfrc522(SS_PIN, RST_PIN);

char lastUid[24] = "";
unsigned long lastScanAt = 0;
bool cycleAutorise = false;

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

void ouvrirMoteur1() {
  digitalWrite(DIR1_PIN, HIGH);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_OUVERTURE_M1; i++) {
    faireUnPas(STEP1_PIN);
  }

}

bool fermerMoteur1() {
  digitalWrite(DIR1_PIN, LOW);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_FERMETURE_MAX_M1; i++) {
    if (digitalRead(FC1_FERME_PIN) == LOW) {
      return true;
    }
    faireUnPas(STEP1_PIN);
  }

  return digitalRead(FC1_FERME_PIN) == LOW;
}

void ouvrirMoteur2() {
  digitalWrite(DIR2_PIN, LOW);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_OUVERTURE_M2; i++) {
    faireUnPas(STEP2_PIN);
  }

}

bool fermerMoteur2() {
  digitalWrite(DIR2_PIN, HIGH);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_FERMETURE_MAX_M2; i++) {
    if (digitalRead(FC2_FERME_PIN) == LOW) {
      return true;
    }
    faireUnPas(STEP2_PIN);
  }

  return digitalRead(FC2_FERME_PIN) == LOW;
}

bool triggerServo() {
  if (cycleAutorise) {
    return false;
  }

  ouvrirMoteur1();
  delay(ATTENTE_COURTE_MS);

  cycleAutorise = true;
  return true;
}

void terminerCycleApresRfid() {
  if (!cycleAutorise) {
    return;
  }

  envoyerEvenement(F("rfid_cycle_started"));
  cycleAutorise = false;
  if (!fermerMoteur1()) {
    envoyerEvenement(F("motor1_limit_not_detected"));
    return;
  }
  delay(ATTENTE_COURTE_MS);

  ouvrirMoteur2();
  delay(ATTENTE_MOTEUR_2_MS);

  if (!fermerMoteur2()) {
    envoyerEvenement(F("motor2_limit_not_detected"));
    return;
  }

  envoyerEvenement(F("motor_cycle_complete"));
}

void annulerAttenteRfid() {
  if (!cycleAutorise) {
    envoyerEvenement(F("close_ignored_no_active_cycle"));
    return;
  }

  cycleAutorise = false;
  if (!fermerMoteur1()) {
    envoyerEvenement(F("motor1_limit_not_detected"));
    return;
  }

  envoyerEvenement(F("motor1_closed_after_cancel"));
}

void handleSerialInput() {
  while (Serial.available() > 0) {
    const char commande = static_cast<char>(Serial.read());

    if (commande == 'P') {
      envoyerEvenement(F("pong"));
      continue;
    }

    if (commande == 'S') {
      envoyerEvenement(F("serial_data_received"));
      envoyerEvenement(F("servo_received"));
      if (triggerServo()) {
        envoyerEvenement(F("motor1_opened"));
      } else {
        envoyerEvenement(F("servo_ignored_cycle_active"));
      }
      continue;
    }

    if (commande == 'C') {
      envoyerEvenement(F("close_received"));
      annulerAttenteRfid();
      continue;
    }

    if (commande != '\r' && commande != '\n' && commande != ' ' && commande != '\t') {
      envoyerEvenement(F("serial_command_unknown"));
    }
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
    byte value = mfrc522.uid.uidByte[i];
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
  mfrc522.PCD_Init();
  envoyerEvenement(F("firmware_motor_byte_v1"));
  envoyerEvenement(F("arduino_ready"));
}

void loop() {
  handleSerialInput();

  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  const bool nouvellePuce = printUidAsJson();
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  if (nouvellePuce) {
    terminerCycleApresRfid();
  }
}
