import mysql from 'mysql2/promise';
import logger from './logger';

// MySQL connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'altar_indexer',
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
};

let pool: mysql.Pool;

// Initialize database connection pool
async function initDb() {
  logger.info('Initializing MySQL database...', { 
    host: dbConfig.host, 
    port: dbConfig.port, 
    database: dbConfig.database 
  });
  
  // Create connection pool
  pool = mysql.createPool(dbConfig);

  // Test connection
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('MySQL connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to MySQL:', error);
    throw error;
  }

  logger.info('Creating database tables...');

  // Create tables with MySQL syntax
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS blesed (
      address VARCHAR(42) PRIMARY KEY,
      bles_token VARCHAR(42) NOT NULL,
      stream_id BIGINT NOT NULL,
      referral VARCHAR(42) NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      total_transfers BIGINT DEFAULT 0,
      INDEX idx_bles_token (bles_token),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS holders (
      address VARCHAR(42) NOT NULL,
      bles_token VARCHAR(42) NOT NULL,
      balance TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (address, bles_token),
      INDEX idx_bles_token (bles_token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Create computed column index for balance separately (MySQL doesn't support CAST in CREATE TABLE index)
  try {
    await pool.execute(`
      CREATE INDEX idx_balance_numeric ON holders (bles_token, (CAST(balance AS UNSIGNED)))
    `);
  } catch (error: any) {
    // Index might already exist, ignore error
    if (!error.message.includes('Duplicate key name')) {
      logger.warn('Failed to create balance index:', error.message);
    }
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pairs (
      address VARCHAR(42) PRIMARY KEY,
      token0 VARCHAR(42) NOT NULL,
      token1 VARCHAR(42) NOT NULL,
      reserve0 TEXT NOT NULL,
      reserve1 TEXT NOT NULL,
      price TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      INDEX idx_token0 (token0),
      INDEX idx_token1 (token1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS processed_blocks (
      block_number BIGINT PRIMARY KEY,
      processed_at BIGINT NOT NULL,
      INDEX idx_processed_at (processed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS superbles_deployments (
      l1_token VARCHAR(42) NOT NULL,
      chain_id INT NOT NULL,
      l2_token VARCHAR(42) NOT NULL,
      deployer VARCHAR(42) NOT NULL,
      salt VARCHAR(66) NOT NULL,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (l1_token, chain_id),
      INDEX idx_l2_token (l2_token),
      INDEX idx_chain_id (chain_id),
      INDEX idx_deployer (deployer)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS l2_processed_blocks (
      chain_id INT NOT NULL,
      block_number BIGINT NOT NULL,
      processed_at BIGINT NOT NULL,
      PRIMARY KEY (chain_id, block_number),
      INDEX idx_processed_at (processed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS l2_token_transfers (
      chain_id INT NOT NULL,
      l2_token VARCHAR(42) NOT NULL,
      from_address VARCHAR(42) NOT NULL,
      to_address VARCHAR(42) NOT NULL,
      amount TEXT NOT NULL,
      tx_hash VARCHAR(66) NOT NULL,
      block_number BIGINT NOT NULL,
      block_timestamp BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (chain_id, tx_hash, from_address, to_address),
      INDEX idx_l2_token (l2_token),
      INDEX idx_block_number (block_number),
      INDEX idx_from_address (from_address),
      INDEX idx_to_address (to_address)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS l2_token_holders (
      chain_id INT NOT NULL,
      l2_token VARCHAR(42) NOT NULL,
      holder_address VARCHAR(42) NOT NULL,
      balance TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (chain_id, l2_token, holder_address),
      INDEX idx_holder (holder_address),
      INDEX idx_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  logger.info('Database tables created successfully');
  return pool;
}

// Database wrapper to mimic sqlite interface
class DatabaseWrapper {
  private pool: mysql.Pool;

  constructor(pool: mysql.Pool) {
    this.pool = pool;
  }

  async run(sql: string, params: any[] = []) {
    const [result] = await this.pool.execute(sql, params);
    return result;
  }

  async get(sql: string, params: any[] = []) {
    const [rows] = await this.pool.execute(sql, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined;
  }

  async all(sql: string, params: any[] = []) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async exec(sql: string) {
    // Split multiple statements and execute them separately
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      if (statement.trim()) {
        await this.pool.execute(statement);
      }
    }
  }

  async close() {
    await this.pool.end();
  }
}

// Initialize database and return wrapper
async function ensureDb() {
  if (!pool) {
    await initDb();
  }
  return new DatabaseWrapper(pool);
}

// Recreate database (drop and recreate tables)
export async function recreateDb() {
  logger.info('Recreating database...');
  
  if (pool) {
    await pool.end();
  }
  
  await initDb();
  return new DatabaseWrapper(pool);
}

// Create and export database instance
const dbPromise = ensureDb();

export default dbPromise; 