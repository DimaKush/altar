import { main } from './indexer';
import { startServer } from './api';
import logger from './logger';

const PORT = parseInt(process.env.PORT || '3003', 10);

async function start() {
  try {
    // Start API server
    await startServer(PORT);
    logger.info(`Server started on port ${PORT}`);

    // Start indexer
    await main();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start(); 