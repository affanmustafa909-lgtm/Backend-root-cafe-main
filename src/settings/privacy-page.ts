import type { CafeContact } from './legal-templates.js';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function contactBlock(contact: CafeContact) {
  const lines = [
    contact.name,
    contact.owner ? `Vertreten durch / Represented by: ${contact.owner}` : '',
    contact.street,
    contact.postalCity,
    contact.phone ? `Telefon / Phone: ${contact.phone}` : '',
    contact.email ? `E-Mail: ${contact.email}` : '',
    contact.vatId ? `USt-IdNr.: ${contact.vatId}` : '',
  ].filter(Boolean);

  if (!lines.length) {
    return `<p>The controller is the café operator named in the in-app Impressum (Profile → Impressum). Fill the café name, street address, phone, email, and owner in the admin panel under Settings → Legal pages. That same contact is shown here once it is saved.</p>
<p>Verantwortlicher ist der im Impressum der App genannte Café-Betreiber (Profil → Impressum). Name, Straße, Telefon, E-Mail und Inhaber trägt das Café im Admin unter Einstellungen → Legal pages ein. Dieselben Angaben erscheinen dann auch auf dieser Seite.</p>`;
  }

  return `<address>${lines.map((line) => escapeHtml(line)).join('<br>')}</address>`;
}

/** Public privacy policy for App Store Connect and in-browser review. */
export function renderPrivacyPolicyHtml(contact: CafeContact) {
  const updated = '1 October 2026';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy · Roots Café</title>
  <meta name="description" content="Privacy policy for the Roots Café pickup app, including GDPR rights and in-app account deletion.">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f6f3ee;
      color: #1a1512;
      font: 17px/1.6 Georgia, "Iowan Old Style", Palatino, serif;
    }
    main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 2.1rem; line-height: 1.15; margin: 0 0 0.35rem; }
    h2 { font-size: 1.25rem; margin: 2rem 0 0.5rem; }
    .kicker { letter-spacing: 0.08em; text-transform: uppercase; font: 600 0.72rem/1.4 ui-sans-serif, system-ui, sans-serif; color: #5b7c8d; }
    .updated { color: #5c534c; margin-top: 0; }
    .card {
      background: #fff;
      border: 1px solid rgba(26,21,18,0.08);
      border-radius: 16px;
      padding: 1rem 1.1rem;
      margin: 1.25rem 0;
    }
    .card strong { font-family: ui-sans-serif, system-ui, sans-serif; }
    a { color: #33427a; }
    address { font-style: normal; }
    hr { border: 0; border-top: 1px solid rgba(26,21,18,0.12); margin: 2.5rem 0; }
  </style>
</head>
<body>
<main>
  <p class="kicker">Roots Café</p>
  <h1>Privacy Policy</h1>
  <p class="updated">Last updated ${updated}. The German text below is the version that applies to customers in Germany under the GDPR (DSGVO).</p>

  <div class="card">
    <strong>Delete your account in the app</strong>
    <p>Profile → settings gear → <em>Delete account</em> → confirm. This removes your name, email, phone number, profile photo, and push token, and signs you out. You can do this yourself at any time. No email request is required.</p>
    <p>Orders may be kept only as long as German commercial or tax law requires (generally up to 10 years). After deletion they are no longer tied to a usable account.</p>
  </div>

  <h2>1. Who is responsible</h2>
  ${contactBlock(contact)}

  <h2>2. Data we process</h2>
  <ul>
    <li>Account: name, email, password (stored as a hash), optional phone number, optional profile photo</li>
    <li>Orders: items and customizations, pickup type (as soon as possible or a scheduled time), pickup time, order status, and the fact that payment happens in the café</li>
    <li>Loyalty: stamp-card progress, if the café has turned that feature on</li>
    <li>Device push token, if you allow notifications</li>
  </ul>
  <p>We use your email, and your phone number if you add one, to sign you in, attach orders to you, and reach you about pickup. The app does not take card payments.</p>

  <h2>3. Why we process it</h2>
  <ul>
    <li>Account, sign-in, and orders: contract (Art. 6 (1) (b) GDPR)</li>
    <li>Order status and pickup: contract (Art. 6 (1) (b) GDPR)</li>
    <li>Push notifications about an order: consent (Art. 6 (1) (a) GDPR). You can turn them off in the app settings and in the system settings</li>
    <li>Stamp card: contract or legitimate interest (Art. 6 (1) (b) or (f) GDPR)</li>
    <li>Security of the service: legitimate interest (Art. 6 (1) (f) GDPR)</li>
    <li>Legal retention of orders: legal obligation (Art. 6 (1) (c) GDPR)</li>
  </ul>

  <h2>4. How long we keep it</h2>
  <ul>
    <li>Account data: until you delete the account, then only where a legal duty remains</li>
    <li>Orders: for as long as tax or commercial retention applies, generally up to 10 years (§ 147 AO, § 257 HGB)</li>
    <li>Push token: until you disable notifications or delete the account</li>
    <li>Stamp card: until the account is deleted</li>
  </ul>

  <h2>5. Who receives it</h2>
  <p>Processors that may handle data for us:</p>
  <ul>
    <li>Hosting and database: Railway</li>
    <li>Push delivery: Expo, and Apple (APNs) or Google (FCM), depending on the phone</li>
  </ul>
  <p>Cloud and push services can involve a transfer outside the EU (for example to the United States). Where that is required, we rely on the European Commission’s standard contractual clauses (Art. 46 GDPR).</p>

  <h2>6. Your rights</h2>
  <p>You can ask for access, correction, deletion, restriction, portability, and you can object (Art. 15–21 GDPR). You can withdraw consent for notifications at any time. Account deletion is in the app: Profile → settings gear → Delete account.</p>
  <p>You can also complain to a data-protection authority, in particular the one where the café is based. A list for Germany is at <a href="https://www.bfdi.bund.de">bfdi.bund.de</a>.</p>

  <h2>7. What you must provide</h2>
  <p>Email and password are required to create an account. A phone number is optional. It makes it easier for the café to contact you about an order.</p>

  <hr>
  <p class="kicker">Datenschutzerklärung</p>
  <h1>Datenschutzerklärung</h1>
  <p class="updated">Stand: 1. Oktober 2026</p>

  <div class="card">
    <strong>Konto in der App löschen</strong>
    <p>Profil → Zahnrad (Einstellungen) → <em>Konto löschen</em> → bestätigen. Dabei werden Name, E-Mail, Telefonnummer, Profilbild und Push-Token entfernt und Sie werden abgemeldet. Das können Sie jederzeit selbst tun. Eine E-Mail an das Café ist dafür nicht nötig.</p>
    <p>Bestellungen dürfen wir nur so lange behalten, wie Handels- oder Steuerrecht es verlangt (in der Regel bis zu 10 Jahre). Danach sind sie keinem nutzbaren Konto mehr zugeordnet.</p>
  </div>

  <h2>1. Verantwortlicher</h2>
  ${contactBlock(contact)}

  <h2>2. Welche Daten wir verarbeiten</h2>
  <ul>
    <li>Konto: Name, E-Mail, Passwort (nur als Hash), freiwillige Telefonnummer, freiwilliges Profilbild</li>
    <li>Bestellungen: Artikel und Anpassungen, Abholung sofort oder zum Termin, Abholzeit, Status, Hinweis dass die Zahlung im Café erfolgt</li>
    <li>Stempelkarte, sofern das Café sie eingeschaltet hat</li>
    <li>Push-Token des Geräts, wenn Sie Mitteilungen erlauben</li>
  </ul>
  <p>E-Mail und — falls angegeben — die Telefonnummer nutzen wir für Anmeldung, Bestellzuordnung und Rückfragen zur Abholung. In der App gibt es keine Kartenzahlung.</p>

  <h2>3. Zwecke und Rechtsgrundlagen</h2>
  <ul>
    <li>Konto, Anmeldung, Bestellung: Art. 6 Abs. 1 lit. b DSGVO</li>
    <li>Bestellstatus und Abholung: Art. 6 Abs. 1 lit. b DSGVO</li>
    <li>Push zum Bestellstatus: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, jederzeit in den Einstellungen widerrufbar)</li>
    <li>Stempelkarte: Art. 6 Abs. 1 lit. b oder lit. f DSGVO</li>
    <li>IT-Sicherheit: Art. 6 Abs. 1 lit. f DSGVO</li>
    <li>Gesetzliche Aufbewahrung: Art. 6 Abs. 1 lit. c DSGVO</li>
  </ul>

  <h2>4. Speicherdauer</h2>
  <ul>
    <li>Kontodaten: bis zur Löschung, danach nur soweit eine gesetzliche Pflicht bleibt</li>
    <li>Bestellungen: solange handels- oder steuerrechtliche Pflichten bestehen, in der Regel bis zu 10 Jahre (§ 147 AO, § 257 HGB)</li>
    <li>Push-Token: bis Sie Mitteilungen abschalten oder das Konto löschen</li>
    <li>Stempelkarte: bis zur Kontolöschung</li>
  </ul>

  <h2>5. Empfänger</h2>
  <ul>
    <li>Hosting und Datenbank: Railway</li>
    <li>Push: Expo sowie Apple (APNs) oder Google (FCM)</li>
  </ul>
  <p>Dabei kann eine Übermittlung in Drittländer (z. B. USA) stattfinden. Soweit erforderlich, stützen wir uns auf Standardvertragsklauseln der EU-Kommission (Art. 46 DSGVO).</p>

  <h2>6. Ihre Rechte</h2>
  <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) und können eine Einwilligung jederzeit widerrufen. Die Kontolöschung finden Sie in der App unter Profil → Zahnrad → Konto löschen.</p>
  <p>Beschwerde bei einer Aufsichtsbehörde, insbesondere am Sitz des Cafés. Übersicht: <a href="https://www.bfdi.bund.de">bfdi.bund.de</a>.</p>

  <h2>7. Pflicht zur Bereitstellung</h2>
  <p>Ohne E-Mail und Passwort ist keine Registrierung möglich. Die Telefonnummer ist freiwillig.</p>
</main>
</body>
</html>`;
}
