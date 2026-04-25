const NAME = 'twilio';

/**
 * Twilio WhatsApp provider stub.
 *
 * To enable:
 *   1. npm install twilio
 *   2. set the env vars:
 *        WHATSAPP_PROVIDER=twilio
 *        TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
 *        TWILIO_AUTH_TOKEN=xxxxxxxxxxxx
 *        TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
 *   3. replace the body of `send` below with:
 *
 *        const twilio = require('twilio');
 *        const client = twilio(
 *          process.env.TWILIO_ACCOUNT_SID,
 *          process.env.TWILIO_AUTH_TOKEN
 *        );
 *        const msg = await client.messages.create({
 *          from: process.env.TWILIO_WHATSAPP_FROM,
 *          to: `whatsapp:${phone}`,
 *          body: message,
 *        });
 *        return { provider: NAME, providerMessageId: msg.sid, status: 'SENT' };
 */
async function send() {
  throw new Error(
    'Twilio provider not configured. See server/src/services/whatsapp/providers/twilio.js for setup instructions.'
  );
}

module.exports = { name: NAME, send };
