<?php
declare(strict_types=1);

/* =====================================================================
   CONSULTATION FORM ENDPOINT

   Validates the form server side, then delivers it to
   contact@siamconsult.co.th over authenticated SMTP. Both emails it
   sends — the enquiry and the acknowledgement — are plain text.

   Needs PHP running. Locally: php -S localhost:8000

   Always responds with JSON:
       200  { "ok": true,  "message": ... }
       400  { "ok": false, "errors": { field: message, ... } }
       405 / 429 / 500  { "ok": false, "message": ... }
   ===================================================================== */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

/* Never leak PHP warnings into the JSON body */
ini_set('display_errors', '0');
error_reporting(E_ALL);

/* ===== HELPERS ===== */

function isLocalhost(): bool
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    $host   = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    return in_array($remote, ['127.0.0.1', '::1'], true)
        || strncmp($host, 'localhost', 9) === 0
        || strncmp($host, '127.0.0.1', 9) === 0;
}

function jsonOut(int $status, array $body): void
{
    if (!headers_sent()) http_response_code($status);
    while (ob_get_level() > 0) { @ob_end_clean(); }
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $status, string $message, ?string $debug = null): void
{
    $body = ['ok' => false, 'message' => $message];
    if ($debug !== null && isLocalhost()) $body['debug'] = $debug;
    jsonOut($status, $body);
}

/** Strip control characters so a value can never be injected into a header */
function clean(string $value, int $max = 2000): string
{
    $value = str_replace(["\r", "\n", "\0"], ' ', $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return mb_substr(trim($value), 0, $max);
}

/** Multi-line fields keep newlines but lose every other control character */
function cleanMultiline(string $value, int $max = 5000): string
{
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return mb_substr(trim($value), 0, $max);
}

/* ===== METHOD + PAYLOAD ===== */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'This endpoint only accepts POST requests.');
}

$input = $_POST;
if (empty($input)) {
    /* Also accept a JSON body, so fetch() can use either encoding */
    $raw = file_get_contents('php://input') ?: '';
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) $input = $decoded;
}

/* ===== SPAM GATES — honeypot and minimum fill time =====
   Both are silent: a bot gets a success response and no email. */

if (clean((string) ($input['company_website'] ?? '')) !== '') {
    jsonOut(200, ['ok' => true, 'message' => 'Thank you — your request has been received.']);
}

$startedAt = (int) ($input['started_at'] ?? 0);
if ($startedAt > 0 && (time() * 1000 - $startedAt) < 2500) {
    jsonOut(200, ['ok' => true, 'message' => 'Thank you — your request has been received.']);
}

/* ===== reCAPTCHA v3 =====
   The secret lives in mail-config.php (or RECAPTCHA_SECRET) and never
   reaches the browser; the site key is in assets/js/recaptcha.js.

     no secret configured  -> skipped, the form works as before
     missing/bad token     -> 403; a real browser always sends one
     low score             -> accepted, but flagged in the email subject
     Google unreachable    -> accepted; their outage must not take the
                              firm's only contact form offline */

function recaptchaPost(string $payload): ?string
{
    $url = 'https://www.google.com/recaptcha/api/siteverify';

    /* cURL first — many shared hosts disable allow_url_fopen */
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body = curl_exec($ch);
        $err  = curl_errno($ch);
        curl_close($ch);
        if ($body !== false && $err === 0) return (string) $body;
    }

    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content'       => $payload,
        'timeout'       => 8,
        'ignore_errors' => true,
    ]]);
    $body = @file_get_contents($url, false, $ctx);
    return $body === false ? null : (string) $body;
}

/**
 * @return array{ok:bool,reason:string,score:?float}
 */
function verifyRecaptcha(string $token, string $secret, float $minScore, string $expectedAction): array
{
    if ($secret === '' || $secret === 'PUT_THE_RECAPTCHA_SECRET_KEY_HERE') {
        return ['ok' => true, 'reason' => 'disabled', 'score' => null];
    }
    if ($token === '') {
        return ['ok' => false, 'reason' => 'missing-token', 'score' => null];
    }

    $res = recaptchaPost(http_build_query([
        'secret'   => $secret,
        'response' => $token,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
    ]));

    /* Fail open: Google being down must not close the contact form */
    if ($res === null) {
        return ['ok' => true, 'reason' => 'verify-unreachable', 'score' => null];
    }

    $data  = json_decode($res, true);
    $score = (is_array($data) && isset($data['score'])) ? (float) $data['score'] : null;

    if (!is_array($data) || empty($data['success'])) {
        return ['ok' => false, 'reason' => 'failed', 'score' => $score];
    }
    if ($expectedAction !== '' && isset($data['action']) && $data['action'] !== $expectedAction) {
        return ['ok' => false, 'reason' => 'action-mismatch', 'score' => $score];
    }
    if ($score !== null && $score < $minScore) {
        /* Suspicious, not rejected — flagged on the email instead */
        return ['ok' => true, 'reason' => 'low-score', 'score' => $score];
    }

    return ['ok' => true, 'reason' => 'ok', 'score' => $score];
}

/* ===== VALIDATION ===== */

$name    = clean((string) ($input['name']    ?? ''), 120);
$email   = clean((string) ($input['email']   ?? ''), 190);
$phone   = clean((string) ($input['phone']   ?? ''), 60);
$service = clean((string) ($input['service'] ?? ''), 120);
$message = cleanMultiline((string) ($input['message'] ?? ''));

$errors = [];

if ($name === '')                              $errors['name']    = 'Please tell us your name.';
elseif (mb_strlen($name) < 2)                  $errors['name']    = 'That name looks too short.';

if ($email === '')                             $errors['email']   = 'An email address is required.';
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Enter a valid email address.';

if ($phone === '')                             $errors['phone']   = 'A contact number is required.';
elseif (strlen(preg_replace('/\D/', '', $phone) ?? '') < 7) $errors['phone'] = 'Enter a reachable phone number.';

if ($service === '')                           $errors['service'] = 'Please choose a service.';

if ($message === '')                           $errors['message'] = 'Please describe your matter.';
elseif (mb_strlen($message) < 12)              $errors['message'] = 'A little more detail helps us prepare.';

if ($errors) {
    jsonOut(400, ['ok' => false, 'errors' => $errors, 'message' => 'Please complete the highlighted fields.']);
}

/* ===== RATE LIMIT — 5 submissions per IP per hour =====
   Falls back to "allow" if the data directory is not writable. */

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) @mkdir($dataDir, 0775, true);

if (is_dir($dataDir) && is_writable($dataDir)) {
    $ip   = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $file = $dataDir . '/rate-' . sha1($ip) . '.json';
    $now  = time();
    $hits = [];
    if (is_file($file)) {
        $decoded = json_decode((string) @file_get_contents($file), true);
        if (is_array($decoded)) $hits = $decoded;
    }
    $hits = array_values(array_filter($hits, static fn($t) => is_int($t) && ($now - $t) < 3600));
    if (count($hits) >= 5) {
        fail(429, 'You have sent several requests already. Please email us directly at contact@siamconsult.co.th.');
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
}

/* ===== CONFIGURATION ===== */

$cfg = [
    'host'      => 'smtp.hostinger.com',
    'username'  => 'contact@siamconsult.co.th',
    'password'  => '',
    'port'      => 465,
    'from'      => 'contact@siamconsult.co.th',
    'from_name' => 'Siam Consult Phuket',
    'to'        => 'contact@siamconsult.co.th',
    'to_name'   => 'Siam Consult Phuket',
    'send_ack'  => true,
    'debug'     => false,

    /* reCAPTCHA v3. Empty = verification skipped entirely. */
    'recaptcha_secret'    => '',
    'recaptcha_min_score' => 0.5,
];

$configFile = __DIR__ . '/mail-config.php';
if (is_file($configFile)) {
    $override = require $configFile;
    if (is_array($override)) $cfg = array_merge($cfg, $override);
}

/* Environment variables win over the file */
foreach ([
    'SMTP_HOST'      => 'host',
    'SMTP_USERNAME'  => 'username',
    'SMTP_PASSWORD'  => 'password',
    'SMTP_PORT'      => 'port',
    'MAIL_FROM'        => 'from',
    'MAIL_FROM_NAME'   => 'from_name',
    'MAIL_TO'          => 'to',
    'RECAPTCHA_SECRET' => 'recaptcha_secret',
] as $env => $key) {
    $value = getenv($env);
    if ($value !== false && $value !== '') $cfg[$key] = $value;
}

/* ===== reCAPTCHA GATE ===== */

$rc = verifyRecaptcha(
    clean((string) ($input['g-recaptcha-response'] ?? ''), 4000),
    (string) $cfg['recaptcha_secret'],
    (float) $cfg['recaptcha_min_score'],
    'contact'
);

if (!$rc['ok']) {
    fail(403, 'We could not verify that you are human. Please reload the page and try again.',
        'reCAPTCHA ' . $rc['reason'] . ' (score ' . var_export($rc['score'], true) . ')');
}

/* Accepted but suspicious — the email says so rather than us binning it */
$rcFlag = ($rc['reason'] === 'low-score')
    ? ' [LOW reCAPTCHA SCORE ' . number_format((float) $rc['score'], 2) . ']'
    : '';

if ($cfg['password'] === '' || $cfg['password'] === 'PUT_THE_REAL_MAILBOX_PASSWORD_HERE') {
    fail(500, 'The contact form is not finished being set up. Please email contact@siamconsult.co.th directly.',
        'Copy assets/php/mail-config.sample.php to mail-config.php and set the mailbox password.');
}

/* ===== COMPOSE + SEND ===== */

require_once __DIR__ . '/vendor/PHPMailer.php';
require_once __DIR__ . '/vendor/SMTP.php';
require_once __DIR__ . '/vendor/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

$submittedAt = (new DateTimeImmutable('now', new DateTimeZone('Asia/Bangkok')))
    ->format('j F Y, H:i') . ' (Bangkok)';

/* Plain text only — these are working emails, not marketing */

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');

$bodyText = "NEW CONSULTATION REQUEST\n"
    . "Siam Consult Phuket\n"
    . str_repeat('-', 48) . "\n\n"
    . "Name:     $name\n"
    . "Email:    $email\n"
    . "Phone:    $phone\n"
    . "Service:  $service\n\n"
    . "Message\n"
    . str_repeat('-', 48) . "\n"
    . "$message\n\n"
    . str_repeat('-', 48) . "\n"
    . "Submitted $submittedAt\n"
    . "IP $ip\n"
    . 'reCAPTCHA: ' . $rc['reason']
        . ($rc['score'] !== null ? ' (score ' . number_format((float) $rc['score'], 2) . ')' : '') . "\n"
    . "Reply to this email to answer $name directly.\n";

$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = (string) $cfg['host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = (string) $cfg['username'];
    $mail->Password   = (string) $cfg['password'];
    $mail->Port       = (int) $cfg['port'];
    $mail->SMTPSecure = ((int) $cfg['port'] === 465)
        ? PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->CharSet    = 'UTF-8';
    $mail->Timeout    = 20;

    if (!empty($cfg['debug']) && isLocalhost()) {
        $mail->SMTPDebug   = SMTP::DEBUG_SERVER;
        $mail->Debugoutput = static function ($str) use (&$smtpLog) { $smtpLog[] = rtrim($str); };
    }

    /* From must be the authenticated mailbox; the enquirer goes in Reply-To */
    $mail->setFrom((string) $cfg['from'], (string) $cfg['from_name']);
    $mail->addAddress((string) $cfg['to'], (string) $cfg['to_name']);
    $mail->addReplyTo($email, $name);

    $mail->Subject = 'Consultation request — ' . $service . ' — ' . $name . $rcFlag;
    $mail->isHTML(false);
    $mail->Body    = $bodyText;

    $mail->send();

    /* ----- Acknowledgement to the enquirer ----- */
    if (!empty($cfg['send_ack'])) {
        try {
            $ack = clone $mail;
            $ack->clearAllRecipients();
            $ack->clearReplyTos();
            $ack->addAddress($email, $name);
            $ack->addReplyTo((string) $cfg['from'], (string) $cfg['from_name']);
            $ack->Subject = 'We have received your request — Siam Consult Phuket';
            $ack->Body =
                "Thank you, $name.\n\n"
                . "We have received your enquiry about $service. A consultant will reply\n"
                . "within one business day with the documents you will need and an honest\n"
                . "view of the timeline.\n\n"
                . "If the matter is urgent, reply to this email and it will reach the same\n"
                . "team.\n\n"
                . str_repeat('-', 48) . "\n"
                . "Siam Consult Phuket\n"
                . "Cherng Talay, Thalang, Phuket 83110, Thailand\n"
                . "contact@siamconsult.co.th\n";
            $ack->send();
        } catch (Throwable $ignored) {
            /* The enquiry was delivered — a bounced ack must not fail it */
        }
    }

    jsonOut(200, [
        'ok'      => true,
        'message' => 'Thank you — a consultant will reply within one business day.',
    ]);

} catch (PHPMailerException $e) {
    fail(500, 'We could not send your message just now. Please email contact@siamconsult.co.th directly.',
        $mail->ErrorInfo ?: $e->getMessage());
} catch (Throwable $e) {
    fail(500, 'We could not send your message just now. Please email contact@siamconsult.co.th directly.',
        $e->getMessage());
}
