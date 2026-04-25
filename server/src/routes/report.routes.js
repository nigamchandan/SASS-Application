const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const reportController = require('../controllers/report.controller');
const { reportRangeQuerySchema } = require('../validators/report.validators');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/summary',
  validate(reportRangeQuerySchema, 'query'),
  reportController.summary
);

router.get(
  '/export.csv',
  validate(reportRangeQuerySchema, 'query'),
  reportController.exportCsv
);

router.get(
  '/export.pdf',
  validate(reportRangeQuerySchema, 'query'),
  reportController.exportPdf
);

module.exports = router;
