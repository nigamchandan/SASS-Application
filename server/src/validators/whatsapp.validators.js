const { z } = require('zod');

const sendInvoiceSchema = z.object({
  message: z
    .string()
    .trim()
    .max(4096)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
});

const sendReminderSchema = sendInvoiceSchema;

const listMessagesQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  kind: z.enum(['INVOICE', 'REMINDER', 'OTHER', 'ALL']).default('ALL'),
  status: z.enum(['SENT', 'FAILED', 'QUEUED', 'ALL']).default('ALL'),
  customerId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
  invoiceId: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
  dateFrom: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v))
    .refine(
      (v) => v === null || !Number.isNaN(Date.parse(v)),
      'Invalid dateFrom'
    ),
  dateTo: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v))
    .refine(
      (v) => v === null || !Number.isNaN(Date.parse(v)),
      'Invalid dateTo'
    ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  sendInvoiceSchema,
  sendReminderSchema,
  listMessagesQuerySchema,
};
