
//Reste à faire partie moteur, voir si on branche ENABLE sur pin carte pour eviter le bruit sourd des cartes pilotes moteurs. Gestion vitesse M2 (voir selon tests) ?? + retirer leds pour liberer des pins 

// ===== Moteur 1 =====
#define STEP1 6
#define DIR1  7

// ===== Moteur 2 =====
#define STEP2 8
#define DIR2  9

// ===== Boutons =====
#define BTN_AUTH A0
#define BTN_RFID A1

// ===== Fins de course =====
// Moteur 1 fermé
#define FC1_FERME A5

// Moteur 2 fermé
#define FC2_FERME A3

// ===== LEDs =====
#define LED_VERTE 5
#define LED_JAUNE 4
#define LED_ROUGE 3

// ===== Nombre de pas pour l'ouverture =====
#define PAS_OUVERTURE_M1 400
#define PAS_OUVERTURE_M2 400


// ==================================================
// FAIRE UN PAS - MOTEUR 1
// ==================================================
void faireUnPasM1()
{
  digitalWrite(STEP1, HIGH);
  delayMicroseconds(600);
  digitalWrite(STEP1, LOW);
  delayMicroseconds(600);
}


// ==================================================
// FAIRE UN PAS - MOTEUR 2
// ==================================================
void faireUnPasM2()
{
  digitalWrite(STEP2, HIGH);
  delayMicroseconds(600);
  digitalWrite(STEP2, LOW);
  delayMicroseconds(600);
}


// ==================================================
// OUVERTURE MOTEUR 1
// ==================================================
void ouvrirMoteur1()
{
  digitalWrite(LED_VERTE, LOW);
  digitalWrite(LED_JAUNE, HIGH);

  // Sens ouverture
  digitalWrite(DIR1, HIGH);

  // Ouverture sur un nombre défini de pas
  for(int i = 0; i < PAS_OUVERTURE_M1; i++)
  {
    faireUnPasM1();
  }

  digitalWrite(LED_JAUNE, LOW);
  digitalWrite(LED_VERTE, HIGH);
}


// ==================================================
// FERMETURE MOTEUR 1
// ==================================================
void fermerMoteur1()
{
  digitalWrite(LED_VERTE, LOW);
  digitalWrite(LED_JAUNE, HIGH);

  // Sens fermeture
  digitalWrite(DIR1, LOW);

  // Ferme jusqu'au capteur A5
  while(digitalRead(FC1_FERME) == HIGH)
  {
    faireUnPasM1();
  }

  digitalWrite(LED_JAUNE, LOW);
  digitalWrite(LED_VERTE, HIGH);
}


// ==================================================
// OUVERTURE MOTEUR 2
// ==================================================
void ouvrirMoteur2()
{
  digitalWrite(LED_VERTE, LOW);
  digitalWrite(LED_JAUNE, HIGH);

  // Sens ouverture
  digitalWrite(DIR2, LOW);

  // Ouverture sur un nombre défini de pas
  for(int i = 0; i < PAS_OUVERTURE_M2; i++)
  {
    faireUnPasM2();
  }
}


// ==================================================
// FERMETURE MOTEUR 2
// ==================================================
void fermerMoteur2()
{
  // Sens fermeture
  digitalWrite(DIR2, HIGH);

  // Ferme jusqu'au capteur A3
  while(digitalRead(FC2_FERME) == HIGH)
  {
    faireUnPasM2();
  }

  digitalWrite(LED_JAUNE, LOW);
  digitalWrite(LED_VERTE, HIGH);
}


// ==================================================
// SETUP
// ==================================================
void setup()
{
  // Moteur 1
  pinMode(STEP1, OUTPUT);
  pinMode(DIR1, OUTPUT);

  // Moteur 2
  pinMode(STEP2, OUTPUT);
  pinMode(DIR2, OUTPUT);

  // Boutons
  pinMode(BTN_AUTH, INPUT_PULLUP);
  pinMode(BTN_RFID, INPUT_PULLUP);

  // Fins de course
  pinMode(FC1_FERME, INPUT_PULLUP);
  pinMode(FC2_FERME, INPUT_PULLUP);

}


// ==================================================
// LOOP
// ==================================================
void loop()
{
  // ------------------------------------------------
  // ID / AUTORISATION
  // ------------------------------------------------
  // if(digitalRead(BTN_AUTH) == LOW)
  // {
  //   // 1. Ouverture du moteur 1
  //   ouvrirMoteur1();

  //   delay(300);
  // }
ouvrirMoteur1();

    delay(300);

        delay(2000);

     fermerMoteur1();

    // 3. Une fois M1 fermé :
    //    ouverture du moteur 2
    ouvrirMoteur2();

    // 4. Attente de 0,5 seconde
    delay(2000);

    // 5. Fermeture du moteur 2 jusqu'à son capteur A3
    fermerMoteur2();

    delay(300);
  // ------------------------------------------------
  // RFID
  // ------------------------------------------------
  // if(digitalRead(BTN_RFID) == LOW)
  // {
  //   // 2. Fermeture du moteur 1 jusqu'à son capteur A5
  //   fermerMoteur1();

  //   // 3. Une fois M1 fermé :
  //   //    ouverture du moteur 2
  //   ouvrirMoteur2();

  //   // 4. Attente de 0,5 seconde
  //   delay(2000);

  //   // 5. Fermeture du moteur 2 jusqu'à son capteur A3
  //   fermerMoteur2();

  //   delay(300);
  // }
}
