#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>

constexpr uint8_t RST_PIN = 9;
constexpr uint8_t SS_PIN  = 10;
MFRC522 mfrc522(SS_PIN, RST_PIN);
Servo myservo;

void setup() {
  Serial.begin(9600);
  while (!Serial);
   myservo.attach(3);         // pin du servo
  myservo.write(0);          // position repos
  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  SPI.begin();
  mfrc522.PCD_Init();
  // Serial.println(F("{\"event\":\"ready\"}"));

}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    if (cmd == "SERVO\n") {
      // ON FAIT BOUGER LE SERVO
      myservo.write(90);
      delay(1500);
      myservo.write(0);
    }
  }
  
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  // Construire une chaîne JSON : {"uid":"E659A700"}
  String uidStr;
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uidStr += '0';
    uidStr += String(mfrc522.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();

  // Envoi JSON sur la liaison série
  Serial.print(F("{\"uid\":\""));
  Serial.print(uidStr);
  Serial.println(F("\"}"));

  mfrc522.PICC_HaltA();
  delay(200);  // éviter les lectures trop rapprochées
}
