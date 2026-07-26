<?php
/**
 * Arvenna, Kontaktformular-Handler.
 *
 * Nimmt das Formular von index.html und en/index.html entgegen und schickt eine
 * Mail an EMPFAENGER. Antwortet mit JSON, wenn der Request per fetch kommt
 * (Header X-Requested-With), sonst mit einer einfachen HTML-Seite, das Formular
 * funktioniert damit auch ohne JavaScript.
 */

declare(strict_types=1);

const EMPFAENGER   = 'info@arvenna.ch';
// Absender muss auf der eigenen Domain liegen, sonst scheitert SPF/DMARC.
const ABSENDER     = 'website@arvenna.ch';
const MAX_LAENGE   = 5000;
const MIN_NACHRICHT = 10;

/** Entfernt Zeilenumbrüche, verhindert Header-Injection in Betreff und From. */
function kopfzeilenSicher(string $wert): string
{
    return trim(str_replace(["\r", "\n", "%0a", "%0d"], '', $wert));
}

function feld(string $name): string
{
    $wert = $_POST[$name] ?? '';
    if (!is_string($wert)) {
        return '';
    }
    return trim(mb_substr($wert, 0, MAX_LAENGE));
}

/** Beendet die Antwort: JSON für fetch, sonst eine schlichte HTML-Seite. */
function antwort(bool $ok, string $text, int $status = 200): never
{
    http_response_code($status);

    $istAjax = strtolower($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'xmlhttprequest';

    if ($istAjax) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $text], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    $titel  = $ok ? 'Anfrage gesendet' : 'Anfrage nicht gesendet';
    $sicher = htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    echo <<<HTML
    <!DOCTYPE html>
    <html lang="de-CH">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>{$titel} | Arvenna</title>
      <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
      <link rel="stylesheet" href="assets/css/main.css">
    </head>
    <body>
      <main class="wrap prose" id="main">
        <h1>{$titel}</h1>
        <p>{$sicher}</p>
        <p><a class="btn btn--ghost" href="index.html">Zurück zur Startseite</a></p>
      </main>
    </body>
    </html>
    HTML;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    antwort(false, 'Diese Adresse nimmt nur Formularsendungen entgegen.', 405);
}

// Honeypot: echte Besucher sehen dieses Feld nicht. Gefüllt = Bot.
// Wir melden trotzdem Erfolg, damit der Bot nichts lernt.
if (feld('website') !== '') {
    antwort(true, 'Vielen Dank für Ihre Anfrage.');
}

$name      = kopfzeilenSicher(feld('name'));
$email     = kopfzeilenSicher(feld('email'));
$firma     = kopfzeilenSicher(feld('firma'));
$telefon   = kopfzeilenSicher(feld('telefon'));
$branche   = kopfzeilenSicher(feld('branche'));
$nachricht = feld('nachricht');

$fehler = [];

if ($name === '') {
    $fehler[] = 'Name';
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $fehler[] = 'E-Mail';
}
if ($branche === '') {
    $fehler[] = 'Branche';
}
if (mb_strlen($nachricht) < MIN_NACHRICHT) {
    $fehler[] = 'Nachricht';
}

if ($fehler !== []) {
    antwort(false, 'Bitte prüfen Sie diese Felder: ' . implode(', ', $fehler) . '.', 422);
}

$betreff = sprintf('Anfrage über arvenna.ch: %s (%s)', $name, $branche);

$koerper = implode("\n", [
    'Neue Anfrage über das Kontaktformular auf arvenna.ch',
    str_repeat('-', 56),
    'Name:      ' . $name,
    'E-Mail:    ' . $email,
    'Firma:     ' . ($firma !== '' ? $firma : '-'),
    'Telefon:   ' . ($telefon !== '' ? $telefon : '-'),
    'Branche:   ' . $branche,
    'Sprache:   ' . (str_contains($_SERVER['HTTP_REFERER'] ?? '', '/en/') ? 'EN' : 'DE'),
    str_repeat('-', 56),
    '',
    $nachricht,
    '',
    str_repeat('-', 56),
    'Gesendet:  ' . date('d.m.Y H:i'),
    'IP:        ' . ($_SERVER['REMOTE_ADDR'] ?? 'unbekannt'),
]);

$headers = implode("\r\n", [
    'From: Arvenna Website <' . ABSENDER . '>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: PHP/' . phpversion(),
]);

$gesendet = @mail(
    EMPFAENGER,
    '=?UTF-8?B?' . base64_encode($betreff) . '?=',
    $koerper,
    $headers,
    '-f' . ABSENDER
);

if (!$gesendet) {
    // Interne Fehlerdetails bleiben im Log, nicht in der Antwort.
    error_log('arvenna: mail() fehlgeschlagen für ' . $email);
    antwort(false, 'Die Anfrage konnte nicht gesendet werden. Bitte schreiben Sie uns direkt an ' . EMPFAENGER . '.', 500);
}

antwort(true, 'Vielen Dank, Ihre Anfrage ist angekommen. Wir melden uns innerhalb eines Arbeitstages.');
