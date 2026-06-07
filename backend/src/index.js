require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { initAuditConfigs } = require('./services/auditLog');
const port = process.env.PORT || 8000;

async function startServer() {
  try {
    await initAuditConfigs();
  } catch (err) {
    logger.warn('Failed to initialize audit configs', { error: err.message });
  }

  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}

startServer();
