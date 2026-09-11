// Test simple des deux moteurs, sans boutons, LEDs, RFID ni ENABLE.

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

void faireUnPasM1() {
  digitalWrite(STEP1_PIN, HIGH);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
  digitalWrite(STEP1_PIN, LOW);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
}

void faireUnPasM2() {
  digitalWrite(STEP2_PIN, HIGH);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
  digitalWrite(STEP2_PIN, LOW);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
}

void ouvrirMoteur1() {
  digitalWrite(DIR1_PIN, HIGH);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_OUVERTURE_M1; i++) {
    faireUnPasM1();
  }
}

bool fermerMoteur1() {
  digitalWrite(DIR1_PIN, LOW);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_FERMETURE_MAX_M1; i++) {
    if (digitalRead(FC1_FERME_PIN) == LOW) {
      return true;
    }
    faireUnPasM1();
  }

  return digitalRead(FC1_FERME_PIN) == LOW;
}

void ouvrirMoteur2() {
  digitalWrite(DIR2_PIN, LOW);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_OUVERTURE_M2; i++) {
    faireUnPasM2();
  }
}

bool fermerMoteur2() {
  digitalWrite(DIR2_PIN, HIGH);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_FERMETURE_MAX_M2; i++) {
    if (digitalRead(FC2_FERME_PIN) == LOW) {
      return true;
    }
    faireUnPasM2();
  }

  return digitalRead(FC2_FERME_PIN) == LOW;
}

void arreterSurErreur(const __FlashStringHelper* message) {
  Serial.println(message);
  Serial.println(F("Test arrete. Corrige le cablage puis redemarre l'Arduino."));

  while (true) {
    delay(1000);
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

  delay(2000);
}

void loop() {
  Serial.println(F("Ouverture moteur 1"));
  ouvrirMoteur1();
  delay(1000);

  Serial.println(F("Fermeture moteur 1"));
  
  delay(300);

  Serial.println(F("Ouverture moteur 2"));
  ouvrirMoteur2();
  delay(2000);

  Serial.println(F("Fermeture moteur 2"));
  if (!fermerMoteur2()) {
    arreterSurErreur(F("ERREUR: fin de course moteur 2 non detectee sur A3."));
  }

  if (!fermerMoteur1()) {
    arreterSurErreur(F("ERREUR: fin de course moteur 1 non detectee sur A5."));
  }
  delay(2000);
}
