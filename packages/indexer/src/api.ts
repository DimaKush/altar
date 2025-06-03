import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import logger from './logger';
import dbPromise from './db';

const app = express();

// Enable CORS for Next.js app
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

interface Blesed {
  address: string;
  bles_token: string;
  stream_id: number;
  referral: string | null;
  created_at: number;
  updated_at: number;
  total_transfers: number;
}

interface Holder {
  address: string;
  bles_token: string;
  balance: string;
  updated_at: number;
}

interface Pair {
  address: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  price: string;
  updated_at: number;
}

const getAllBlesedHandler: RequestHandler = async (req, res) => {
  try {
    const db = await dbPromise;
    const blesed = await db.all(`
      SELECT * FROM blesed 
      ORDER BY created_at DESC
    `) as Blesed[];

    // Get holders for each blesed
    const blesedWithHolders = await Promise.all(blesed.map(async (b: Blesed) => {
      const holders = await db.all(`
        SELECT address, balance 
        FROM holders 
        WHERE bles_token = ? 
        ORDER BY CAST(balance AS UNSIGNED) DESC
      `, [b.bles_token]) as Holder[];

      return {
        ...b,
        holders: holders.map((h: Holder) => ({
          address: h.address,
          balance: h.balance
        }))
      };
    }));

    res.json(blesedWithHolders);
  } catch (error) {
    logger.error('Error fetching all blesed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getBlesedHandler: RequestHandler<{ address: string }> = async (req, res) => {
  try {
    const { address } = req.params;
    const db = await dbPromise;
    const blesed = await db.all(`
      SELECT * FROM blesed 
      WHERE address = ? 
      ORDER BY created_at DESC
    `, [address]) as Blesed[];

    if (!blesed.length) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    // Get holders for each blesed
    const blesedWithHolders = await Promise.all(blesed.map(async (b: Blesed) => {
      const holders = await db.all(`
        SELECT address, balance 
        FROM holders 
        WHERE bles_token = ? 
        ORDER BY CAST(balance AS UNSIGNED) DESC
      `, [b.bles_token]) as Holder[];

      return {
        ...b,
        holders: holders.map((h: Holder) => ({
          address: h.address,
          balance: h.balance
        }))
      };
    }));

    res.json(blesedWithHolders);
  } catch (error) {
    logger.error('Error fetching blesed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllPairsHandler: RequestHandler = async (req, res) => {
  try {
    const db = await dbPromise;
    const pairs = await db.all(`
      SELECT * FROM pairs 
      ORDER BY updated_at DESC
    `) as Pair[];

    res.json(pairs);
  } catch (error) {
    logger.error('Error fetching all pairs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPairsHandler: RequestHandler<{ address: string }> = async (req, res) => {
  try {
    const { address } = req.params;
    const db = await dbPromise;
    const pairs = await db.all(`
      SELECT * FROM pairs 
      WHERE address = ? 
      ORDER BY updated_at DESC
    `, [address]) as Pair[];

    if (!pairs.length) {
      res.status(404).json({ error: 'Pair not found' });
      return;
    }

    res.json(pairs);
  } catch (error) {
    logger.error('Error fetching pairs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Добавим новый API эндпоинт для получения всех L2 деплойментов для конкретного L1 токена
app.get('/api/superbles/:l1TokenAddress', async (req, res) => {
  try {
    const { l1TokenAddress } = req.params;
    const db = await dbPromise;
    
    const deployments = await db.all(`
      SELECT chain_id, l2_token, deployer, salt, created_at
      FROM superbles_deployments
      WHERE l1_token = ?
    `, [l1TokenAddress]);
    
    res.json(deployments);
  } catch (error) {
    logger.error('Error fetching superbles deployments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API для получения всех деплойментов (можно ограничить по последним N деплойментам)
app.get('/api/superbles', async (req, res) => {
  try {
    const db = await dbPromise;
    
    const deployments = await db.all(`
      SELECT l1_token, chain_id, l2_token, deployer, salt, created_at
      FROM superbles_deployments
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    res.json(deployments);
  } catch (error) {
    logger.error('Error fetching all superbles deployments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API для получения соли для конкретного L1 токена
app.get('/api/superbles/:l1TokenAddress/salt', async (req, res) => {
  try {
    const { l1TokenAddress } = req.params;
    const db = await dbPromise;
    
    // Ищем любой деплоймент с этим L1 токеном для получения соли
    const deployment = await db.get(`
      SELECT salt
      FROM superbles_deployments
      WHERE l1_token = ?
      LIMIT 1
    `, [l1TokenAddress]) as { salt: string } | undefined;
    
    if (!deployment) {
      return res.status(404).json({ error: 'No deployments found for this token' });
    }
    
    res.json({ salt: deployment.salt });
  } catch (error) {
    logger.error('Error fetching salt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/blesed', getAllBlesedHandler);
app.get('/api/pairs', getAllPairsHandler);
app.get('/api/blesed/:address', getBlesedHandler);
app.get('/api/pairs/:address', getPairsHandler);

export async function startServer(port: number) {
  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      logger.info(`API server listening on port ${port}`);
      resolve();
    });
  });
}

// Start server if this file is run directly
if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3002', 10);
  startServer(PORT).catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
} 