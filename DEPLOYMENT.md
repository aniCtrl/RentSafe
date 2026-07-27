# RentSafe Smart Contract Deployment & Testing Guide

This guide details the step-by-step process for building, testing, deploying, initializing, and upgrading the RentSafe smart contracts on the Stellar Testnet.

---

## 1. Prerequisites & Verification

Before deploying, ensure you have the following tools installed and configured:

### 1.1. Install Stellar CLI
The Stellar CLI is required to compile WASM bytecode and interact with the Stellar network. Install it using Cargo:

```bash
cargo install --locked stellar-cli
```

Verify installation:
```bash
stellar --version
```

### 1.2. Run Automated Contract & Frontend Test Suites
Before deploying to Testnet, verify both smart contracts and frontend components pass unit tests:

```bash
# 1. Run Rust Soroban Smart Contract Unit Tests
cargo test

# 2. Run Next.js & Frontend Vitest Unit Tests
npm run test
```

### 1.3. Set Up & Fund a Deployer Account
Generate and fund a developer identity (`rentsafe-deployer`) on the Stellar Testnet:
```bash
stellar keys generate rentsafe-deployer --network testnet
stellar keys fund rentsafe-deployer --network testnet
```

---

## 2. Step-by-Step Testnet Deployment

We use the automated scripts inside `scripts/` to build, deploy, and generate deployment metadata.

### 2.1. Run the Deployment Script
Execute `deploy.sh` to compile the contracts and deploy them to the Stellar Testnet:
```bash
./scripts/deploy.sh testnet rentsafe-deployer
```

#### What This Script Does:
1. Compiles both `rentsafe_escrow` and `rentsafe_dispute` contracts into WebAssembly (WASM).
2. Deploys the bytecode to the Stellar Testnet.
3. Automatically computes SHA-256 hashes for both compiled WASM binaries.
4. Stores contract addresses and WASM hashes in `deployments/testnet.json`.

---

## 3. Initializing and Wiring Inter-Contract Dependency

The Escrow and Dispute contracts cross-reference each other and require two-phase initialization.

### 3.1. Generate the Platform Admin Wallet
Generate a dedicated platform admin wallet:
```bash
./scripts/generate-platform-wallet.sh rentsafe-admin
```
This script:
1. Generates and funds the `rentsafe-admin` identity.
2. Stores `RENTSAFE_PLATFORM_ADDRESS` and `RENTSAFE_PLATFORM_SECRET_KEY` in `.env`.

### 3.2. Run the Initialization Script
Run `initialize.sh` (or `python3 scripts/initialize.py`):
```bash
./scripts/initialize.sh testnet rentsafe-deployer
```

#### What This Script Does:
1. Invokes `initialize` on Dispute contract with the admin address and Escrow address.
2. Invokes `initialize` on Escrow contract with the admin address, Dispute address, and native XLM asset address (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`).
3. Records transaction hashes into `deployments/testnet.json`.
4. Programmatically updates contract ID tables and fallbacks in `.env`, `.env.example`, `README.md`, `src/lib/stellar.ts`, and `src/__tests__/integration.test.ts`.

---

## 4. Current Deployed Contracts & Hashes

The current live contracts on Stellar Testnet are:

| Contract | Address | WASM Hash |
| :--- | :--- | :--- |
| **RentSafe Escrow** | `CARQKV7WBR3GRNY3UMAFM4BJJPHAGOI4OPWH2LQLIA2SM55OEPZ5FD7F` | `8984492a8ba291fbb4ccced72dba508127e8e10136ef11755f1f79d38c4c216c` |
| **RentSafe Dispute** | `CCEXHVWVQTZZEBE7EPDWFTJ3MNWFUP2YX63PCVNTUSATVCRQNT7LSOEZ` | `1e276b85f2fcf604a10937e17e1ef6518c410b869c6e3cb5c29acfa01af5d725` |

---

## 5. Environment Variables Configuration

Configure local environment variables in `.env`:

| Env Variable | Meaning / Description | Example Value | Where to Get Value |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Address of deployed Escrow smart contract | `CARQKV7WBR3GRNY3...` | `deployments/testnet.json` |
| `NEXT_PUBLIC_DISPUTE_CONTRACT_ID` | Address of deployed Dispute smart contract | `CCEXHVWVQTZZEBE7...` | `deployments/testnet.json` |
| `STELLAR_NETWORK` | Target Stellar network environment | `testnet` | `testnet` or `public` |
| `RENTSAFE_PLATFORM_ADDRESS` | Public key of platform admin entity | `GCLSFD4ILBZCVMD...` | Generated in step 3.1 |
| `RENTSAFE_PLATFORM_SECRET_KEY` | Secret key of platform admin | `SA747A2HYFO5JA...` | Generated in step 3.1 |

---

## 6. Contract Upgrades

To update smart contract bytecode on-chain:
```bash
./scripts/upgrade.sh testnet <CONTRACT_ID> <PATH_TO_WASM> <ADMIN_IDENTITY_ALIAS>
```

Example:
```bash
./scripts/upgrade.sh testnet CARQKV7WBR3GRNY3UMAFM4BJJPHAGOI4OPWH2LQLIA2SM55OEPZ5FD7F target/wasm32v1-none/release/rentsafe_escrow.wasm rentsafe-admin
```

---

## 7. Deploying Frontend to Vercel

1. Push your repository to GitHub.
2. Configure Environment Variables in Vercel (**Settings > Environment Variables**):
   * `NEXT_PUBLIC_ESCROW_CONTRACT_ID`
   * `NEXT_PUBLIC_DISPUTE_CONTRACT_ID`
   * `STELLAR_NETWORK` (`testnet`)
   * `RENTSAFE_PLATFORM_ADDRESS`
