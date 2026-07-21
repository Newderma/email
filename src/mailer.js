const { Resend } = require('resend');
const { ImapFlow } = require('imapflow');

const resend = new Resend(process.env.RESEND_API_KEY);

function parseCreds(raw) {
  const parts = raw.split('|');
  return { user: parts[2], pass: parts[3] };
}

function buildRawEmail({ from, fromName, to, subject, text }) {
  const date = new Date().toUTCString();
  return (
    `From: "${fromName}" <${from}>\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `Date: ${date}\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
    text
  );
}

async function appendToSent({ user, pass, rawEmail }) {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user, pass },
    logger: false,
  });
  await client.connect();
  try {
    await client.append(process.env.IMAP_SENT_FOLDER || 'Sent', rawEmail, ['\\Seen']);
  } finally {
    await client.logout();
  }
}

async function sendAsManager({ to, subject, text, html }) {
  const fromAddress = process.env.MANAGER_EMAIL;
  const fromName = process.env.MANAGER_NAME || 'Manager';

  await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    text,
    html,
  });

  try {
    const raw = buildRawEmail({ from: fromAddress, fromName, to, subject, text });
    await appendToSent({
      user: process.env.MANAGER_SMTP_USER,
      pass: process.env.MANAGER_SMTP_PASS,
      rawEmail: raw,
    });
  } catch (err) {
    console.error('[mailer] Sent, but failed to file copy in manager Sent folder:', err.message);
  }
}

async function sendAsEmployee({ smtpKey, fromName, to, subject, text }) {
  const raw = process.env[`EMPLOYEE_SMTP_${smtpKey.toUpperCase()}`];
  if (!raw) {
    throw new Error(`No EMPLOYEE_SMTP_${smtpKey.toUpperCase()} entry found in .env`);
  }
  const { user, pass } = parseCreds(raw);
  const fromAddress = user;

  await resend.emails.send({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    text,
  });

  try {
    const rawEmail = buildRawEmail({ from: fromAddress, fromName, to, subject, text });
    await appendToSent({ user, pass, rawEmail });
  } catch (err) {
    console.error(`[mailer] Sent, but failed to file copy in ${fromName}'s Sent folder:`, err.message);
  }
}

module.exports = { sendAsManager, sendAsEmployee };