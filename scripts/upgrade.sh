#!/usr/bin/env bash
set -euo pipefail

NETWORK=${1:-testnet}
CONTRACT_ID=${2:-}
WASM_FILE=${3:-}
SOURCE=${4:-RENTSAFE_ARBITRATOR}

if [ -z "$CONTRACT_ID" ] || [ -z "$WASM_FILE" ]; then
    echo "Usage: $0 <network> <contract_id> <wasm_file_path> [source_identity]"
    echo "Example: $0 testnet CBPI35... target/wasm32v1-none/release/rentsafe_escrow.wasm"
    exit 1
fi

echo "=================================================="
echo "RentSafe Contract Upgrade Script"
echo "Network:     $NETWORK"
echo "Contract ID: $CONTRACT_ID"
echo "WASM File:   $WASM_FILE"
echo "Source:      $SOURCE"
echo "=================================================="

# 1. Compile the contract
echo "Building contracts to ensure WASM is fresh..."
stellar contract build

# 2. Install the WASM to get the new WASM hash
echo "Installing new WASM binary on network..."
NEW_WASM_HASH=$(stellar contract install \
    --wasm "$WASM_FILE" \
    --source-account "$SOURCE" \
    --network "$NETWORK")
echo "New WASM Installed. Hash: $NEW_WASM_HASH"

# 3. Call upgrade on the contract
echo "Invoking upgrade() on target contract $CONTRACT_ID..."
CALLER_ADDR=$(stellar keys public-key "$SOURCE")
stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    -- upgrade \
    --caller "$CALLER_ADDR" \
    --new_wasm_hash "$NEW_WASM_HASH"

echo "=================================================="
echo "Contract upgraded successfully!"
echo "New WASM Hash: $NEW_WASM_HASH"
echo "=================================================="
