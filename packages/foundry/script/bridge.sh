#!/bin/bash

# Check if supersim is running
if ! curl -s http://127.0.0.1:8545 > /dev/null; then
    echo "Error: L1 node is not running. Please start supersim first."
    exit 1
fi

# Set private key for account 1 (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Deploy Altar on L1
echo "Deploying Altar on L1..."
DEPLOY_OUTPUT=$(forge script script/DeployAltar.s.sol:DeployAltar --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PRIVATE_KEY --legacy)
echo "$DEPLOY_OUTPUT"
echo "$DEPLOY_OUTPUT" | grep -oE 'Transaction hash: (0x[a-fA-F0-9]+)' | awk '{print $3}' | while read -r tx; do
  echo "\n[LOGS] Altar Deploy tx: $tx"
  cast receipt $tx --rpc-url http://127.0.0.1:8545
  echo "-----------------------------"
done

# Check if Altar deployment was successful
if [ $? -ne 0 ]; then
    echo "Error: Altar deployment failed"
    exit 1
fi

# Mint BLES on L1 for deployer
echo "Minting BLES on L1 for deployer..."
MINT_OUTPUT=$(forge script script/MintBles.s.sol:MintBlesScript --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PRIVATE_KEY --legacy)
echo "$MINT_OUTPUT"
echo "$MINT_OUTPUT" | grep -oE 'Transaction hash: (0x[a-fA-F0-9]+)' | awk '{print $3}' | while read -r tx; do
  echo "\n[LOGS] MintBles tx: $tx"
  cast receipt $tx --rpc-url http://127.0.0.1:8545
  echo "-----------------------------"
done

# Check if MintBles was successful
if [ $? -ne 0 ]; then
    echo "Error: MintBles failed"
    exit 1
fi

# Deploy Superbles on all chains
echo "Deploying Superbles on all chains..."
SUPERBLES_OUTPUT=$(forge script script/DeploySuperbles.s.sol:DeploySuperblesScript --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PRIVATE_KEY --legacy)
echo "$SUPERBLES_OUTPUT"
echo "$SUPERBLES_OUTPUT" | grep -oE 'Transaction hash: (0x[a-fA-F0-9]+)' | awk '{print $3}' | while read -r tx; do
  echo "\n[LOGS] Superbles Deploy tx: $tx"
  cast receipt $tx --rpc-url http://127.0.0.1:8545
  echo "-----------------------------"
done

# Check if Superbles deployment was successful
if [ $? -ne 0 ]; then
    echo "Error: Superbles deployment failed"
    exit 1
fi

# Bridge tokens from L1 to L2
BRIDGE_L1L2_OUTPUT=$(forge script script/BridgeTokensL1ToL2.s.sol:BridgeTokensL1ToL2Script --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PRIVATE_KEY -vvv --legacy)
echo "$BRIDGE_L1L2_OUTPUT"
echo "$BRIDGE_L1L2_OUTPUT" | grep -oE 'Transaction hash: (0x[a-fA-F0-9]+)' | awk '{print $3}' | while read -r tx; do
  echo "\n[LOGS] Bridge L1->L2 tx: $tx"
  cast receipt $tx --rpc-url http://127.0.0.1:8545
  echo "-----------------------------"
done

# Prompt user to wait for L1->L2 message relay
read -p "\nCheck that tokens arrived on OP. Press Enter to continue with L2->L2 bridging..."

# Логирование relay message на L2 (OP)
echo "Fetching last relay tx on OP (L2)..."
L2_RPC_URL="http://127.0.0.1:9545"
RELAYER_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
LAST_L2_TX=$(cast txs $RELAYER_ADDR --rpc-url $L2_RPC_URL --count 1 | tail -n 1 | awk '{print $1}')
if [ -n "$LAST_L2_TX" ]; then
  echo "[LOGS] Relay/finalize tx on L2: $LAST_L2_TX"
  cast receipt $LAST_L2_TX --rpc-url $L2_RPC_URL
  echo "-----------------------------"
else
  echo "No relay tx found on L2 for $RELAYER_ADDR"
fi

# Bridge tokens OP -> Base
BRIDGE_OP_BASE_OUTPUT=$(forge script script/BridgeOpToBase.s.sol:BridgeOpToBaseScript --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PRIVATE_KEY -vvv --legacy)
echo "$BRIDGE_OP_BASE_OUTPUT"
echo "$BRIDGE_OP_BASE_OUTPUT" | grep -oE 'Transaction hash: (0x[a-fA-F0-9]+)' | awk '{print $3}' | while read -r tx; do
  echo "\n[LOGS] Bridge OP->Base tx: $tx"
  cast receipt $tx --rpc-url http://127.0.0.1:8545
  echo "-----------------------------"
done

# Prompt user to wait for OP->Base message relay
read -p "\nCheck that tokens arrived on Base. Press Enter to continue with Base->Zora bridging..."

# Bridge tokens Base -> Zora
BRIDGE_BASE_ZORA_OUTPUT=$(forge script script/BridgeBaseToZora.s.sol:BridgeBaseToZoraScript --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PRIVATE_KEY -vvv --legacy)
echo "$BRIDGE_BASE_ZORA_OUTPUT"
echo "$BRIDGE_BASE_ZORA_OUTPUT" | grep -oE 'Transaction hash: (0x[a-fA-F0-9]+)' | awk '{print $3}' | while read -r tx; do
  echo "\n[LOGS] Bridge Base->Zora tx: $tx"
  cast receipt $tx --rpc-url http://127.0.0.1:8545
  echo "-----------------------------"
done

# Prompt user to wait for Base->Zora message relay
read -p "\nCheck that tokens arrived on Zora. Press Enter to log final balances..."

# Log final balances on all chains
echo -e "\nFinal balances:"

# You need the Superbles contract address for each chain and the deployer address
SUPERBLES_JSON="broadcast/SuperblesAddresses.json"
DEPLOYER_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
SUPERBLES_OP=$(jq -r '.optimism' $SUPERBLES_JSON)
SUPERBLES_BASE=$(jq -r '.base' $SUPERBLES_JSON)
SUPERBLES_ZORA=$(jq -r '.zora' $SUPERBLES_JSON)

echo "Optimism balance:"
cast call $SUPERBLES_OP "balanceOf(address)(uint256)" $DEPLOYER_ADDR --rpc-url http://127.0.0.1:9545

echo "Base balance:"
cast call $SUPERBLES_BASE "balanceOf(address)(uint256)" $DEPLOYER_ADDR --rpc-url http://127.0.0.1:9546

echo "Zora balance:"
cast call $SUPERBLES_ZORA "balanceOf(address)(uint256)" $DEPLOYER_ADDR --rpc-url http://127.0.0.1:9547

# Check if bridging was successful
if [ $? -ne 0 ]; then
    echo "Error: Bridging failed"
    exit 1
fi

echo "Deployment and bridging complete!" 