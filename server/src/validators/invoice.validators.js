const { z } = require('zod');

const invoiceItemSchema = z.object({
  itemName: z.string().trim().min(1, 'Item name is required').max(200),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  price: z.coerce.number().nonnegative('Price cannot be negative'),
  tax: z.coerce
    .number()
    .min(0, 'Tax cannot be negative')
    .max(100, 'Tax cannot exceed 100%')
    .optional(),
});

const optionalDate = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' || v === undefined ? null : v))
  .refine(
    (v) => v === null || !Number.isNaN(Date.parse(v)),
    'Invalid date'
  );

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
  dueDate: optionalDate,
  status: z.enum(['UNPAID', 'PAID']).default('UNPAID'),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
});

const updateInvoiceStatusSchema = z.object({
  status: z.enum(['UNPAID', 'PAID']),
});

const updateInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required').optional(),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
  dueDate: optionalDate,
  status: z.enum(['UNPAID', 'PAID']).optional(),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item').optional(),
});

const listInvoicesQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  status: z.enum(['UNPAID', 'PAID', 'OVERDUE', 'ALL']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'totalAmount', 'invoiceNumber', 'dueDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

module.exports = {
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  updateInvoiceSchema,
  listInvoicesQuerySchema,
};
