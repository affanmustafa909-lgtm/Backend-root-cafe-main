/** Typical DE café / pickup-app legal copy (DDG + DSGVO + gastronomy AGB). */

export type CafeContact = {
  name: string;
  street: string;
  postalCity: string;
  phone: string;
  email: string;
  owner: string;
  vatId: string;
  notes: string;
};

export const EMPTY_CONTACT: CafeContact = {
  name: '',
  street: '',
  postalCity: '',
  phone: '',
  email: '',
  owner: '',
  vatId: '',
  notes: '',
};

export const GERMAN_PRIVACY = `Datenschutzerklärung

1. Verantwortlicher
Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist der im Impressum dieser App genannte Betreiber des Cafés.

2. Welche Daten wir verarbeiten
Über die App verarbeiten wir insbesondere:
- Kontodaten: Name, E-Mail-Adresse, Passwort (verschlüsselt gespeichert), optional Telefonnummer und Profilbild
- Bestelldaten: bestellte Artikel und Anpassungen, Abholart (sofort oder Termin), Abholzeit, Bestellstatus sowie der Hinweis, dass die Zahlung vor Ort im Café erfolgt
- Treueprogramm: Stempelkarte (gesammelte Stempel), sofern aktiviert
- Geräte-Push-Token, sofern Sie Mitteilungen erlauben

Wir nutzen E-Mail und optional die Telefonnummer für Login, Bestellzuordnung und Rückfragen zur Abholung.

3. Zwecke und Rechtsgrundlagen
- Konto, Anmeldung und Bestellabwicklung: Art. 6 Abs. 1 lit. b DSGVO (Vertrag)
- Bestellstatus und Abholung: Art. 6 Abs. 1 lit. b DSGVO
- Push-Mitteilungen zum Bestellstatus: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung; in den Einstellungen jederzeit abschaltbar)
- Stempelkarte: Art. 6 Abs. 1 lit. b DSGVO bzw. Art. 6 Abs. 1 lit. f DSGVO
- IT-Sicherheit: Art. 6 Abs. 1 lit. f DSGVO
- Gesetzliche Aufbewahrung (handels- und steuerrechtlich): Art. 6 Abs. 1 lit. c DSGVO

4. Speicherdauer
- Kontodaten: bis zur Löschung des Kontos, danach nur soweit gesetzliche Pflichten bestehen
- Bestellungen: soweit steuer- oder handelsrechtliche Aufbewahrungspflicht besteht, in der Regel bis zu 10 Jahre (§ 147 AO, § 257 HGB)
- Push-Token: bis Sie Mitteilungen deaktivieren oder das Konto löschen
- Stempelkarte: bis zur Kontolöschung

5. Empfänger
Technische Dienstleister, die Daten in unserem Auftrag verarbeiten können:
- Hosting und Datenbank: Railway (Cloud-Infrastruktur)
- Push-Zustellung über Expo sowie Apple (APNs) bzw. Google (FCM), je nach Gerät

Bei Cloud- und Push-Diensten kann eine Übermittlung in Drittländer (z. B. USA) stattfinden. Soweit erforderlich, stützen wir uns auf Standardvertragsklauseln der EU-Kommission (Art. 46 DSGVO).

6. Ihre Rechte
Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie das Recht, eine Einwilligung mit Wirkung für die Zukunft zu widerrufen. Das Konto können Sie in der App unter Profil löschen.

7. Beschwerde
Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren, insbesondere am Sitz des Cafés. Übersicht: https://www.bfdi.bund.de

8. Pflicht zur Bereitstellung
Ohne E-Mail und Passwort ist keine Registrierung möglich. Die Telefonnummer ist freiwillig, erleichtert aber die Kontaktaufnahme zur Bestellung.`;

export const GERMAN_TERMS = `Allgemeine Geschäftsbedingungen (AGB)

1. Geltungsbereich
Diese AGB gelten für die Nutzung der App und für Vorbestellungen zur Abholung im Café. Vertragspartner ist der im Impressum genannte Betreiber.

2. Konto
Für Bestellungen ist ein Nutzerkonto erforderlich. Angaben müssen zutreffend sein. Bei Missbrauch kann das Café das Konto sperren.

3. Bestellung und Vertragsschluss
Die Darstellung von Speisen und Getränken in der App ist unverbindlich. Mit dem Absenden der Bestellung geben Sie ein verbindliches Angebot ab. Der Vertrag kommt zustande, wenn das Café die Bestellung annimmt (z. B. Status „Eingegangen“ oder Beginn der Zubereitung). Das Café kann Bestellungen ablehnen, etwa bei Ausverkauf oder früherer Schließung.

4. Preise und Zahlung
Preise verstehen sich in Euro einschließlich der gesetzlichen Umsatzsteuer, soweit ausgewiesen. Die Zahlung erfolgt vor Ort im Café. In der App wird keine Online-Zahlung durchgeführt.

5. Abholung
Die Bestellung ist zur gewählten Zeit (sofort oder Termin) im Café abzuholen. Sie sind dafür verantwortlich, rechtzeitig zu erscheinen.

6. Nicht abgeholte Bestellungen (No-Show)
Wird eine angenommene und zubereitete Bestellung nicht innerhalb einer angemessenen Zeit nach dem Abholzeitpunkt abgeholt, darf das Café die Ware entsorgen. Der Zubereitungsaufwand kann gleichwohl geschuldet bleiben. Wiederholte No-Shows können zur Ablehnung künftiger Bestellungen führen.

7. Widerruf / Storno
Ein Widerrufsrecht nach Fernabsatzrecht besteht in der Regel nicht für Speisen und Getränke, die schnell verderben oder auf Ihren Wunsch zubereitet werden (§ 312g Abs. 2 Nr. 2 und Nr. 3 BGB). Eine Stornierung vor Beginn der Zubereitung ist nach Verfügbarkeit möglich — bitte das Café direkt kontaktieren.

8. Allergene
Allergenhinweise dienen der Information. Bei Unverträglichkeiten fragen Sie bitte vor der Bestellung im Café nach.

9. Stempelkarte
Sofern aktiviert, gelten die in der App angezeigten Regeln (Anzahl Stempel für ein Gratisgetränk). Stempel sind nicht übertragbar und entfallen bei Kontolöschung, soweit nicht anders angegeben.

10. Haftung
Für leichte Fahrlässigkeit haftet das Café nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren Schaden. Unberührt bleiben Vorsatz, grobe Fahrlässigkeit, die Haftung nach dem Produkthaftungsgesetz sowie bei Verletzung von Leben, Körper oder Gesundheit.

11. Streitbeilegung
Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit: https://ec.europa.eu/consumers/odr
Das Café ist nicht verpflichtet, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.

12. Schlussbestimmungen
Es gilt das Recht der Bundesrepublik Deutschland. Für Verbraucher bleiben zwingende Schutzvorschriften des Staates des gewöhnlichen Aufenthalts unberührt. Gerichtsstand für Kaufleute ist der Sitz des Cafés.`;

function trim(value?: string | null) {
  return (value ?? '').trim();
}

export function contactFromRow(row: {
  cafeName?: string | null;
  cafeStreet?: string | null;
  cafePostalCity?: string | null;
  cafePhone?: string | null;
  cafeEmail?: string | null;
  cafeOwner?: string | null;
  cafeVatId?: string | null;
  cafeImpressumNotes?: string | null;
}): CafeContact {
  return {
    name: trim(row.cafeName),
    street: trim(row.cafeStreet),
    postalCity: trim(row.cafePostalCity),
    phone: trim(row.cafePhone),
    email: trim(row.cafeEmail),
    owner: trim(row.cafeOwner),
    vatId: trim(row.cafeVatId),
    notes: trim(row.cafeImpressumNotes),
  };
}

export function composeImpressum(contact: CafeContact): string {
  const lines: string[] = [
    'Impressum',
    '',
    'Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)',
    '',
  ];

  const hasIdentity =
    contact.name ||
    contact.street ||
    contact.postalCity ||
    contact.phone ||
    contact.email ||
    contact.owner;

  if (!hasIdentity) {
    lines.push(
      'Die gesetzlich vorgeschriebenen Angaben (genaue Firma, Straße und Hausnummer — kein Postfach —, Telefon, E-Mail und vertretungsberechtigte Person) trägt das Café im Admin-Bereich unter Einstellungen → Legal pages ein.',
    );
    if (contact.notes) {
      lines.push('', contact.notes);
    }
    return lines.join('\n').trim();
  }

  if (contact.name) lines.push(contact.name);
  if (contact.street) lines.push(contact.street);
  if (contact.postalCity) lines.push(contact.postalCity);

  if (contact.owner) {
    lines.push('', 'Vertreten durch:', contact.owner);
  }

  const reach: string[] = [];
  if (contact.phone) reach.push(`Telefon: ${contact.phone}`);
  if (contact.email) reach.push(`E-Mail: ${contact.email}`);
  if (reach.length) lines.push('', ...reach);

  if (contact.vatId) {
    lines.push('', 'Umsatzsteuer-Identifikationsnummer:', contact.vatId);
  }

  if (contact.notes) lines.push('', contact.notes);

  const contentOwner = contact.owner || contact.name;
  if (contentOwner) {
    lines.push(
      '',
      'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:',
      contentOwner,
    );
  }

  return lines.join('\n').trim();
}

export function resolveLegalTexts(
  row: {
    legalImpressum?: string | null;
    legalPrivacy?: string | null;
    legalTerms?: string | null;
  } & Parameters<typeof contactFromRow>[0],
) {
  const contact = contactFromRow(row);
  const storedImpressum = trim(row.legalImpressum);
  return {
    contact,
    impressum: storedImpressum || composeImpressum(contact),
    privacy: trim(row.legalPrivacy) || GERMAN_PRIVACY,
    terms: trim(row.legalTerms) || GERMAN_TERMS,
  };
}
