const { z } = require('zod');

const optionalString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v));

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v === '' || v === undefined ? null : v));

const baseFields = {
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: optionalString(30),
  email: optionalEmail,
  address: optionalString(500),
  gstNumber: optionalString(20),
};

const createCustomerSchema = z.object(baseFields);

const updateCustomerSchema = z.object({
  name: baseFields.name.optional(),
  phone: baseFields.phone,
  email: baseFields.email,
  address: baseFields.address,
  gstNumber: baseFields.gstNumber,
});

const listCustomersQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersQuerySchema,
};
