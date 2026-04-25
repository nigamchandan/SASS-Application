const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  listPaymentsQuerySchema,
} = require('../validators/payment.validators');
const paymentController = require('../controllers/payment.controller');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  validate(listPaymentsQuerySchema, 'query'),
  paymentController.listAll
);
router.get(
  '/summary',
  validate(listPaymentsQuerySchema, 'query'),
  paymentController.summary
);
router.get('/export.csv', paymentController.exportCsv);
router.get('/export.pdf', paymentController.exportPdf);
router.delete('/:id', paymentController.removeById);

module.exports = router;
