#!/bin/bash
set -e

echo "=================================================================="
echo "⚡ Starting RentSafe Soroban Smart Contract Deployment Pipeline"
echo "=================================================================="

# Define network profiles
NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
PASSPHRASE="Test Stellar Public Network ; September 2015"
TOKEN_XLM="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" # Native XLM SAC on Testnet

echo "1. Building smart contracts for target wasm32v1-none..."
source "$HOME/.cargo/env" || true
stellar contract build

echo "2. Checking for deployer key name 'PROJECT_TESTNET'..."
# Generate key if it does not exist. stellar keys generate automatically funds the key on testnet.
if ! stellar keys address PROJECT_TESTNET >/dev/null 2>&1; then
    echo "🔑 Key 'PROJECT_TESTNET' not found. Generating and funding via Friendbot..."
    stellar keys generate PROJECT_TESTNET --network testnet
else
    echo "🔑 Found existing 'PROJECT_TESTNET' key."
fi

DEPLOYER_ADDR=$(stellar keys address PROJECT_TESTNET)
echo "🔑 Deployer Account Address: $DEPLOYER_ADDR"

echo "3. Deploying Escrow Contract..."
ESCROW_ID=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/rentsafe_escrow.wasm \
    --source PROJECT_TESTNET \
    --network testnet)
echo "✅ Escrow Contract Deployed. ID: $ESCROW_ID"

echo "4. Deploying Dispute Contract..."
DISPUTE_ID=$(stellar contract deploy \
    --wasm target/wasm32v1-none/release/rentsafe_dispute.wasm \
    --source PROJECT_TESTNET \
    --network testnet)
echo "✅ Dispute Contract Deployed. ID: $DISPUTE_ID"

echo "5. Initializing Escrow Contract..."
stellar contract invoke \
    --id "$ESCROW_ID" \
    --source PROJECT_TESTNET \
    --network testnet \
    -- initialize \
    --admin "$DEPLOYER_ADDR" \
    --token "$TOKEN_XLM"

echo "6. Initializing Dispute Contract..."
stellar contract invoke \
    --id "$DISPUTE_ID" \
    --source PROJECT_TESTNET \
    --network testnet \
    -- initialize \
    --admin "$DEPLOYER_ADDR" \
    --escrow_contract "$ESCROW_ID"

echo "7. Connecting Escrow Contract to Dispute Contract..."
stellar contract invoke \
    --id "$ESCROW_ID" \
    --source PROJECT_TESTNET \
    --network testnet \
    -- set_dispute_contract \
    --dispute_contract "$DISPUTE_ID"

echo "8. Generating frontend/src/contracts-config.json..."
cat <<EOF > frontend/src/contracts-config.json
{
  "testnet": {
    "escrow": "$ESCROW_ID",
    "dispute": "$DISPUTE_ID",
    "token": "$TOKEN_XLM",
    "rpcUrl": "$RPC_URL",
    "networkPassphrase": "$PASSPHRASE"
  },
  "local": {
    "escrow": "",
    "dispute": "",
    "token": "$TOKEN_XLM",
    "rpcUrl": "http://localhost:8000",
    "networkPassphrase": "Standalone Network ; Map 2020"
  }
}
EOF

echo "=================================================================="
echo "🎉 RentSafe Deployment Complete & Frontend Configured Successfully!"
echo "=================================================================="
echo "📌 Escrow Contract ID: $ESCROW_ID"
echo "📌 Dispute Contract ID: $DISPUTE_ID"
echo "📌 Config file saved: frontend/src/contracts-config.json"
echo "=================================================================="
