// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  Account,
  Contract,
  TransactionBuilder,
  Networks,
  Keypair,
  Address,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

// Deployed contract addresses and role credentials
const ESCROW_CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || 'CDMI23JKHYAH46CTTU4F7ME57PRCZH7FMJJYFZEVPUAD6Y36T3H6OIVQ';
const DISPUTE_CONTRACT_ID = process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ID || 'CD7FXU24BREXPOCI347GK3H6HYXNSJQ3BE3I7M5XEAHWXRB6XG63KVIB';

const LANDLORD_SECRET = 'SCLTZBM4PFXT7SUARDTELDCR3YFYVCODPSCMO3CDOFWEAEK7QQNPTU3C';
const TENANT_SECRET = 'SCWFNF4IB6I76ZZF66K7IRKQEIO2XPIGOMBNZB67EZWABRGANU6QWUCM';
const ARBITRATOR_SECRET = 'SAVIOCLT3UVJKY23S3RNDLNBTOG2QKOG6JPIYDF3G2YHHKOXNDBUGTPT';
const PLATFORM_SECRET = 'SCBCLZYCU72N3TWBLBG3OMH2YH7PUV7TSY53J3VDQKQKZS6DGOHGMLN6';

const LANDLORD_ADDR = 'GBFJINJRIR3JOEOZCNWLSF3B5VENKG2RAGVT4WY4J6AHW32UU2GF3TW3';
const TENANT_ADDR = 'GB4TTRCTXZ3RNNB6COSWVFWXNPUYWVHX7GI63Z7OC2KYR4BS5W54WAHF';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(RPC_URL);

// Helper to safely unpack numbers from native ScVal conversions (handling Result and Option wrapping)
function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'string') return parseInt(val, 10);
  if (typeof val === 'object' && val !== null) {
    if ('Ok' in val) return parseNumber(val.Ok);
    if ('Some' in val) return parseNumber(val.Some);
    if ('tag' in val && val.tag === 'Ok') {
      return parseNumber(Array.isArray(val.values) ? val.values[0] : val.values);
    }
    if ('tag' in val && val.tag === 'Some') {
      return parseNumber(Array.isArray(val.values) ? val.values[0] : val.values);
    }
  }
  return NaN;
}

// --- XDR Explicit Type Builders ---

function bigintToI128ScVal(value: bigint): xdr.ScVal {
  const isNegative = value < 0n;
  let absVal = isNegative ? -value : value;
  
  const mask64 = 0xffffffffffffffffn;
  const lo = absVal & mask64;
  const hi = absVal >> 64n;
  
  let loVal = lo;
  let hiVal = hi;
  if (isNegative) {
    loVal = (~lo + 1n) & mask64;
    hiVal = ~hi;
    if (loVal === 0n) {
      hiVal = (hiVal + 1n) & mask64;
    }
  }
  
  const loUint64 = xdr.Uint64.fromString(loVal.toString());
  const hiInt64 = xdr.Int64.fromString(hiVal.toString());
  
  return xdr.ScVal.scvI128(new xdr.Int128Parts({
    lo: loUint64,
    hi: hiInt64
  }));
}

function numberToU64ScVal(value: number | bigint): xdr.ScVal {
  return xdr.ScVal.scvU64(xdr.Uint64.fromString(value.toString()));
}

function boolToScVal(value: boolean): xdr.ScVal {
  return xdr.ScVal.scvBool(value);
}

function stringToScVal(value: string): xdr.ScVal {
  return xdr.ScVal.scvString(value);
}

function addressToScVal(value: string): xdr.ScVal {
  return new Address(value).toScVal();
}

// Helper function to invoke a smart contract method using raw ScVal arguments
async function invokeContractWithKeypair(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  secretKey: string
): Promise<{ txHash: string; returnValue: any }> {
  const keypair = Keypair.fromSecret(secretKey);
  const userAddress = keypair.publicKey();
  
  const sourceAccount = await server.getAccount(userAddress);
  const contract = new Contract(contractId);

  let transaction = new TransactionBuilder(sourceAccount, {
    fee: '5000', // high fee buffer
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  transaction = await server.prepareTransaction(transaction);
  transaction.sign(keypair);

  const submitResult = await server.sendTransaction(transaction);
  if (submitResult.status === 'ERROR') {
    const errResult = (submitResult as any).errorResultXdr || (submitResult as any).errorResult;
    throw new Error(`Transaction submission error: ${JSON.stringify(errResult)}`);
  }

  const txHash = submitResult.hash;
  let attempts = 0;
  while (attempts < 30) {
    const txResponse = await server.getTransaction(txHash);
    if (txResponse.status === 'SUCCESS') {
      let returnValue: any = undefined;
      console.log('txResponse.returnValue raw:', txResponse.returnValue);
      if (txResponse.returnValue) {
        try {
          returnValue = scValToNative(txResponse.returnValue as any);
          console.log('txResponse.returnValue parsed:', returnValue);
        } catch (err) {
          console.error('Failed to parse returnValue with scValToNative, using directly:', err);
          returnValue = txResponse.returnValue;
        }
      }
      return { txHash, returnValue };
    }
    if (txResponse.status === 'FAILED') {
      throw new Error(`Transaction failed: ${txHash}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts += 1;
  }
  throw new Error('Transaction timed out');
}

// Read-only getter helper
async function readContractView(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<any> {
  const DUMMY_PUBLIC_KEY = 'GBSJ6OLI3XRFWDWJJBW6C3H2EXKMFQQVFEKYNV6DHHGM5FHYJ3M7MM5Y';
  const account = new Account(DUMMY_PUBLIC_KEY, '0');
  const contract = new Contract(contractId);

  const transaction = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error for ${method}: ${sim.error}`);
  }
  if (sim.result?.retval) {
    return scValToNative(sim.result?.retval);
  }
  throw new Error('No return value from simulation');
}

describe('Soroban Live Network Integration Test', () => {
  const runTest = process.env.RUN_INTEGRATION_TEST === 'true';

  (runTest ? it : it.skip)('should complete the full agreement lifecycle: create → lock → dispute → resolve', async () => {
    console.log('Starting full cycle integration test on Stellar Testnet...');

    // 1. Create Agreement (by Landlord)
    const propertyDetails = `Integration Test Prop ${Date.now()}`;
    const depositAmount = 10000000n; // 1 XLM (in stroops)
    const rentAmount = 2000000n; // 0.2 XLM (in stroops)
    const leaseStart = Math.floor(Date.now() / 1000);
    const leaseEnd = leaseStart + 3600;

    console.log('Step 1: Creating agreement as Landlord...');
    const createRes = await invokeContractWithKeypair(
      ESCROW_CONTRACT_ID,
      'create_agreement',
      [
        addressToScVal(LANDLORD_ADDR),
        addressToScVal(TENANT_ADDR),
        stringToScVal(propertyDetails),
        bigintToI128ScVal(depositAmount),
        bigintToI128ScVal(rentAmount),
        numberToU64ScVal(leaseStart),
        numberToU64ScVal(leaseEnd)
      ],
      LANDLORD_SECRET
    );

    const agreementId = parseNumber(createRes.returnValue);
    console.log(`✓ Agreement created successfully. ID: ${agreementId}`);
    expect(agreementId).toBeGreaterThan(0);

    // Verify status is Created (0)
    let agreement = await readContractView(ESCROW_CONTRACT_ID, 'get_agreement', [numberToU64ScVal(agreementId)]);
    expect(parseNumber(agreement.status)).toBe(0);

    // 2. Lock Deposit (by Tenant)
    console.log('Step 2: Locking deposit as Tenant...');
    await invokeContractWithKeypair(
      ESCROW_CONTRACT_ID,
      'lock_deposit',
      [numberToU64ScVal(agreementId)],
      TENANT_SECRET
    );
    console.log('✓ Deposit locked successfully');

    // Verify status is Funded (1)
    agreement = await readContractView(ESCROW_CONTRACT_ID, 'get_agreement', [numberToU64ScVal(agreementId)]);
    expect(parseNumber(agreement.status)).toBe(1);

    // 3. Request Deduction (by Landlord)
    console.log('Step 3: Requesting deduction as Landlord...');
    await invokeContractWithKeypair(
      ESCROW_CONTRACT_ID,
      'request_deduction',
      [numberToU64ScVal(agreementId), bigintToI128ScVal(4000000n), stringToScVal('Broken lock')],
      LANDLORD_SECRET
    );
    console.log('✓ Deduction requested');

    // Verify status is DeductionRequested (4)
    agreement = await readContractView(ESCROW_CONTRACT_ID, 'get_agreement', [numberToU64ScVal(agreementId)]);
    expect(parseNumber(agreement.status)).toBe(4);

    // 4. Reject Deduction (by Tenant)
    console.log('Step 4: Rejecting deduction as Tenant...');
    await invokeContractWithKeypair(
      ESCROW_CONTRACT_ID,
      'respond_to_deduction',
      [numberToU64ScVal(agreementId), boolToScVal(false)],
      TENANT_SECRET
    );
    console.log('✓ Deduction rejected');

    // Verify status is DeductionRejected (6)
    agreement = await readContractView(ESCROW_CONTRACT_ID, 'get_agreement', [numberToU64ScVal(agreementId)]);
    expect(parseNumber(agreement.status)).toBe(6);

    // 5. Raise Dispute (by Tenant)
    console.log('Step 5: Raising dispute as Tenant...');
    const disputeRes = await invokeContractWithKeypair(
      ESCROW_CONTRACT_ID,
      'raise_dispute',
      [
        numberToU64ScVal(agreementId),
        addressToScVal(TENANT_ADDR),
        stringToScVal('Reject damage claim details'),
        stringToScVal('ipfs://ref-link')
      ],
      TENANT_SECRET
    );

    const disputeId = parseNumber(disputeRes.returnValue);
    console.log(`✓ Dispute raised successfully. ID: ${disputeId}`);
    expect(disputeId).toBeGreaterThan(0);

    // Verify status is AwaitingArbitration (8)
    agreement = await readContractView(ESCROW_CONTRACT_ID, 'get_agreement', [numberToU64ScVal(agreementId)]);
    expect(parseNumber(agreement.status)).toBe(8);

    // 6. Resolve Dispute (by Platform Admin on the dispute contract)
    console.log('Step 6: Resolving dispute as Platform Admin...');
    // Resolving split: Landlord gets 0.3 XLM (3000000 Stroops), Tenant gets 0.7 XLM (7000000 Stroops)
    await invokeContractWithKeypair(
      DISPUTE_CONTRACT_ID,
      'resolve_dispute',
      [numberToU64ScVal(disputeId), bigintToI128ScVal(3000000n), bigintToI128ScVal(7000000n)],
      PLATFORM_SECRET
    );
    console.log('✓ Dispute resolved successfully');

    // Verify final agreement status is Settled (9)
    agreement = await readContractView(ESCROW_CONTRACT_ID, 'get_agreement', [numberToU64ScVal(agreementId)]);
    expect(parseNumber(agreement.status)).toBe(9);
    
    console.log('✓ Integration test completed successfully! Full agreement cycle validated.');
  }, 150000);
});
