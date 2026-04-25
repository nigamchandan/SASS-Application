const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');
const {
  summaryQuerySchema,
  revenueQuerySchema,
  recentInvoicesQuerySchema,
  topCustomersQuerySchema,
  activityQuerySchema,
  alertsQuerySchema,
} = require('../validators/dashboard.validators');

const router = express.Router();

router.use(requireAuth);

router.get('/stats', dashboardController.getStats);
router.get(
  '/summary',
  validate(summaryQuerySchema, 'query'),
  dashboardController.getSummary
);
router.get(
  '/revenue',
  validate(revenueQuerySchema, 'query'),
  dashboardController.getRevenue
);
router.get(
  '/recent-invoices',
  validate(recentInvoicesQuerySchema, 'query'),
  dashboardController.getRecentInvoices
);
router.get('/invoice-status', dashboardController.getInvoiceStatus);
router.get(
  '/top-customers',
  validate(topCustomersQuerySchema, 'query'),
  dashboardController.getTopCustomers
);
router.get(
  '/activity',
  validate(activityQuerySchema, 'query'),
  dashboardController.getActivity
);
router.get(
  '/alerts',
  validate(alertsQuerySchema, 'query'),
  dashboardController.getAlerts
);

module.exports = router;
