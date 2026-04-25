const { z } = require('zod');

const trimmedNullable = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v));

const updateBusinessProfileSchema = z.object({
  businessName: trimmedNullable(120),
  address: trimmedNullable(500),
  phone: trimmedNullable(30),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .max(160)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v === '' || v === undefined ? null : v)),
  gstNumber: trimmedNullable(40),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Currency must be 3 letters')
    .max(3, 'Currency must be 3 letters')
    .optional(),
  invoiceFooterNote: trimmedNullable(500),
  whatsappReminderEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

const updateInvoiceSettingsSchema = z.object({
  invoicePrefix: z
    .string()
    .trim()
    .min(1, 'Prefix is required')
    .max(20)
    .regex(/^[A-Za-z0-9_\-]+$/, 'Use letters, numbers, "-" or "_" only')
    .optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional(),
  defaultDueDays: z.coerce.number().int().min(0).max(365).optional(),
  invoiceFooterNote: trimmedNullable(500),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(3)
    .optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from current password',
  });

module.exports = {
  updateBusinessProfileSchema,
  updateInvoiceSettingsSchema,
  changePasswordSchema,
};
