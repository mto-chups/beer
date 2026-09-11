// Test USB serie -> moteur 1, sans RFID, boutons, LEDs ni ENABLE.

constexpr uint8_t STEP1_PIN = 6;
constexpr uint8_t DIR1_PIN = 7;
constexpr int PAS_OUVERTURE_M1 = 4500;
constexpr unsigned int DEMI_PERIODE_PAS_US = 600;
constexpr unsigned int DELAI_DIRECTION_US = 20;

void envoyerEvenement(const __FlashStringHelper* evenement) {
  Serial.print(F("EVENT:"));
  Serial.println(evenement);
  Serial.flush();
}

void faireUnPasM1() {
  digitalWrite(STEP1_PIN, HIGH);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
  digitalWrite(STEP1_PIN, LOW);
  delayMicroseconds(DEMI_PERIODE_PAS_US);
}

void ouvrirMoteur1() {
  digitalWrite(DIR1_PIN, HIGH);
  delayMicroseconds(DELAI_DIRECTION_US);

  for (int i = 0; i < PAS_OUVERTURE_M1; i++) {
    faireUnPasM1();
  }
}

void setup() {
  digitalWrite(STEP1_PIN, LOW);
  pinMode(STEP1_PIN, OUTPUT);
  pinMode(DIR1_PIN, OUTPUT);

  Serial.begin(9600);
  delay(1000);
  envoyerEvenement(F("serial_motor_test_v1"));
  envoyerEvenement(F("arduino_ready"));
}

void loop() {
  while (Serial.available() > 0) {
    const char commande = static_cast<char>(Serial.read());

    if (commande == 'P') {
      envoyerEvenement(F("pong"));
      continue;
    }

    if (commande == 'S') {
      envoyerEvenement(F("servo_received"));
      ouvrirMoteur1();
      envoyerEvenement(F("motor1_opened"));
    }
  }
}
