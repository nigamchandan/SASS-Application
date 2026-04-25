import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  gstNumber: z.string().trim().max(20).optional().or(z.literal('')),
});

export const invoiceItemSchema = z.object({
  itemName: z.string().trim().min(1, 'Item name is required').max(200),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Must be > 0'),
  price: z.coerce
    .number({ invalid_type_error: 'Price must be a number' })
    .nonnegative('Cannot be negative'),
  tax: z.coerce
    .number({ invalid_type_error: 'Tax must be a number' })
    .min(0)
    .max(100, 'Max 100%')
    .default(0),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  status: z.enum(['UNPAID', 'PAID']).default('UNPAID'),
  dueDate: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
});

export const EXPENSE_CATEGORIES = [
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

export const expenseSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  category: z.string().trim().min(1, 'Choose a category').max(100),
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0'),
  date: z.string().trim().min(1, 'Date is required'),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const paymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0'),
  paymentDate: z.string().trim().optional().or(z.literal('')),
  method: z
    .enum(['CASH', 'UPI', 'BANK', 'CARD', 'CHEQUE', 'OTHER'])
    .default('CASH'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});
