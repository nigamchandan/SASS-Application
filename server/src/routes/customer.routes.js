const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersQuerySchema,
} = require('../validators/customer.validators');
const customerController = require('../controllers/customer.controller');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  validate(listCustomersQuerySchema, 'query'),
  customerController.list
);
router.get('/export.csv', customerController.exportCsv);
router.get('/export.pdf', customerController.exportPdf);
router.post(
  '/',
  validate(createCustomerSchema),
  customerController.create
);
router.get('/:id', customerController.getOne);
router.get('/:id/summary', customerController.getSummary);
router.patch(
  '/:id',
  validate(updateCustomerSchema),
  customerController.update
);
router.delete('/:id', customerController.remove);

module.exports = router;
