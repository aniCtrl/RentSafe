# RentSafe Smart Contract Deployment & Operations Guide

This guide details the step-by-step process for setting up identities, building, deploying, initializing, testing, and upgrading the RentSafe smart contracts on the Stellar Testnet.

---

## 1. Prerequisites

Before running deployment commands, ensure you have installed the required toolchain:

### 1.1. Install Stellar CLI
The Stellar CLI is required to compile WASM bytecode and interact with the Stellar network:

```bash
cargo install --locked stellar-cli
```

Verify installation:
```bash
stellar --version
```

---

## 2. Setup Live Wallets & Identities

Before deploying, generate and fund your live developer identities on the Stellar Testnet:

### 2.1. Generate Deployer Identity (`rentsafe-deployer-live`)
```bash
stellar keys generate rentsafe-deployer-live --network testnet
stellar keys fund rentsafe-deployer-live --network testnet
```

### 2.2. Generate Admin Identity (`rentsafe-admin-live`)
```bash
stellar keys generate rentsafe-admin-live --network testnet
stellar keys fund rentsafe-admin-live --network testnet
```

Verify account public keys and balances:
```bash
stellar keys public-key rentsafe-deployer-live
stellar keys public-key rentsafe-admin-live
```

---

## 3. Execute Single Deployment & Initialization Script

Deploy and initialize all smart contracts on-chain in a single step using the pure-bash deployment script:

```bash
./scripts/deploy.sh testnet rentsafe-deployer-live rentsafe-admin-live
```

### What This Single Script Automates:
1. Verifies/generates `rentsafe-deployer-live` and `rentsafe-admin-live` identities.
2. Compiles WASM contract binaries (`rentsafe_escrow.wasm` and `rentsafe_dispute.wasm`) via `stellar contract build`.
3. Deploys Escrow & Dispute contracts to the Stellar Testnet.
4. Computes SHA-256 WASM bytecode hashes.
5. Invokes `initialize` on Dispute contract with the platform admin public key and Escrow contract address.
6. Invokes `initialize` on Escrow contract with the platform admin public key, Dispute contract address, and native XLM asset address (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`).
7. Writes complete JSON metadata to `deployments/testnet.json`.
8. Programmatically syncs contract addresses into `.env`, `.env.example`, `README.md`, `DEPLOYMENT.md`, `src/lib/stellar.ts`, and `src/__tests__/integration.test.ts`.

---

## 4. Captured Contract Addresses & On-Chain Verification

The output metadata is stored permanently in `deployments/testnet.json`. Current live testnet contract configuration:

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **RentSafe Escrow** | `CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD` | [StellarExpert ↗](https://stellar.expert/explorer/testnet/contract/CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD) |
| **RentSafe Dispute** | `CARBWEU5IF6Q4DJQHNJJOLFG57WXPWIIU5KUPMN2VRADO6GUSRAGKG3W` | [StellarExpert ↗](https://stellar.expert/explorer/testnet/contract/CARBWEU5IF6Q4DJQHNJJOLFG57WXPWIIU5KUPMN2VRADO6GUSRAGKG3W) |

---

## 5. Environment Variables Configuration

Configure your local environment variables in `.env`:

| Env Variable | Meaning / Description | Example Value | Where to Get Value |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Address of deployed Escrow smart contract | `CARQKV7WBR3GRNY3...` | `deployments/testnet.json` |
| `NEXT_PUBLIC_DISPUTE_CONTRACT_ID` | Address of deployed Dispute smart contract | `CCEXHVWVQTZZEBE7...` | `deployments/testnet.json` |
| `STELLAR_NETWORK` | Target Stellar network environment | `testnet` | `testnet` or `public` |
| `RENTSAFE_PLATFORM_ADDRESS` | Public key of platform admin entity | `GCLSFD4ILBZCVMD...` | Generated in step 2.2 |
| `RENTSAFE_PLATFORM_SECRET_KEY` | Secret key of platform admin | `SA747A2HYFO5JA...` | Generated in step 2.2 |

---

## 6. Automated Testing & CI/CD Verification

Run unit test suites for both Soroban smart contracts and frontend components:

```bash
# 1. Run Rust Soroban Smart Contract Tests
cargo test

# 2. Run Next.js Frontend Vitest Unit Tests
npm run test
```

---

## 7. Contract Upgrades

To upgrade contract bytecode on-chain:
```bash
./scripts/upgrade.sh testnet <CONTRACT_ID> <PATH_TO_WASM> rentsafe-admin-live
```

Example:
```bash
./scripts/upgrade.sh testnet CAUQOF5U6PUWNBZYWUAWBMYXQNPBXUQQWH3EHO6GQMUFKKNFQBWKXEUD target/wasm32v1-none/release/rentsafe_escrow.wasm rentsafe-admin-live
```

---

## 8. Deploying Frontend to Vercel

1. Push your repository to GitHub.
2. In the Vercel Dashboard, configure **Settings > Environment Variables**:
   * `NEXT_PUBLIC_ESCROW_CONTRACT_ID`
   * `NEXT_PUBLIC_DISPUTE_CONTRACT_ID`
   * `STELLAR_NETWORK` (`testnet`)
   * `RENTSAFE_PLATFORM_ADDRESS`
