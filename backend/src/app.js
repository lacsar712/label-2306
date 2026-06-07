const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const memberRoutes = require('./routes/members');
const systemRoutes = require('./routes/system');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/system', systemRoutes);
// Compatibility for /api/stats which was at /api/stats in index.js
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
