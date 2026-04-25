const mock = require('./providers/mock');
const twilio = require('./providers/twilio');
const meta = require('./providers/meta');
const ApiError = require('../../utils/ApiError');

const PROVIDERS = {
  [mock.name]: mock,
  [twilio.name]: twilio,
  [meta.name]: meta,
};

function getProvider() {
  const name = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown WHATSAPP_PROVIDER "${name}". Allowed: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return provider;
}

function normalisePhone(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  // Keep leading '+' if present, strip everything else but digits.
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Send a WhatsApp message via the configured provider.
 *
 * @param {string} phone   Recipient number (E.164-ish, e.g. "+919876543210").
 * @param {string} message Plain text body.
 * @param {object} [meta]  Optional metadata for logs (kind, invoiceNumber, ...).
 * @returns {Promise<{ provider: string, providerMessageId: string|null, status: string }>}
 */
async function sendWhatsAppMessage(phone, message, meta = {}) {
  const normalised = normalisePhone(phone);
  if (!normalised) {
    throw new ApiError(
      400,
      'Customer does not have a valid phone number'
    );
  }
  if (!message || !String(message).trim()) {
    throw new ApiError(400, 'Message body is required');
  }

  const provider = getProvider();
  return provider.send({ phone: normalised, message, meta });
}

module.exports = { sendWhatsAppMessage, getProvider, normalisePhone };
