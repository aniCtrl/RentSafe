#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

const [escrowId, disputeId, escrowHash, disputeHash, adminPublic, adminSecret] = process.argv.slice(2);

if (!escrowId || !disputeId) {
    console.error('Usage: update-placeholders.js <ESCROW_ID> <DISPUTE_ID> [ESCROW_HASH] [DISPUTE_HASH] [ADMIN_PUBLIC] [ADMIN_SECRET]');
    process.exit(1);
}

function updateFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [regex, value] of replacements) {
        content = content.replace(regex, value);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. Environment files
updateFile('.env', [
    [/NEXT_PUBLIC_ESCROW_CONTRACT_ID=.*/, `NEXT_PUBLIC_ESCROW_CONTRACT_ID=${escrowId}`],
    [/NEXT_PUBLIC_DISPUTE_CONTRACT_ID=.*/, `NEXT_PUBLIC_DISPUTE_CONTRACT_ID=${disputeId}`],
    [/RENTSAFE_PLATFORM_ADDRESS=.*/, `RENTSAFE_PLATFORM_ADDRESS=${adminPublic || ''}`],
    [/RENTSAFE_PLATFORM_SECRET_KEY=.*/, `RENTSAFE_PLATFORM_SECRET_KEY=${adminSecret || ''}`]
]);

updateFile('.env.example', [
    [/NEXT_PUBLIC_ESCROW_CONTRACT_ID=.*/, `NEXT_PUBLIC_ESCROW_CONTRACT_ID=${escrowId}`],
    [/NEXT_PUBLIC_DISPUTE_CONTRACT_ID=.*/, `NEXT_PUBLIC_DISPUTE_CONTRACT_ID=${disputeId}`],
    [/RENTSAFE_PLATFORM_ADDRESS=.*/, `RENTSAFE_PLATFORM_ADDRESS=${adminPublic || ''}`]
]);

// 2. Source fallbacks
updateFile('src/lib/stellar.ts', [
    [/(DEFAULT_ESCROW_ID\s*=.*\|\|\s*')[^']+'/, `$1${escrowId}'`],
    [/(DEFAULT_DISPUTE_ID\s*=.*\|\|\s*')[^']+'/, `$1${disputeId}'`],
    [/(DEFAULT_ESCROW_WASM_HASH\s*=.*\|\|\s*')[^']+'/, `$1${escrowHash || ''}'`],
    [/(DEFAULT_DISPUTE_WASM_HASH\s*=.*\|\|\s*')[^']+'/, `$1${disputeHash || ''}'`]
]);

updateFile('src/__tests__/integration.test.ts', [
    [/(ESCROW_CONTRACT_ID\s*=.*\|\|\s*')[^']+'/, `$1${escrowId}'`],
    [/(DISPUTE_CONTRACT_ID\s*=.*\|\|\s*')[^']+'/, `$1${disputeId}'`]
]);

// 3. README.md
updateFile('README.md', [
    // Top badges
    [/(contract\/)C[A-Z2-7]{55}("><img [^>]+alt="EscrowContract")/gi, `$1${escrowId}$2`],
    [/(contract\/)C[A-Z2-7]{55}("><img [^>]+alt="DisputeContract")/gi, `$1${disputeId}$2`],
    // Section 3 Address lines
    [/(### 3\.1 RentSafe Escrow Registry[\s\S]*?\*\*Address\*\*:\s*\[`)C[A-Z2-7]{55}(`\]\(https:\/\/stellar\.expert\/explorer\/[^\/]+\/contract\/)C[A-Z2-7]{55}(\))/i, `$1${escrowId}$2${escrowId}$3`],
    [/(### 3\.2 RentSafe Dispute Registry[\s\S]*?\*\*Address\*\*:\s*\[`)C[A-Z2-7]{55}(`\]\(https:\/\/stellar\.expert\/explorer\/[^\/]+\/contract\/)C[A-Z2-7]{55}(\))/i, `$1${disputeId}$2${disputeId}$3`],
    // Section 10 Tables
    [/(\|\s*\*\*RentSafe Escrow\*\*\s*\|\s*`)[^`]+(`\s*\|\s*\[StellarExpert ↗\]\(https:\/\/stellar\.expert\/explorer\/[^\/]+\/contract\/)[^`\)]+(\))/gi, `$1${escrowId}$2${escrowId}$3`],
    [/(\|\s*\*\*RentSafe Dispute\*\*\s*\|\s*`)[^`]+(`\s*\|\s*\[StellarExpert ↗\]\(https:\/\/stellar\.expert\/explorer\/[^\/]+\/contract\/)[^`\)]+(\))/gi, `$1${disputeId}$2${disputeId}$3`]
]);

// 4. DEPLOYMENT.md
updateFile('DEPLOYMENT.md', [
    // Section 4 table
    [/(\|\s*\*\*RentSafe Escrow\*\*\s*\|\s*`)[^`]+(`\s*\|\s*\[StellarExpert ↗\]\(https:\/\/stellar\.expert\/explorer\/[^\/]+\/contract\/)[^`\)]+(\))/gi, `$1${escrowId}$2${escrowId}$3`],
    [/(\|\s*\*\*RentSafe Dispute\*\*\s*\|\s*`)[^`]+(`\s*\|\s*\[StellarExpert ↗\]\(https:\/\/stellar\.expert\/explorer\/[^\/]+\/contract\/)[^`\)]+(\))/gi, `$1${disputeId}$2${disputeId}$3`],
    // Section 7 upgrades example
    [/(upgrade\.sh\s+testnet\s+)C[A-Z2-7]{55}/gi, `$1${escrowId}`]
]);

console.log('Successfully synchronized configuration files, source code, and documentation.');
