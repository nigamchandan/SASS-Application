const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const {
  registerSchema,
  loginSchema,
} = require('../validators/auth.validators');
const {
  register,
  login,
  me,
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', requireAuth, me);

module.exports = router;
