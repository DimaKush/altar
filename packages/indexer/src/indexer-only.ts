import { main } from './indexer';
import logger from './logger';

async function start() {
  try {
    logger.info('Starting Altar Protocol Indexer...');
    await main();
  } catch (error) {
    logger.error('Failed to start indexer:', error);
    process.exit(1);
  }
}

start(); 