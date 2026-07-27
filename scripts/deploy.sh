#!/usr/bin/env bash
set -euo pipefail

# Configuration defaults
NETWORK=${1:-testnet}
DEPLOYER_IDENTITY=${2:-rentsafe-deployer-live}
ADMIN_IDENTITY=${3:-rentsafe-admin-live}
TOKEN_ASSET="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" # Native XLM SAC on testnet

echo "=================================================="
echo "RentSafe Consolidated Deployment Script"
echo "Network:           $NETWORK"
echo "Deployer Identity: $DEPLOYER_IDENTITY"
echo "Admin Identity:    $ADMIN_IDENTITY"
echo "=================================================="

# 1. Ensure identities exist and are funded
ensure_identity() {
    local identity_alias="$1"
    if ! stellar keys ls | grep -q "$identity_alias"; then
        echo "Generating identity $identity_alias..."
        stellar keys generate "$identity_alias" --network "$NETWORK" || true
        echo "Funding identity $identity_alias..."
        stellar keys fund "$identity_alias" --network "$NETWORK" || true
    else
        echo "Identity $identity_alias found."
    fi
}

ensure_identity "$DEPLOYER_IDENTITY"
ensure_identity "$ADMIN_IDENTITY"

ADMIN_PUBLIC=$(stellar keys public-key "$ADMIN_IDENTITY")
ADMIN_SECRET=$(stellar keys secret "$ADMIN_IDENTITY")

# 2. Build WASM smart contracts
echo "Building smart contracts..."
stellar contract build

ESCROW_WASM="target/wasm32v1-none/release/rentsafe_escrow.wasm"
DISPUTE_WASM="target/wasm32v1-none/release/rentsafe_dispute.wasm"

if [ ! -f "$ESCROW_WASM" ] || [ ! -f "$DISPUTE_WASM" ]; then
    echo "Error: WASM build output not found."
    exit 1
fi

ESCROW_WASM_HASH=$(shasum -a 256 "$ESCROW_WASM" | awk '{print $1}')
DISPUTE_WASM_HASH=$(shasum -a 256 "$DISPUTE_WASM" | awk '{print $1}')

# 3. Deploy contracts on-chain
echo "Deploying Escrow Contract..."
ESCROW_ID=$(stellar contract deploy \
    --wasm "$ESCROW_WASM" \
    --source-account "$DEPLOYER_IDENTITY" \
    --network "$NETWORK")
echo "Escrow Contract Deployed. ID: $ESCROW_ID"

echo "Deploying Dispute Contract..."
DISPUTE_ID=$(stellar contract deploy \
    --wasm "$DISPUTE_WASM" \
    --source-account "$DEPLOYER_IDENTITY" \
    --network "$NETWORK")
echo "Dispute Contract Deployed. ID: $DISPUTE_ID"

# 4. Initialize Dispute Contract
echo "Invoking Dispute initialize()..."
INIT_DISPUTE_OUT=$(stellar contract invoke \
    --id "$DISPUTE_ID" \
    --source-account "$ADMIN_SECRET" \
    --network "$NETWORK" \
    -- initialize \
    --admin "$ADMIN_PUBLIC" \
    --escrow_contract "$ESCROW_ID" 2>&1 || true)

INIT_DISPUTE_TX=""
if [[ "$INIT_DISPUTE_OUT" == *"Error(Contract, #1)"* ]] || [[ "$INIT_DISPUTE_OUT" == *"AlreadyInitialized"* ]]; then
    echo "Notice: Dispute contract already initialized."
else
    INIT_DISPUTE_TX=$(echo "$INIT_DISPUTE_OUT" | grep -E "^[a-f0-9]{64}$" || echo "")
fi

# 5. Initialize Escrow Contract
echo "Invoking Escrow initialize()..."
INIT_ESCROW_OUT=$(stellar contract invoke \
    --id "$ESCROW_ID" \
    --source-account "$ADMIN_SECRET" \
    --network "$NETWORK" \
    -- initialize \
    --admin "$ADMIN_PUBLIC" \
    --dispute_contract "$DISPUTE_ID" \
    --asset "$TOKEN_ASSET" 2>&1 || true)

INIT_ESCROW_TX=""
if [[ "$INIT_ESCROW_OUT" == *"Error(Contract, #1)"* ]] || [[ "$INIT_ESCROW_OUT" == *"AlreadyInitialized"* ]]; then
    echo "Notice: Escrow contract already initialized."
else
    INIT_ESCROW_TX=$(echo "$INIT_ESCROW_OUT" | grep -E "^[a-f0-9]{64}$" || echo "")
fi

# 6. Write deployment metadata
mkdir -p deployments
METADATA_FILE="deployments/$NETWORK.json"

cat <<EOF > "$METADATA_FILE"
{
  "network": "$NETWORK",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "escrow": {
    "address": "$ESCROW_ID",
    "wasm_hash": "$ESCROW_WASM_HASH"
  },
  "dispute": {
    "address": "$DISPUTE_ID",
    "wasm_hash": "$DISPUTE_WASM_HASH"
  },
  "roles": {
    "admin": "$ADMIN_PUBLIC",
    "asset": "$TOKEN_ASSET"
  },
  "interactions": {
    "init_dispute_tx": "$INIT_DISPUTE_TX",
    "init_escrow_tx": "$INIT_ESCROW_TX"
  }
}
EOF

echo "Deployment metadata written to $METADATA_FILE."

# 7. Update configuration files and markdown documentation using helper script
node scripts/update-placeholders.js "$ESCROW_ID" "$DISPUTE_ID" "$ESCROW_WASM_HASH" "$DISPUTE_WASM_HASH" "$ADMIN_PUBLIC" "$ADMIN_SECRET"

echo "=================================================="
echo "RentSafe Deployment & Initialization Complete!"
echo "Escrow Contract:  $ESCROW_ID"
echo "Dispute Contract: $DISPUTE_ID"
echo "Admin Address:    $ADMIN_PUBLIC"
echo "=================================================="
