const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const memberRoutes = require('./routes/members');
const systemRoutes = require('./routes/system');
const transactionRoutes = require('./routes/transactions');
const auditLogRoutes = require('./routes/auditLogs');
const tagRoutes = require('./routes/tags');
const couponRoutes = require('./routes/coupons');
const notificationRoutes = require('./routes/notifications');
const exportRoutes = require('./routes/exports');
const birthdayRoutes = require('./routes/birthdays');
const shopRoutes = require('./routes/shop');
const levelBenefitRoutes = require('./routes/levelBenefits');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/birthdays', birthdayRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/level-benefits', levelBenefitRoutes);
app.use('/api', systemRoutes); 

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(`${err.message}\n${err.stack}`);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
