#define MFRC522_SPICLOCK (100000u)

#include <SPI.h>
#include <MFRC522.h>

constexpr uint8_t RST_PIN = A2;
constexpr uint8_t SS_PIN = 10;

MFRC522 mfrc522(SS_PIN, RST_PIN);

void imprimerHex(byte value) {
  if (value < 0x10) Serial.print('0');
  Serial.print(value, HEX);
}

void setup() {
  Serial.begin(9600);

  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  SPI.begin();

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

  const byte version = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
  const byte antenna = mfrc522.PCD_ReadRegister(MFRC522::TxControlReg) & 0x03;

  Serial.print(F("RFID_TEST_READY version=0x"));
  imprimerHex(version);
  Serial.print(F(" antenna=0x"));
  imprimerHex(antenna);
  Serial.println();
  Serial.println(F("Approche un tag 13.56 MHz du centre de l antenne."));
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  Serial.println(F("TAG_DETECTED"));
  if (!mfrc522.PICC_ReadCardSerial()) {
    Serial.println(F("TAG_READ_FAILED"));
    return;
  }

  Serial.print(F("{\"uid\":\""));
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    imprimerHex(mfrc522.uid.uidByte[i]);
  }
  Serial.println(F("\"}"));

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(500);
}
