import { 
  Contract, 
  rpc, 
  scValToNative, 
  TransactionBuilder, 
  Networks as StellarNetworks, 
  Account, 
  Address,
  nativeToScVal
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
export const server = new rpc.Server(RPC_URL);

// Dummy key for simulations (requires no signatures)
const DUMMY_PUBLIC_KEY = 'GBSJ6OLI3XRFWDWJJBW6C3H2EXKMFQQVFEKYNV6DHHGM5FHYJ3M7MM5Y';

// Native XLM Contract address on testnet
export const NATIVE_XLM_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
export const DEFAULT_ESCROW_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || 'CCFATHQC6KASED4FK3V4IYSTN2ODHFC2AW635BXUD66OLPVICA2WN3AG';
export const DEFAULT_DISPUTE_ID = process.env.NEXT_PUBLIC_DISPUTE_CONTRACT_ID || 'CAEPHREYA4AFHY3TVFC2PM5ARRAMNHYLJZQOBX6255T5ASEE3BBQ5KHO';
export const DEFAULT_ARBITRATOR_ID = process.env.NEXT_PUBLIC_ARBITRATOR_ADDRESS || 'GAKY5EWWOETAUQQZJPSW3OD5R2N46BE7G24PAHSHLGYLZGTMOLWE7BXT';
export const DEFAULT_ESCROW_WASM_HASH = process.env.NEXT_PUBLIC_ESCROW_WASM_HASH || '91394c41b75a32ed0a6b60bdedcead1b3ebe41daeb9d35cc41182180318ac83a';
export const DEFAULT_DISPUTE_WASM_HASH = process.env.NEXT_PUBLIC_DISPUTE_WASM_HASH || '0195694beeed00b8e012559132361ff425df2a5f08499cd45cd520d27cc7f8fb';

// Initialize the static wallet kit singleton once
let isKitInitialized = false;

export async function initializeWalletsKit(
  network: 'testnet' | 'mainnet' = 'testnet',
  walletId?: string
) {
  const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
  const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');
  const { Networks: KitNetworks } = await import('@creit.tech/stellar-wallets-kit/types');

  if (!isKitInitialized) {
    StellarWalletsKit.init({
      modules: defaultModules()
    });
    isKitInitialized = true;
  }

  StellarWalletsKit.setNetwork(
    network === 'testnet' ? KitNetworks.TESTNET : KitNetworks.PUBLIC
  );

  if (walletId) {
    StellarWalletsKit.setWallet(walletId);
  }
}

// Convert native types to ScVal (handling Address vs generic types)
function convertArg(arg: any) {
  if (typeof arg === 'string' && (arg.startsWith('G') || arg.startsWith('C')) && arg.length === 56) {
    return new Address(arg).toScVal();
  }
  return nativeToScVal(arg);
}

// Read contract state without signing (simulation)
export async function readContractView(contractId: string, method: string, args: any[] = []): Promise<any> {
  try {
    const contract = new Contract(contractId);
    const source = new Account(DUMMY_PUBLIC_KEY, '0');
    
    const convertedArgs = args.map(convertArg);

    const transaction = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: StellarNetworks.TESTNET,
    })
    .addOperation(contract.call(method, ...convertedArgs))
    .setTimeout(30)
    .build();

    const sim = await server.simulateTransaction(transaction) as any;
    if (sim.result?.retval) {
      return scValToNative(sim.result.retval);
    }
    throw new Error('No return value from simulation');
  } catch (error) {
    console.error(`Error in readContractView for ${method}:`, error);
    throw error;
  }
}

// Write/Submit transaction to contract
export async function writeContractMethod(
  contractId: string,
  method: string,
  args: any[],
  userAddress: string,
  options?: { network?: 'testnet' | 'mainnet'; walletId?: string }
): Promise<string> {
  try {
    await initializeWalletsKit(options?.network ?? 'testnet', options?.walletId);

    // 1. Fetch sequence number of user account
    const sourceAccount = await server.getAccount(userAddress);
    const contract = new Contract(contractId);
    const convertedArgs = args.map(convertArg);

    // 2. Build bare transaction
    let transaction = new TransactionBuilder(sourceAccount, {
      fee: '100', // default inclusion fee
      networkPassphrase: StellarNetworks.TESTNET,
    })
    .addOperation(contract.call(method, ...convertedArgs))
    .setTimeout(30)
    .build();

    // 3. Simulate and prepare transaction (attaches resource footprint and compute fee)
    transaction = await server.prepareTransaction(transaction);

    // 4. Request wallet signature
    const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(transaction.toXDR());

    // 5. Submit signed transaction
    const finalTx = TransactionBuilder.fromXDR(signedTxXdr, StellarNetworks.TESTNET);
    const submitResult = await server.sendTransaction(finalTx) as any;

    if (submitResult.status === 'ERROR') {
      throw new Error(`Transaction submission error: ${JSON.stringify(submitResult.errorResultXdr)}`);
    }

    const txHash = submitResult.hash;
    console.log(`Submitted transaction: ${txHash}. Waiting for mining...`);

    // 6. Poll transaction status
    let status = submitResult.status;
    let attempts = 0;

    if (status === 'SUCCESS') {
      const txResponse = await server.getTransaction(txHash) as any;
      if (txResponse.status === 'SUCCESS') {
        return txHash;
      } else {
        status = txResponse.status;
      }
    }

    while ((status === 'PENDING' || status === 'NOT_FOUND') && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const txResponse = await server.getTransaction(txHash) as any;
      status = txResponse.status;
      
      if (status === 'SUCCESS') {
        return txHash;
      } else if (status === 'FAILED') {
        throw new Error(`Transaction failed: ${JSON.stringify(txResponse.resultXdr)}`);
      }
      attempts++;
    }

    if (status === 'PENDING' || status === 'NOT_FOUND') {
      throw new Error('Transaction timed out in pending or unindexed state');
    }

    return txHash;
  } catch (error) {
    console.error(`Error in writeContractMethod for ${method}:`, error);
    throw error;
  }
}
