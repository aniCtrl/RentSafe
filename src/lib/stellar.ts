import {
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
  Networks as StellarNetworks,
  Account,
  Address,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
export const server = new rpc.Server(RPC_URL);

const DUMMY_PUBLIC_KEY = 'GBSJ6OLI3XRFWDWJJBW6C3H2EXKMFQQVFEKYNV6DHHGM5FHYJ3M7MM5Y';

export const NATIVE_XLM_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
export const DEFAULT_ESCROW_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || 'CDMI23JKHYAH46CTTU4F7ME57PRCZH7FMJJYFZEVPUAD6Y36T3H6OIVQ';
export const DEFAULT_DISPUTE_ID = process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ID || 'CD7FXU24BREXPOCI347GK3H6HYXNSJQ3BE3I7M5XEAHWXRB6XG63KVIB';
export const DEFAULT_ARBITRATOR_ID = process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS || 'GAKY5EWWOETAUQQZJPSW3OD5R2N46BE7G24PAHSHLGYLZGTMOLWE7BXT';
export const DEFAULT_PLATFORM_ADMIN_ID = process.env.NEXT_PUBLIC_PLATFORM_ADMIN_ADDRESS || DEFAULT_ARBITRATOR_ID;
export const DEFAULT_ESCROW_WASM_HASH = process.env.NEXT_PUBLIC_ESCROW_WASM_HASH || '91394c41b75a32ed0a6b60bdedcead1b3ebe41daeb9d35cc41182180318ac83a';
export const DEFAULT_DISPUTE_WASM_HASH = process.env.NEXT_PUBLIC_DISPUTE_WASM_HASH || '0195694beeed00b8e012559132361ff425df2a5f08499cd45cd520d27cc7f8fb';

let isKitInitialized = false;

export async function initializeWalletsKit(network: 'testnet' | 'mainnet' = 'testnet', walletId?: string) {
  const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
  const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');
  const { Networks: KitNetworks } = await import('@creit.tech/stellar-wallets-kit/types');

  if (!isKitInitialized) {
    StellarWalletsKit.init({
      modules: defaultModules(),
    });
    isKitInitialized = true;
  }

  StellarWalletsKit.setNetwork(network === 'testnet' ? KitNetworks.TESTNET : KitNetworks.PUBLIC);

  if (walletId) {
    StellarWalletsKit.setWallet(walletId);
  }
}

// Escrow & Dispute contract methods parameter type maps to prevent VM traps on type mismatch
const METHOD_PARAMETER_TYPES: Record<string, string[]> = {
  // Escrow contract methods
  'create_agreement': ['address', 'address', 'string', 'i128', 'i128', 'u64', 'u64'],
  'lock_deposit': ['u64'],
  'request_full_refund': ['u64'],
  'request_deduction': ['u64', 'i128', 'string'],
  'respond_to_deduction': ['u64', 'bool'],
  'raise_dispute': ['u64', 'address', 'string', 'string'],
  'settle': ['u64'],
  'get_agreement': ['u64'],

  // Dispute contract methods
  'submit_evidence': ['u64', 'address', 'string'],
  'resolve_dispute': ['u64', 'i128', 'i128'],
  'get_dispute': ['u64'],
  'get_dispute_by_agreement': ['u64'],
};

function convertArg(arg: unknown) {
  if (typeof arg === 'string' && (arg.startsWith('G') || arg.startsWith('C')) && arg.length === 56) {
    return new Address(arg).toScVal();
  }
  return nativeToScVal(arg);
}

function convertArgsForMethod(method: string, args: unknown[]): any[] {
  const types = METHOD_PARAMETER_TYPES[method];
  if (!types) {
    return args.map(convertArg);
  }

  return args.map((arg, index) => {
    const type = types[index];
    if (!type) return convertArg(arg);

    if (arg === null || arg === undefined) {
      return xdr.ScVal.scvVoid();
    }

    switch (type) {
      case 'address':
        return new Address(String(arg)).toScVal();
      case 'string':
        return xdr.ScVal.scvString(String(arg));
      case 'bool':
        return xdr.ScVal.scvBool(Boolean(arg));
      case 'u64': {
        const valStr = String(arg);
        return xdr.ScVal.scvU64(xdr.Uint64.fromString(valStr));
      }
      case 'i128': {
        const valStr = String(arg);
        const isNegative = valStr.startsWith('-');
        let absVal = BigInt(isNegative ? valStr.slice(1) : valStr);
        
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
      default:
        return convertArg(arg);
    }
  });
}

function extractReturnValue(resultMetaXdr?: any) {
  if (!resultMetaXdr) return undefined;

  try {
    let meta: any;
    if (typeof resultMetaXdr === 'string') {
      meta = xdr.TransactionMeta.fromXDR(resultMetaXdr, 'base64');
    } else {
      meta = resultMetaXdr;
    }

    // TransactionMeta is a union — only v3 contains sorobanMeta.
    // Calling .v3() when the switch is not v3 throws "v3 not set".
    const switchName: string = meta.switch?.()?.name ?? '';
    if (switchName !== 'v3') return undefined;

    const sorobanMeta = meta.v3?.()?.sorobanMeta?.();
    const returnValue = sorobanMeta?.returnValue?.();
    if (!returnValue) return undefined;

    // scvVoid means the function returned () — treat as null, not an error.
    const switchVal: string = (returnValue as any).switch?.()?.name ?? '';
    if (switchVal === 'scvVoid') return null;

    return scValToNative(returnValue as Parameters<typeof scValToNative>[0]);
  } catch (error) {
    console.error('Failed to extract Soroban return value from transaction metadata:', error);
    return undefined;
  }
}

async function waitForTransaction(txHash: string) {
  let attempts = 0;

  while (attempts < 30) {
    const txResponse = (await server.getTransaction(txHash)) as unknown as {
      status: string;
      resultXdr?: string;
      resultMetaXdr?: string;
    };

    if (txResponse.status === 'SUCCESS') {
      return txResponse;
    }

    if (txResponse.status === 'FAILED') {
      const resultDetail = txResponse.resultXdr ?? JSON.stringify(txResponse);
      throw new Error(`Transaction FAILED on-chain: ${resultDetail}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    attempts += 1;
  }

  throw new Error('Transaction timed out in pending or unindexed state');
}

export async function readContractView(contractId: string, method: string, args: unknown[] = []): Promise<unknown> {
  try {
    const contract = new Contract(contractId);
    const source = new Account(DUMMY_PUBLIC_KEY, '0');

    const convertedArgs = convertArgsForMethod(method, args);

    const transaction = new TransactionBuilder(source, {
      fee: '10000',
      networkPassphrase: StellarNetworks.TESTNET,
    })
      .addOperation(contract.call(method, ...convertedArgs))
      .setTimeout(30)
      .build();

    const sim = (await server.simulateTransaction(transaction)) as unknown as { result?: { retval?: unknown } };
    if (sim.result?.retval) {
      return scValToNative(sim.result.retval as Parameters<typeof scValToNative>[0]);
    }
    throw new Error('No return value from simulation');
  } catch (error) {
    console.error(`Error in readContractView for ${method}:`, error);
    throw error;
  }
}

export async function writeContractMethodDetailed(
  contractId: string,
  method: string,
  args: unknown[],
  userAddress: string,
  options?: { network?: 'testnet' | 'mainnet'; walletId?: string },
): Promise<{
  txHash: string;
  returnValue: unknown;
  txResponse: { status: string; resultXdr?: string; resultMetaXdr?: string };
}> {
  try {
    await initializeWalletsKit(options?.network ?? 'testnet', options?.walletId);

    const sourceAccount = await server.getAccount(userAddress);
    const contract = new Contract(contractId);
    const convertedArgs = convertArgsForMethod(method, args);

    let transaction = new TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: StellarNetworks.TESTNET,
    })
      .addOperation(contract.call(method, ...convertedArgs))
      .setTimeout(30)
      .build();

    transaction = await server.prepareTransaction(transaction);

    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(transaction.toXDR());

    const finalTx = TransactionBuilder.fromXDR(signedTxXdr, StellarNetworks.TESTNET);
    const submitResult = (await server.sendTransaction(finalTx)) as unknown as {
      status: string;
      hash: string;
      errorResultXdr?: string;
    };

    if (submitResult.status === 'ERROR') {
      // SDK v16+ — decode error details from extras.result_codes or errorResult.
      const errDetail =
        (submitResult as any).extras?.result_codes
          ? JSON.stringify((submitResult as any).extras.result_codes)
          : (submitResult as any).errorResult?.result?.().switch?.()?.name
            ?? JSON.stringify(submitResult, null, 2);
      console.error('sendTransaction ERROR response:', submitResult);
      throw new Error(`Transaction submission failed: ${errDetail}`);
    }

    // SDK v16 returns PENDING on initial submission. DUPLICATE means already submitted.
    if (submitResult.status !== 'PENDING' && submitResult.status !== 'DUPLICATE') {
      console.warn('Unexpected sendTransaction status:', submitResult.status, submitResult);
    }

    const txHash = submitResult.hash;
    const txResponse = await waitForTransaction(txHash);

    return {
      txHash,
      returnValue: extractReturnValue(txResponse.resultMetaXdr),
      txResponse,
    };
  } catch (error) {
    console.error(`Error in writeContractMethodDetailed for ${method}:`, error);
    throw error;
  }
}

export async function writeContractMethod(
  contractId: string,
  method: string,
  args: unknown[],
  userAddress: string,
  options?: { network?: 'testnet' | 'mainnet'; walletId?: string },
): Promise<string> {
  const result = await writeContractMethodDetailed(contractId, method, args, userAddress, options);
  return result.txHash;
}
