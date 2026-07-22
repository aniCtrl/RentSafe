#!/usr/bin/env bash
set -euo pipefail

# Default configuration
NETWORK=${1:-testnet}
SOURCE=${2:-RENTSAFE_TESTNET}

echo "=================================================="
echo "RentSafe Deployment Script"
echo "Network: $NETWORK"
echo "Source: $SOURCE"
echo "=================================================="

# Ensure workspace is compiled
echo "Building contracts..."
stellar contract build

# Verify build outputs exist
ESCROW_WASM="target/wasm32v1-none/release/rentsafe_escrow.wasm"
DISPUTE_WASM="target/wasm32v1-none/release/rentsafe_dispute.wasm"

if [ ! -f "$ESCROW_WASM" ] || [ ! -f "$DISPUTE_WASM" ]; then
    echo "Error: WASM files not found. Build failed."
    exit 1
fi

echo "Deploying Escrow Contract..."
ESCROW_ID=$(stellar contract deploy \
    --wasm "$ESCROW_WASM" \
    --source-account "$SOURCE" \
    --network "$NETWORK")
echo "Escrow Contract Deployed. ID: $ESCROW_ID"

echo "Deploying Dispute Contract..."
DISPUTE_ID=$(stellar contract deploy \
    --wasm "$DISPUTE_WASM" \
    --source-account "$SOURCE" \
    --network "$NETWORK")
echo "Dispute Contract Deployed. ID: $DISPUTE_ID"

# Get WASM Hashes
ESCROW_WASM_HASH=$(shasum -a 256 "$ESCROW_WASM" | awk '{print $1}' || echo "")
DISPUTE_WASM_HASH=$(shasum -a 256 "$DISPUTE_WASM" | awk '{print $1}' || echo "")

# Write metadata output
METADATA_DIR="deployments"
mkdir -p "$METADATA_DIR"
METADATA_FILE="$METADATA_DIR/$NETWORK.json"

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
  }
}
EOF

echo "=================================================="
echo "Deployment successful!"
echo "Metadata written to: $METADATA_FILE"
echo "=================================================="
