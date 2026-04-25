const { z } = require('zod');

const RANGE_VALUES = [
  'this_month',
  'last_month',
  'last_3_months',
  'last_6_months',
  'this_year',
  'last_year',
  'all',
  'custom',
];

const reportRangeQuerySchema = z.object({
  range: z.enum(RANGE_VALUES).default('this_month'),
  from: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v))
    .refine(
      (v) => v === null || !Number.isNaN(Date.parse(v)),
      'Invalid from date'
    ),
  to: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v))
    .refine(
      (v) => v === null || !Number.isNaN(Date.parse(v)),
      'Invalid to date'
    ),
  granularity: z
    .enum(['auto', 'day', 'month'])
    .default('auto')
    .optional(),
});

module.exports = {
  RANGE_VALUES,
  reportRangeQuerySchema,
};
