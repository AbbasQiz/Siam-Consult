<?php
/* =====================================================================
   SMTP CONFIGURATION (SAMPLE)

   Copy to assets/php/mail-config.php, add the real mailbox password,
   and never commit that copy — it holds a live credential.

   These environment variables override the file, so you can keep the
   password off disk entirely:
       SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, SMTP_PORT,
       MAIL_FROM, MAIL_FROM_NAME, MAIL_TO, RECAPTCHA_SECRET
   ===================================================================== */

return [
    /* Outgoing SMTP. Defaults match a typical cPanel / Hostinger mailbox */
    'host'      => 'smtp.hostinger.com',
    'username'  => 'contact@siamconsult.co.th',
    'password'  => 'PUT_THE_REAL_MAILBOX_PASSWORD_HERE',
    'port'      => 465,                       // 465 = SSL, 587 = STARTTLS

    /* Must be a real mailbox on your domain, or SPF/DMARC will reject it */
    'from'      => 'contact@siamconsult.co.th',
    'from_name' => 'Siam Consult Phuket',

    /* Where consultation requests are delivered */
    'to'        => 'contact@siamconsult.co.th',
    'to_name'   => 'Siam Consult Phuket',

    /* Send the enquirer an automatic acknowledgement */
    'send_ack'  => true,

    /* reCAPTCHA v3 secret key. The matching site key goes in
       assets/js/recaptcha.js. Empty here means verification is skipped. */
    'recaptcha_secret' => '',

    /* Below this score the email is still delivered, but the subject is
       tagged [LOW reCAPTCHA SCORE]. Never silently discarded. */
    'recaptcha_min_score' => 0.5,

    /* Verbose SMTP errors in the JSON response. Localhost only */
    'debug'     => false,
];
