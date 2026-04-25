const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  updateInvoiceSchema,
  listInvoicesQuerySchema,
} = require('../validators/invoice.validators');
const { createPaymentSchema } = require('../validators/payment.validators');
const {
  sendInvoiceSchema,
  sendReminderSchema,
} = require('../validators/whatsapp.validators');
const invoiceController = require('../controllers/invoice.controller');
const paymentController = require('../controllers/payment.controller');
const whatsappController = require('../controllers/whatsapp.controller');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  validate(listInvoicesQuerySchema, 'query'),
  invoiceController.list
);
router.get('/export.csv', invoiceController.exportCsv);
router.get('/export.pdf', invoiceController.exportPdf);
router.post('/', validate(createInvoiceSchema), invoiceController.create);
router.get('/:id', invoiceController.getOne);
router.get('/:id/pdf', invoiceController.downloadPdf);
router.put(
  '/:id',
  validate(updateInvoiceSchema),
  invoiceController.update
);
router.patch(
  '/:id/status',
  validate(updateInvoiceStatusSchema),
  invoiceController.updateStatus
);
router.delete('/:id', invoiceController.remove);

router.get('/:invoiceId/payments', paymentController.list);
router.post(
  '/:invoiceId/payments',
  validate(createPaymentSchema),
  paymentController.add
);
router.delete(
  '/:invoiceId/payments/:paymentId',
  paymentController.remove
);

router.get('/:id/whatsapp/preview', whatsappController.previewTemplates);
router.get('/:id/whatsapp/messages', whatsappController.list);
router.post(
  '/:id/whatsapp/send-invoice',
  validate(sendInvoiceSchema),
  whatsappController.sendInvoice
);
router.post(
  '/:id/whatsapp/send-reminder',
  validate(sendReminderSchema),
  whatsappController.sendReminder
);

module.exports = router;
