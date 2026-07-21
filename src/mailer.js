const nodemailer = require('nodemailer');

/**
 * Employee SMTP creds are stored as env vars shaped:
 *   EMPLOYEE_SMTP_<KEY>=host|port|user|pass
 * This keeps real mailbox passwords out of the database entirely —
 * they only ever live in the server's environment.
 */
function getEmployeeTransport(smtpKey) {
  const raw = process.env[`EMPLOYEE_SMTP_${smtpKey.toUpperCase()}`];
  if (!raw) {
    throw new Error(
      `No EMPLOYEE_SMTP_${smtpKey.toUpperCase()} entry found in .env for smtp_key "${smtpKey}"`
    );
  }
  const [host, port, user, pass] = raw.split('|');
  if (!host || !port || !user || !pass) {
    throw new Error(
      `EMPLOYEE_SMTP_${smtpKey.toUpperCase()} is malformed — expected host|port|user|pass`
    );
  }
  return {
    transport: nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    }),
    fromAddress: user,
  };
}

function getManagerTransport() {
  const { MANAGER_SMTP_HOST, MANAGER_SMTP_PORT, MANAGER_SMTP_USER, MANAGER_SMTP_PASS } =
    process.env;
  if (!MANAGER_SMTP_HOST || !MANAGER_SMTP_PORT || !MANAGER_SMTP_USER || !MANAGER_SMTP_PASS) {
    throw new Error('Manager SMTP settings are missing from .env');
  }
  return {
    transport: nodemailer.createTransport({
      host: MANAGER_SMTP_HOST,
      port: Number(MANAGER_SMTP_PORT),
      secure: Number(MANAGER_SMTP_PORT) === 465,
      auth: { user: MANAGER_SMTP_USER, pass: MANAGER_SMTP_PASS },
    }),
    fromAddress: MANAGER_SMTP_USER,
  };
}

async function sendAsManager({ to, subject, text, html }) {
  const { transport, fromAddress } = getManagerTransport();
  return transport.sendMail({
    from: `"${process.env.MANAGER_NAME || 'Manager'}" <${fromAddress}>`,
    to,
    subject,
    text,
    html,
  });
}

async function sendAsEmployee({ smtpKey, fromName, to, subject, text }) {
  const { transport, fromAddress } = getEmployeeTransport(smtpKey);
  return transport.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject,
    text,
  });
}

module.exports = { sendAsManager, sendAsEmployee };
