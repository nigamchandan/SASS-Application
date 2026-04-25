const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = require('../lib/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const PROFILE_DEFAULTS = {
  businessName: null,
  address: null,
  phone: null,
  email: null,
  gstNumber: null,
  logoUrl: null,
  currency: 'INR',
  invoicePrefix: 'INV',
  defaultTaxRate: 0,
  defaultDueDays: 0,
  invoiceFooterNote: null,
  whatsappReminderEnabled: true,
  emailNotifications: true,
};

async function getOrCreateProfile(userId) {
  const existing = await prisma.businessProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.businessProfile.create({
    data: { userId, ...PROFILE_DEFAULTS },
  });
}

const get = asyncHandler(async (req, res) => {
  const profile = await getOrCreateProfile(req.user.id);
  res.json({
    success: true,
    data: {
      profile,
      account: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  await getOrCreateProfile(req.user.id);

  const data = {};
  for (const key of [
    'businessName',
    'address',
    'phone',
    'email',
    'gstNumber',
    'currency',
    'invoiceFooterNote',
    'whatsappReminderEnabled',
    'emailNotifications',
  ]) {
    if (key in req.body) data[key] = req.body[key];
  }

  const profile = await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data,
  });

  res.json({
    success: true,
    message: 'Business profile updated',
    data: { profile },
  });
});

const updateInvoiceSettings = asyncHandler(async (req, res) => {
  await getOrCreateProfile(req.user.id);

  const data = {};
  for (const key of [
    'invoicePrefix',
    'defaultTaxRate',
    'defaultDueDays',
    'invoiceFooterNote',
    'currency',
  ]) {
    if (key in req.body) data[key] = req.body[key];
  }

  const profile = await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data,
  });

  res.json({
    success: true,
    message: 'Invoice settings updated',
    data: { profile },
  });
});

function buildLogoUrl(req, filename) {
  const proto = req.protocol;
  const host = req.get('host');
  return `${proto}://${host}/uploads/logos/${filename}`;
}

function localPathFromLogoUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/uploads/logos/')) return null;
    const file = path.basename(parsed.pathname);
    return path.join(__dirname, '..', '..', 'uploads', 'logos', file);
  } catch (_e) {
    return null;
  }
}

const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }
  const profile = await getOrCreateProfile(req.user.id);

  if (profile.logoUrl) {
    const oldPath = localPathFromLogoUrl(profile.logoUrl);
    if (oldPath && fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (_e) {
        /* ignore */
      }
    }
  }

  const logoUrl = buildLogoUrl(req, req.file.filename);
  const updated = await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data: { logoUrl },
  });

  res.json({
    success: true,
    message: 'Logo uploaded',
    data: { profile: updated },
  });
});

const removeLogo = asyncHandler(async (req, res) => {
  const profile = await getOrCreateProfile(req.user.id);
  if (profile.logoUrl) {
    const filePath = localPathFromLogoUrl(profile.logoUrl);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_e) {
        /* ignore */
      }
    }
  }
  const updated = await prisma.businessProfile.update({
    where: { userId: req.user.id },
    data: { logoUrl: null },
  });
  res.json({
    success: true,
    message: 'Logo removed',
    data: { profile: updated },
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new ApiError(404, 'User not found');

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new ApiError(400, 'Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
  });

  res.json({ success: true, message: 'Password updated' });
});

module.exports = {
  get,
  updateProfile,
  updateInvoiceSettings,
  uploadLogo,
  removeLogo,
  changePassword,
};
