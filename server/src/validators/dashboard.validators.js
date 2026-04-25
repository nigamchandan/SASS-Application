const { z } = require('zod');

const rangeSchema = z.enum(['today', 'week', 'month', 'year']).default('month');

const summaryQuerySchema = z.object({
  range: rangeSchema,
});

const revenueQuerySchema = z.object({
  range: rangeSchema,
});

const recentInvoicesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

const topCustomersQuerySchema = z.object({
  range: rangeSchema,
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const alertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

module.exports = {
  summaryQuerySchema,
  revenueQuerySchema,
  recentInvoicesQuerySchema,
  topCustomersQuerySchema,
  activityQuerySchema,
  alertsQuerySchema,
};
