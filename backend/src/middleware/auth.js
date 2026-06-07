const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set!');
}

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

module.exports = {
  authenticate,
  isAdmin,
};
