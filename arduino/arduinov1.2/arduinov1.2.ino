#include <SPI.h>
#include <MFRC522.h>
#include <Servo.h>
#include <string.h>

constexpr uint8_t RST_PIN = 9;
constexpr uint8_t SS_PIN = 10;
constexpr uint8_t SERVO_PIN = 3;
constexpr unsigned long SERVO_HOLD_MS = 1500;
constexpr unsigned long SCAN_COOLDOWN_MS = 700;

MFRC522 mfrc522(SS_PIN, RST_PIN);
Servo myservo;

char serialCommand[16];
uint8_t serialCommandLen = 0;
char lastUid[24] = "";
unsigned long lastScanAt = 0;

void triggerServo() {
  myservo.write(90);
  delay(SERVO_HOLD_MS);
  myservo.write(0);
}

void handleSerialInput() {
  while (Serial.available() > 0) {
    char c = static_cast<char>(Serial.read());

    if (c == '\r') {
      continue;
    }

    if (c == '\n') {
      serialCommand[serialCommandLen] = '\0';
      if (strcmp(serialCommand, "SERVO") == 0) {
        triggerServo();
      }
      serialCommandLen = 0;
      continue;
    }

    if (serialCommandLen < sizeof(serialCommand) - 1) {
      serialCommand[serialCommandLen++] = c;
    } else {
      serialCommandLen = 0;
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

void printUidAsJson() {
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
    return;
  }

  Serial.print(F("{\"uid\":\""));
  Serial.print(uidHex);
  Serial.println(F("\"}"));
}

void setup() {
  Serial.begin(9600);
  myservo.attach(SERVO_PIN);
  myservo.write(0);

  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  SPI.begin();
  mfrc522.PCD_Init();
}

void loop() {
  handleSerialInput();

  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  printUidAsJson();
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
