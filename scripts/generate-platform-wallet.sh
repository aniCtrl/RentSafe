#!/bin/sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$REPO_ROOT/.env"
ENV_EXAMPLE_FILE="$REPO_ROOT/.env.example"
NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
ALIAS="${1:-rentsafe-platform-$(date +%Y%m%d%H%M%S)}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command not found: $1" >&2
    exit 1
  fi
}

upsert_env_var() {
  file="$1"
  key="$2"
  value="$3"

  if [ ! -f "$file" ]; then
    : > "$file"
  fi

  tmp_file="$file.tmp"
  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) print key "=" value
    }
  ' "$file" > "$tmp_file"
  mv "$tmp_file" "$file"
}

ensure_example_key() {
  if [ ! -f "$ENV_EXAMPLE_FILE" ]; then
    : > "$ENV_EXAMPLE_FILE"
  fi

  if ! grep -q '^RENTSAFE_PLATFORM_ADDRESS=' "$ENV_EXAMPLE_FILE"; then
    printf '\n# RentSafe platform admin wallet public address (safe to commit)\nRENTSAFE_PLATFORM_ADDRESS=\n' >> "$ENV_EXAMPLE_FILE"
  fi
}

require_command stellar
require_command awk
require_command grep
require_command mv
require_command date

if stellar keys public-key "$ALIAS" >/dev/null 2>&1; then
  echo "Error: Stellar identity alias '$ALIAS' already exists. Pass a different alias to avoid overwriting an existing key." >&2
  exit 1
fi

echo "→ Generating Stellar identity '$ALIAS' on $NETWORK..."
stellar keys generate "$ALIAS" --network "$NETWORK" --rpc-url "$RPC_URL"

echo "→ Funding '$ALIAS' on $NETWORK via Friendbot..."
stellar keys fund "$ALIAS" --network "$NETWORK" --rpc-url "$RPC_URL"

PUBLIC_KEY=$(stellar keys public-key "$ALIAS")
SECRET_KEY=$(stellar keys secret "$ALIAS")

ensure_example_key
upsert_env_var "$ENV_FILE" "RENTSAFE_PLATFORM_ADDRESS" "$PUBLIC_KEY"
upsert_env_var "$ENV_FILE" "RENTSAFE_PLATFORM_SECRET_KEY" "$SECRET_KEY"

echo ""
echo "✓ RentSafe platform wallet generated and funded"
echo "Alias: $ALIAS"
echo "Public Key (stored in .env as RENTSAFE_PLATFORM_ADDRESS):"
echo "$PUBLIC_KEY"
echo ""
echo "Secret Key (stored in local .env as RENTSAFE_PLATFORM_SECRET_KEY — do NOT commit):"
echo "$SECRET_KEY"
echo ""
echo "Next steps:"
echo "1. Add RENTSAFE_PLATFORM_SECRET_KEY to your CI secret store."
echo "2. Keep .env gitignored."
echo "3. Use RENTSAFE_PLATFORM_ADDRESS when initializing Escrow and Dispute contracts."
