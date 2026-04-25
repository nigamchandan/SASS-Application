const { z } = require('zod');

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' || v === undefined ? null : v))
  .refine(
    (v) => v === null || !Number.isNaN(Date.parse(v)),
    'Invalid payment date'
  );

const createPaymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0'),
  paymentDate: optionalDate,
  method: z
    .enum(['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'OTHER'])
    .default('CASH'),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
});

const listPaymentsQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  method: z
    .enum(['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'OTHER', 'ALL'])
    .default('ALL'),
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
  customerId: z.string().trim().optional().or(z.literal('')).transform((v) =>
    v === '' || v === undefined ? null : v
  ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['paymentDate', 'amount', 'createdAt']).default('paymentDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

module.exports = { createPaymentSchema, listPaymentsQuerySchema };
