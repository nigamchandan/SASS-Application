const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const prisma = require('../lib/prisma');

async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Missing or invalid Authorization header');
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (_err) {
      throw new ApiError(401, 'Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!user) throw new ApiError(401, 'User no longer exists');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
