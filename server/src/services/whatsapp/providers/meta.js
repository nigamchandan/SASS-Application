const NAME = 'meta';

/**
 * Meta (WhatsApp Cloud API) provider stub.
 *
 * To enable:
 *   1. set env:
 *        WHATSAPP_PROVIDER=meta
 *        META_PHONE_NUMBER_ID=xxxxxxxxxxxxxxxx
 *        META_ACCESS_TOKEN=xxxxxxxxxxxxxx
 *   2. replace `send` below with a fetch to
 *      https://graph.facebook.com/v20.0/${phoneNumberId}/messages
 *      with a Bearer token, posting:
 *        {
 *          messaging_product: "whatsapp",
 *          to: phone,
 *          type: "text",
 *          text: { body: message }
 *        }
 *   3. parse the response and return { providerMessageId: data.messages[0].id }.
 */
async function send() {
  throw new Error(
    'Meta provider not configured. See server/src/services/whatsapp/providers/meta.js for setup instructions.'
  );
}

module.exports = { name: NAME, send };
