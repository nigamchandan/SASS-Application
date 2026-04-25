const express = require('express');

const validate = require('../middleware/validate.middleware');
const { requireAuth } = require('../middleware/auth.middleware');
const { uploadLogo } = require('../middleware/upload.middleware');
const {
  updateBusinessProfileSchema,
  updateInvoiceSettingsSchema,
  changePasswordSchema,
} = require('../validators/settings.validators');
const settingsController = require('../controllers/settings.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', settingsController.get);

router.put(
  '/profile',
  validate(updateBusinessProfileSchema),
  settingsController.updateProfile
);

router.put(
  '/invoice',
  validate(updateInvoiceSettingsSchema),
  settingsController.updateInvoiceSettings
);

router.post('/logo', uploadLogo.single('logo'), settingsController.uploadLogo);
router.delete('/logo', settingsController.removeLogo);

router.post(
  '/password',
  validate(changePasswordSchema),
  settingsController.changePassword
);

module.exports = router;
