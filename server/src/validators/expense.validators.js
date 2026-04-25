const { z } = require('zod');

const EXPENSE_CATEGORIES = [
  'Utilities',
  'Office Supplies',
  'Travel',
  'Food & Drinks',
  'Marketing',
  'Software',
  'Salaries',
  'Rent',
  'Maintenance',
  'Taxes',
  'Other',
];

const dateString = z
  .string({ required_error: 'Date is required' })
  .trim()
  .refine((v) => v && !Number.isNaN(Date.parse(v)), 'Invalid date');

const optionalNullableString = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v));

const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  category: z
    .string()
    .trim()
    .min(1, 'Category is required')
    .max(100)
    .refine(
      (v) => EXPENSE_CATEGORIES.includes(v),
      'Choose a valid category'
    ),
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0'),
  date: dateString,
  description: optionalNullableString(1000),
});

const updateExpenseSchema = createExpenseSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one field is required' }
);

const listExpensesQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  category: z.string().trim().max(100).optional().default(''),
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
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['date', 'amount', 'createdAt', 'title']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const summaryQuerySchema = z.object({
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
});

module.exports = {
  EXPENSE_CATEGORIES,
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  summaryQuerySchema,
};
