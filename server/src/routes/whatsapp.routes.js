const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  listMessagesQuerySchema,
} = require('../validators/whatsapp.validators');
const whatsappController = require('../controllers/whatsapp.controller');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/messages',
  validate(listMessagesQuerySchema, 'query'),
  whatsappController.listAll
);
router.get(
  '/summary',
  validate(listMessagesQuerySchema, 'query'),
  whatsappController.summary
);
router.get('/export.csv', whatsappController.exportCsv);
router.get('/export.pdf', whatsappController.exportPdf);

module.exports = router;
