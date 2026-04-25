const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const expenseController = require('../controllers/expense.controller');
const {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  summaryQuerySchema,
} = require('../validators/expense.validators');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  validate(listExpensesQuerySchema, 'query'),
  expenseController.list
);
router.post('/', validate(createExpenseSchema), expenseController.create);
router.get(
  '/summary',
  validate(summaryQuerySchema, 'query'),
  expenseController.summary
);
router.get('/export.csv', expenseController.exportCsv);
router.get('/export.pdf', expenseController.exportPdf);
router.get('/:id', expenseController.getOne);
router.patch(
  '/:id',
  validate(updateExpenseSchema),
  expenseController.update
);
router.delete('/:id', expenseController.remove);

module.exports = router;
