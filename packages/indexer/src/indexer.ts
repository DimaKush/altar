import { createPublicClient, http, parseAbi, PublicClient } from 'viem';
import { sepolia, optimismSepolia, baseSepolia } from 'viem/chains';
import dbPromise from './db';
import logger from './logger';

const ALTAR_ADDRESS = '0x648a383965e25dee13ff93fdd86535038ee0ba96';
// const START_BLOCK = BigInt(8318048);
const START_BLOCK = BigInt(8430431);
const WETH_ADDRESS = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';
const UNISWAP_FACTORY = '0x7E0987E5b3a30e3f2828572Bb659A548460a3003';
const TORCH_ADDRESS = '0x05208B8beEc0A684c16412fa5b65134A5Aba09bD' as `0x${string}`;

const altarAbi = parseAbi([
  'event Blesed(address indexed blesed, address indexed blesToken, uint256 blesAmount, uint256 torchAmount, uint256 liquidity, uint256 streamId, address referral, uint256 referralAmount)',
  'event Refilled(address indexed refiller, uint256 amount, uint256 ethAmount)'
]);

const pairAbi = parseAbi([
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)'
]);

const factoryAbi = parseAbi([
  'function getPair(address tokenA, address tokenB) external view returns (address pair)'
]);

const erc20Abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

const CREATE_X_ADDRESS = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed";
const createXAbi = parseAbi([
  "event ContractCreation(address indexed contractAddress, bytes32 indexed salt)"
]);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http()
});

// Track blesTokens to monitor
const trackedBlesTokens = new Set<`0x${string}`>();

// Для каждой L2 сети создаем publicClient
const l2Clients: Record<number, any> = {
  11155420: createPublicClient({ // OP Sepolia
    chain: optimismSepolia,
    transport: http()
  }),
  84532: createPublicClient({ // Base Sepolia
    chain: baseSepolia,
    transport: http()
  }),
  // Добавить другие L2 сети
};

async function processBlock(blockNumber: bigint) {
  const block = await publicClient.getBlock({ blockNumber });
  if (!block) return;

  const db = await dbPromise;

  // Get Blesed events
  const blesedLogs = await publicClient.getLogs({
    address: ALTAR_ADDRESS,
    event: altarAbi[0],
    fromBlock: blockNumber,
    toBlock: blockNumber
  });

  logger.info('Processing block', { 
    blockNumber: blockNumber.toString(),
    eventsFound: blesedLogs.length,
    blockHash: block.hash,
    blockTimestamp: block.timestamp
  });

  // Process Blesed events
  for (const log of blesedLogs) {
    logger.info('Found Blesed event', { 
      blesed: log.args.blesed,
      blesToken: log.args.blesToken,
      streamId: log.args.streamId?.toString()
    });
    
    const { blesed, blesToken, streamId, referral } = log.args;
    if (blesed && blesToken && streamId) {
      // Add blesToken to tracked tokens
      trackedBlesTokens.add(blesToken);

      // Insert into database
      await db.run(`
        INSERT INTO blesed (
          address, bles_token, stream_id, referral, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          bles_token = VALUES(bles_token),
          stream_id = VALUES(stream_id),
          referral = VALUES(referral),
          updated_at = VALUES(updated_at)
      `, [
        blesed,
        blesToken,
        Number(streamId),
        referral,
        Number(block.timestamp),
        Number(block.timestamp)
      ]);
    }
  }

  // Process Transfer events for tracked blesTokens and TORCH
  const tokensToTrack = [...trackedBlesTokens, TORCH_ADDRESS];
  for (const token of tokensToTrack) {
    const transferLogs = await publicClient.getLogs({
      address: token,
      event: erc20Abi[0],
      fromBlock: blockNumber,
      toBlock: blockNumber
    });

    // Sort transfer logs by logIndex to ensure chronological order
    transferLogs.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return Number(a.blockNumber) - Number(b.blockNumber);
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex;
      }
      return a.logIndex - b.logIndex;
    });

    for (const log of transferLogs) {
      const { from, to, value } = log.args;
      if (from && to && value) {
        logger.info('Processing Transfer', {
          token: token.slice(0, 8) + '...',
          from: from.slice(0, 8) + '...',
          to: to.slice(0, 8) + '...',
          value: value.toString(),
          logIndex: log.logIndex,
          txIndex: log.transactionIndex
        });

        // Update balances for both from and to addresses
        
        // Handle the 'to' address (receiving tokens)
        const currentToBalance = await db.get(`
          SELECT balance FROM holders 
          WHERE address = ? AND bles_token = ?
        `, [to, token]) as { balance: string } | undefined;
        
        const newToBalance = BigInt(currentToBalance?.balance || '0') + value;
        
        await db.run(`
          INSERT INTO holders (
            address, bles_token, balance, updated_at
          ) VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            balance = VALUES(balance),
            updated_at = VALUES(updated_at)
        `, [
          to,
          token,
          newToBalance.toString(),
          Number(block.timestamp)
        ]);

        // Handle the 'from' address (sending tokens), but only if it's not a mint (from != 0x0)
        if (from !== '0x0000000000000000000000000000000000000000') {
          const currentFromBalance = await db.get(`
            SELECT balance FROM holders 
            WHERE address = ? AND bles_token = ?
          `, [from, token]) as { balance: string } | undefined;
          
          if (currentFromBalance) {
            const newFromBalance = BigInt(currentFromBalance.balance) - value;
            
            // Only update if balance is positive, otherwise remove the holder
            if (newFromBalance > 0n) {
              await db.run(`
                UPDATE holders 
                SET balance = ?, updated_at = ?
                WHERE address = ? AND bles_token = ?
              `, [
                newFromBalance.toString(),
                Number(block.timestamp),
                from,
                token
              ]);
            } else {
              await db.run(`
                DELETE FROM holders 
                WHERE address = ? AND bles_token = ?
              `, [from, token]);
            }
          }
        }

        // Update total_transfers count for blesTokens only
        if (token !== TORCH_ADDRESS) {
          await db.run(`
            UPDATE blesed 
            SET total_transfers = total_transfers + 1,
                updated_at = ?
            WHERE bles_token = ?
          `, [Number(block.timestamp), token]);
        }
      }
    }
  }

  // Mark block as processed
  await db.run(`
    INSERT INTO processed_blocks (block_number, processed_at)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      processed_at = VALUES(processed_at)
  `, [Number(blockNumber), Number(block.timestamp)]);
}

// Функция для проверки и создания таблицы l2_processed_blocks, если ее нет
async function ensureL2Tables() {
  const db = await dbPromise;
  
  try {
    // Проверяем, существует ли таблица, пытаясь выполнить запрос
    await db.get('SELECT 1 FROM l2_processed_blocks LIMIT 1');
    logger.info('Table l2_processed_blocks exists');
  } catch (error) {
    // Если таблица не существует, создаем ее
    logger.info('Creating l2_processed_blocks table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS l2_processed_blocks (
        chain_id INTEGER NOT NULL,
        block_number INTEGER NOT NULL,
        processed_at INTEGER NOT NULL,
        PRIMARY KEY (chain_id, block_number)
      );
    `);
    logger.info('Table l2_processed_blocks created successfully');
  }
  
  try {
    // Check if l2_token_transfers table exists
    await db.get('SELECT 1 FROM l2_token_transfers LIMIT 1');
    logger.info('Table l2_token_transfers exists');
  } catch (error) {
    // Create table if it doesn't exist
    logger.info('Creating l2_token_transfers table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS l2_token_transfers (
        chain_id INTEGER NOT NULL,
        l2_token TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        block_timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (chain_id, tx_hash, from_address, to_address)
      );
    `);
    logger.info('Table l2_token_transfers created successfully');
  }
  
  try {
    // Check if l2_token_holders table exists
    await db.get('SELECT 1 FROM l2_token_holders LIMIT 1');
    logger.info('Table l2_token_holders exists');
  } catch (error) {
    // Create table if it doesn't exist
    logger.info('Creating l2_token_holders table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS l2_token_holders (
        chain_id INTEGER NOT NULL,
        l2_token TEXT NOT NULL,
        holder_address TEXT NOT NULL,
        balance TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (chain_id, l2_token, holder_address)
      );
    `);
    logger.info('Table l2_token_holders created successfully');
  }
}

// Export main function
export async function main() {
  const db = await dbPromise;

  // Убедимся, что таблица l2_processed_blocks существует
  await ensureL2Tables();

  // Get last processed block
  const lastProcessed = await db.get(`
    SELECT block_number FROM processed_blocks 
    ORDER BY block_number DESC LIMIT 1
  `) as { block_number: number } | undefined;

  let currentBlock = (lastProcessed && lastProcessed.block_number > START_BLOCK) ? BigInt(lastProcessed.block_number) + BigInt(1) : START_BLOCK;

  logger.info('Starting indexer', {
    currentBlock: currentBlock.toString()
  });

  // Первоначальный запуск отслеживания L2 деплойментов с таймаутом
  try {
    logger.info('Starting initial L2 tracking...');
    const trackL2Promise = trackL2Deployments();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout in initial L2 tracking')), 60000) // 60 секунд таймаут
    );
    
    await Promise.race([trackL2Promise, timeoutPromise]);
    logger.info('Initial L2 tracking completed successfully');
  } catch (error) {
    logger.error(`Initial L2 tracking failed: ${error}`);
    // Продолжаем работу даже при ошибке L2 индексирования
  }

  // Переменная для отслеживания времени последнего выполнения L2 трекинга
  let lastL2TrackingTime = Date.now();
  const L2_TRACKING_INTERVAL = 60000; // Проверять L2 каждую минуту

  while (true) {
    try {
      const latestBlock = await publicClient.getBlockNumber();
      
      if (currentBlock <= latestBlock) {
        // Обрабатываем L1 блоки пакетами по 1000
        const batchEndBlock = currentBlock + BigInt(999) > latestBlock ? latestBlock : currentBlock + BigInt(999);
        
        logger.info(`Processing L1 blocks from ${currentBlock} to ${batchEndBlock}`);
        
        // Обработка пакета блоков
        for (let blockNum = currentBlock; blockNum <= batchEndBlock; blockNum++) {
          await processBlock(blockNum);
        }
        
        // Обновляем текущий блок после обработки пакета
        currentBlock = batchEndBlock + BigInt(1);
        
        // Проверяем, прошла ли минута с последнего L2 трекинга
        const currentTime = Date.now();
        if (currentTime - lastL2TrackingTime >= L2_TRACKING_INTERVAL) {
          try {
            logger.info('Starting periodic L2 tracking...');
            const trackL2Promise = trackL2Deployments();
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout in L2 tracking')), 60000) // 60 секунд таймаут
            );
            
            await Promise.race([trackL2Promise, timeoutPromise]);
            logger.info('Periodic L2 tracking completed successfully');
            lastL2TrackingTime = currentTime; // Обновляем время последнего успешного трекинга
          } catch (error) {
            logger.error(`L2 tracking failed: ${error}`);
            // Обновляем время последнего трекинга даже при ошибке,
            // чтобы не пытаться выполнять его слишком часто при постоянных ошибках
            lastL2TrackingTime = currentTime;
          }
        }
      } else {
        // Wait for new blocks
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Проверяем L2 при ожидании новых L1 блоков, если прошло достаточно времени
        const currentTime = Date.now();
        if (currentTime - lastL2TrackingTime >= L2_TRACKING_INTERVAL) {
          try {
            logger.info('Starting L2 tracking while waiting for new L1 blocks...');
            await trackL2Deployments();
            logger.info('L2 tracking while waiting completed successfully');
            lastL2TrackingTime = currentTime;
          } catch (error) {
            logger.error(`L2 tracking failed while waiting: ${error}`);
            lastL2TrackingTime = currentTime;
          }
        }
      }
    } catch (error) {
      logger.error(`Error in main indexer loop: ${error}`);
      // Добавляем паузу при ошибке
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Check specific block
async function checkBlock(blockNumber: bigint) {
  const block = await publicClient.getBlock({ blockNumber });
  if (!block) {
    logger.error('Block not found', { blockNumber: blockNumber.toString() });
    return;
  }

  logger.info('Block info', {
    blockNumber: blockNumber.toString(),
    blockHash: block.hash,
    timestamp: block.timestamp,
    transactions: block.transactions.length
  });

  // Get Blesed events
  const blesedLogs = await publicClient.getLogs({
    address: ALTAR_ADDRESS,
    event: altarAbi[0],
    fromBlock: blockNumber,
    toBlock: blockNumber
  });

  logger.info('Found events', {
    blockNumber: blockNumber.toString(),
    eventsCount: blesedLogs.length,
    events: blesedLogs.map(log => ({
      blesed: log.args.blesed,
      blesToken: log.args.blesToken,
      streamId: log.args.streamId?.toString()
    }))
  });
}

// Check block 8318048
// checkBlock(BigInt(8318048)).catch(console.error);

// Функция для проверки Superbles и получения L1 токена
async function checkSuperbles(chainId: number, address: `0x${string}`) {
  try {
    logger.info(`Checking Superbles at ${address} on chain ${chainId}`);
    
    const client = l2Clients[chainId];
    if (!client) {
      logger.error(`No client found for chain ${chainId}`);
      return null;
    }
    
    // Попытка вызвать метод l1token() на предполагаемом Superbles контракте
    try {
      const l1TokenAddressPromise = client.readContract({
        address,
        abi: parseAbi(['function l1Token() external view returns (address)']),
        functionName: 'l1Token'
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout reading l1Token from ${address} on chain ${chainId}`)), 10000)
      );
      
      const l1TokenAddress = await Promise.race([l1TokenAddressPromise, timeoutPromise]) as `0x${string}`;
      
      logger.info(`Successfully read l1Token for ${address} on chain ${chainId}: ${l1TokenAddress}`);
      return l1TokenAddress;
    } catch (error) {
      logger.error(`Failed to read l1Token for ${address} on chain ${chainId}: ${error}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error in checkSuperbles for ${address} on chain ${chainId}: ${error}`);
    return null;
  }
}

// Отслеживание событий CreateX на L2 сетях
async function trackL2Deployments() {
  try {
    logger.info('Starting L2 deployments tracking...');
    logger.info(`Available L2 networks: ${Object.keys(l2Clients).join(', ')}`);
    
    // Проверка доступности RPC провайдеров
    for (const [chainIdStr, client] of Object.entries(l2Clients)) {
      try {
        const chainId = parseInt(chainIdStr);
        logger.info(`Testing connection to chain ${chainId}...`);
        
        const blockNumberPromise = client.getBlockNumber();
        const timeoutPromise = new Promise<bigint>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout testing connection to chain ${chainId}`)), 5000)
        );
        
        const blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]);
        logger.info(`Connection to chain ${chainId} successful, current block: ${blockNumber}`);
      } catch (error) {
        logger.error(`Failed to connect to chain ${chainIdStr}: ${error}`);
      }
    }
    
    const db = await dbPromise;
    
    for (const [chainIdStr, client] of Object.entries(l2Clients)) {
      const chainId = parseInt(chainIdStr);
      
      try {
        logger.info(`Processing chain ${chainId}...`);
        
        // Получаем последний обработанный блок для этой сети
        const lastProcessed = await db.get(`
          SELECT block_number FROM l2_processed_blocks 
          WHERE chain_id = ? ORDER BY block_number DESC LIMIT 1
        `, [chainId]) as { block_number: number } | undefined;
        
        logger.info(`Chain ${chainId}: last processed block: ${lastProcessed?.block_number || 'none'}`);
        
        let startBlock: bigint;
        
        try {
          // Устанавливаем таймаут для получения номера последнего блока
          const latestBlockPromise = client.getBlockNumber();
          const timeoutPromise = new Promise<bigint>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout getting latest block for chain ${chainId}`)), 10000)
          );
          
          const latestBlock = await Promise.race([latestBlockPromise, timeoutPromise]) as bigint;
          logger.info(`Chain ${chainId}: latest block is ${latestBlock}`);
          
          // Если это первый запуск, начинаем с последнего блока минус MAX_BACKTRACK_BLOCKS
          const MAX_BACKTRACK_BLOCKS = 10000n; // Максимальное количество блоков для обратного сканирования
          startBlock = lastProcessed 
            ? BigInt(lastProcessed.block_number) + BigInt(1) 
            : latestBlock > MAX_BACKTRACK_BLOCKS 
              ? latestBlock - MAX_BACKTRACK_BLOCKS 
              : BigInt(0);
              
          logger.info(`Chain ${chainId}: starting from block ${startBlock}`);
          
          // Ограничиваем количество блоков для обработки за один раз
          const MAX_BLOCKS_PER_BATCH = 5000n;
          const endBlock = startBlock + MAX_BLOCKS_PER_BATCH > latestBlock 
            ? latestBlock 
            : startBlock + MAX_BLOCKS_PER_BATCH;
          
          if (startBlock >= latestBlock) {
            logger.info(`Chain ${chainId}: already up to date, skipping`);
            continue;
          }
          
          logger.info(`Chain ${chainId}: processing blocks from ${startBlock} to ${endBlock}`);

          // Get all L2 tokens for this chain from the database
          const l2Tokens = await db.all(`
            SELECT l2_token FROM superbles_deployments WHERE chain_id = ?
          `, [chainId]) as { l2_token: string }[];
          
          if (l2Tokens.length > 0) {
            logger.info(`Chain ${chainId}: tracking ${l2Tokens.length} token(s)`);
            
            // Process transfers for all L2 tokens (in batches of 100 blocks)
            for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber += BigInt(100)) {
              const batchEnd = blockNumber + BigInt(99) > endBlock ? endBlock : blockNumber + BigInt(99);
              
              try {
                // Process each token's transfer events
                for (const tokenRecord of l2Tokens) {
                  const l2Token = tokenRecord.l2_token as `0x${string}`;
                  
                  // Fetch transfer events
                  try {
                    logger.info(`Chain ${chainId}: fetching transfers for token ${l2Token} from blocks ${blockNumber}-${batchEnd}`);
                    
                    const transferLogsPromise = client.getLogs({
                      address: l2Token,
                      event: erc20Abi[0],
                      fromBlock: blockNumber,
                      toBlock: batchEnd
                    });
                    
                    const logsTimeoutPromise = new Promise((_, reject) => 
                      setTimeout(() => reject(new Error(`Timeout getting transfer logs for token ${l2Token} on chain ${chainId}`)), 15000)
                    );
                    
                    const transferLogs = await Promise.race([transferLogsPromise, logsTimeoutPromise]);
                    
                    if (transferLogs.length > 0) {
                      logger.info(`Chain ${chainId}: found ${transferLogs.length} transfers for token ${l2Token}`);
                      
                      // Get block timestamps for these transfers (to avoid fetching block for each transfer)
                      const blockTimestamps = new Map<bigint, bigint>();
                      
                      // Process transfer events
                      for (const log of transferLogs) {
                        const { from, to, value } = log.args;
                        
                        if (from && to && value) {
                          // Get block timestamp if not already cached
                          if (!blockTimestamps.has(log.blockNumber)) {
                            try {
                              const block = await client.getBlock({ blockNumber: log.blockNumber });
                              if (block) {
                                blockTimestamps.set(log.blockNumber, block.timestamp);
                              }
                            } catch (error) {
                              logger.error(`Failed to get block ${log.blockNumber} on chain ${chainId}: ${error}`);
                              // Use current timestamp as fallback
                              blockTimestamps.set(log.blockNumber, BigInt(Math.floor(Date.now() / 1000)));
                            }
                          }
                          
                          const timestamp = blockTimestamps.get(log.blockNumber) || BigInt(Math.floor(Date.now() / 1000));
                          
                          // Store transfer in database
                          await db.run(`
                            INSERT INTO l2_token_transfers (
                              chain_id, l2_token, from_address, to_address, amount, 
                              tx_hash, block_number, block_timestamp, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                              amount = VALUES(amount),
                              block_timestamp = VALUES(block_timestamp),
                              created_at = VALUES(created_at)
                          `, [
                            chainId,
                            l2Token,
                            from,
                            to,
                            value.toString(),
                            log.transactionHash,
                            Number(log.blockNumber),
                            Number(timestamp),
                            Math.floor(Date.now() / 1000)
                          ]);
                          
                          // Update token holder balances
                          // For 'to' address
                          let toBalance = await db.get(`
                            SELECT balance FROM l2_token_holders 
                            WHERE chain_id = ? AND l2_token = ? AND holder_address = ?
                          `, [chainId, l2Token, to]) as { balance: string } | undefined;
                          
                          const newToBalance = BigInt(toBalance?.balance || '0') + value;
                          
                          await db.run(`
                            INSERT INTO l2_token_holders (
                              chain_id, l2_token, holder_address, balance, updated_at
                            ) VALUES (?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                              balance = VALUES(balance),
                              updated_at = VALUES(updated_at)
                          `, [
                            chainId,
                            l2Token,
                            to,
                            newToBalance.toString(),
                            Math.floor(Date.now() / 1000)
                          ]);
                          
                          // For 'from' address, only if it's not a mint (from != 0x0)
                          if (from !== '0x0000000000000000000000000000000000000000') {
                            let fromBalance = await db.get(`
                              SELECT balance FROM l2_token_holders 
                              WHERE chain_id = ? AND l2_token = ? AND holder_address = ?
                            `, [chainId, l2Token, from]) as { balance: string } | undefined;
                            
                            if (fromBalance) {
                              const newFromBalance = BigInt(fromBalance.balance) - value;
                              
                              await db.run(`
                                INSERT INTO l2_token_holders (
                                  chain_id, l2_token, holder_address, balance, updated_at
                                ) VALUES (?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE
                                  balance = VALUES(balance),
                                  updated_at = VALUES(updated_at)
                              `, [
                                chainId,
                                l2Token,
                                from,
                                newFromBalance.toString(),
                                Math.floor(Date.now() / 1000)
                              ]);
                            }
                          }
                        }
                      }
                    }
                  } catch (error) {
                    logger.error(`Error processing transfers for token ${l2Token} on chain ${chainId}: ${error}`);
                  }
                }
              } catch (error) {
                logger.error(`Error processing L2 transfers for blocks ${blockNumber}-${batchEnd} on chain ${chainId}: ${error}`);
              }
            }
          } else {
            logger.info(`Chain ${chainId}: no tokens to track`);
          }
          
          // Обрабатываем блоки с CreateX событиями (пакетами по 100)
          for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber += BigInt(100)) {
            const batchEnd = blockNumber + BigInt(99) > endBlock ? endBlock : blockNumber + BigInt(99);
            
            try {
              logger.info(`Chain ${chainId}: fetching logs from ${blockNumber} to ${batchEnd}`);
              
              // Устанавливаем таймаут для получения логов
              const getLogsPromise = client.getLogs({
                address: CREATE_X_ADDRESS,
                event: createXAbi[0],
                fromBlock: blockNumber,
                toBlock: batchEnd
              });
              
              const logsTimeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout getting logs for chain ${chainId}`)), 30000)
              );
              
              const createXLogs = await Promise.race([getLogsPromise, logsTimeoutPromise]);
              
              logger.info(`Chain ${chainId}: found ${createXLogs.length} CreateX events`);
              
              for (const log of createXLogs) {
                const { contractAddress, salt } = log.args;
                
                // Проверяем, является ли контракт Superbles и преобразуем тип
                if (contractAddress) {
                  try {
                    logger.info(`Chain ${chainId}: checking if contract ${contractAddress} is Superbles...`);
                    const l1TokenAddress = await checkSuperbles(chainId, contractAddress);
                    
                    if (l1TokenAddress) {
                      // Получаем транзакцию, которая вызвала событие
                      let creator = '0x0000000000000000000000000000000000000000';
                      try {
                        const tx = await client.getTransaction({
                          hash: log.transactionHash
                        });
                        if (tx && tx.from) {
                          creator = tx.from;
                          logger.info(`Found creator for contract ${contractAddress}: ${creator}`);
                        }
                      } catch (error) {
                        logger.error(`Error getting transaction for hash ${log.transactionHash}: ${error}`);
                      }
                      
                      // Сохраняем в БД
                      await db.run(`
                        INSERT INTO superbles_deployments 
                        (l1_token, chain_id, l2_token, deployer, salt, created_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                          l2_token = VALUES(l2_token),
                          deployer = VALUES(deployer),
                          salt = VALUES(salt),
                          created_at = VALUES(created_at)
                      `, [
                        l1TokenAddress,
                        chainId,
                        contractAddress,
                        creator,
                        salt,
                        Math.floor(Date.now() / 1000)
                      ]);
                      
                      logger.info(`Found Superbles deployment: L1 ${l1TokenAddress} -> L2 ${contractAddress} on chain ${chainId} with salt ${salt} from ${creator}`);
                    } else {
                      logger.info(`Chain ${chainId}: contract ${contractAddress} is not a Superbles`);
                    }
                  } catch (error) {
                    logger.error(`Error checking if contract is Superbles: ${error}`);
                  }
                }
              }
              
              // Сохраняем обработанный блок - сохраняем в любом случае, даже если не нашли событий
              await db.run(`
                INSERT INTO l2_processed_blocks (chain_id, block_number, processed_at)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  processed_at = VALUES(processed_at)
              `, [chainId, Number(batchEnd), Math.floor(Date.now() / 1000)]);
              
            } catch (error) {
              logger.error(`Error processing blocks ${blockNumber}-${batchEnd} for chain ${chainId}: ${error}`);
              
              // Сохраняем последний успешно обработанный блок, чтобы не начинать сначала
              await db.run(`
                INSERT INTO l2_processed_blocks (chain_id, block_number, processed_at)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  processed_at = VALUES(processed_at)
              `, [chainId, Number(blockNumber) - 1, Math.floor(Date.now() / 1000)]);
            }
          }
        } catch (error) {
          logger.error(`Error processing chain ${chainId}: ${error}`);
        }
      } catch (error) {
        logger.error(`Unexpected error processing chain ${chainId}: ${error}`);
      }
    }
    
    logger.info('Finished L2 deployments tracking');
  } catch (error) {
    logger.error(`Critical error in trackL2Deployments: ${error}`);
  }
}

// Удаляем автоматический запуск
// main().catch(console.error); 