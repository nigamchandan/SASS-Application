const prisma = require('../lib/prisma');
const { hashPassword, comparePassword } = require('../utils/password');
const { signAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, 'Email is already registered');

  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  });

  const token = signAccessToken({ sub: user.id, email: user.email });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user: sanitizeUser(user), token },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const matches = await comparePassword(password, user.password);
  if (!matches) throw new ApiError(401, 'Invalid email or password');

  const token = signAccessToken({ sub: user.id, email: user.email });

  res.json({
    success: true,
    message: 'Logged in successfully',
    data: { user: sanitizeUser(user), token },
  });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

module.exports = { register, login, me };
