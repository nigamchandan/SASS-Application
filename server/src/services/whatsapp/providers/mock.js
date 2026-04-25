const crypto = require('crypto');

const NAME = 'mock';

async function send({ phone, message, meta = {} }) {
  const id = `mock-${crypto.randomBytes(8).toString('hex')}`;
  await new Promise((r) => setTimeout(r, 80));

  const banner = '='.repeat(60);
  // eslint-disable-next-line no-console
  console.log(
    [
      banner,
      `[WhatsApp:mock] -> ${phone}`,
      meta.kind ? `kind=${meta.kind}` : null,
      meta.invoiceNumber ? `invoice=${meta.invoiceNumber}` : null,
      `id=${id}`,
      banner,
      message,
      banner,
    ]
      .filter(Boolean)
      .join('\n')
  );

  return {
    provider: NAME,
    providerMessageId: id,
    status: 'SENT',
  };
}

module.exports = { name: NAME, send };
