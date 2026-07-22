import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"InvalidState"},
  4: {message:"NotAuthorized"},
  5: {message:"InvalidSplit"}
}

export type DataKey = {tag: "EscrowContract", values: void} | {tag: "Arbitrator", values: void} | {tag: "State", values: void} | {tag: "EvidenceHash", values: void} | {tag: "Disputer", values: void};

export enum DisputeState {
  Created = 0,
  Active = 1,
  Resolved = 2,
}

export interface Client {
  /**
   * Construct and simulate a resolve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolve the dispute. Called by the designated arbitrator.
   */
  resolve: ({landlord_share, tenant_share}: {landlord_share: i128, tenant_share: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract WASM. Only callable by the arbitrator.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_state: (options?: MethodOptions) => Promise<AssembledTransaction<Result<DisputeState>>>

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the Dispute contract. Links the Escrow contract and the Arbitrator.
   */
  initialize: ({escrow_contract, arbitrator}: {escrow_contract: string, arbitrator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_disputer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_disputer: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a raise_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Raise a dispute. This is triggered by the Escrow contract.
   */
  raise_dispute: ({disputer, evidence_hash}: {disputer: string, evidence_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_arbitrator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_arbitrator: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_evidence_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_evidence_hash: (options?: MethodOptions) => Promise<AssembledTransaction<Result<Buffer>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAADlSZXNvbHZlIHRoZSBkaXNwdXRlLiBDYWxsZWQgYnkgdGhlIGRlc2lnbmF0ZWQgYXJiaXRyYXRvci4AAAAAAAAHcmVzb2x2ZQAAAAACAAAAAAAAAA5sYW5kbG9yZF9zaGFyZQAAAAAACwAAAAAAAAAMdGVuYW50X3NoYXJlAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAADtVcGdyYWRlIHRoZSBjb250cmFjdCBXQVNNLiBPbmx5IGNhbGxhYmxlIGJ5IHRoZSBhcmJpdHJhdG9yLgAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMSW52YWxpZFN0YXRlAAAAAwAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAQAAAAAAAAADEludmFsaWRTcGxpdAAAAAU=",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRlAAAAAAAAAAAAAAEAAAPpAAAH0AAAAAxEaXNwdXRlU3RhdGUAAAAD",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABQAAAAAAAAAAAAAADkVzY3Jvd0NvbnRyYWN0AAAAAAAAAAAAAAAAAApBcmJpdHJhdG9yAAAAAAAAAAAAAAAAAAVTdGF0ZQAAAAAAAAAAAAAAAAAADEV2aWRlbmNlSGFzaAAAAAAAAAAAAAAACERpc3B1dGVy",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAE5Jbml0aWFsaXplIHRoZSBEaXNwdXRlIGNvbnRyYWN0LiBMaW5rcyB0aGUgRXNjcm93IGNvbnRyYWN0IGFuZCB0aGUgQXJiaXRyYXRvci4AAAAAAAppbml0aWFsaXplAAAAAAACAAAAAAAAAA9lc2Nyb3dfY29udHJhY3QAAAAAEwAAAAAAAAAKYXJiaXRyYXRvcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAMZ2V0X2Rpc3B1dGVyAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAADpSYWlzZSBhIGRpc3B1dGUuIFRoaXMgaXMgdHJpZ2dlcmVkIGJ5IHRoZSBFc2Nyb3cgY29udHJhY3QuAAAAAAANcmFpc2VfZGlzcHV0ZQAAAAAAAAIAAAAAAAAACGRpc3B1dGVyAAAAEwAAAAAAAAANZXZpZGVuY2VfaGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAOZ2V0X2FyYml0cmF0b3IAAAAAAAAAAAABAAAD6QAAABMAAAAD",
        "AAAAAwAAAAAAAAAAAAAADERpc3B1dGVTdGF0ZQAAAAMAAAAAAAAAB0NyZWF0ZWQAAAAAAAAAAAAAAAAGQWN0aXZlAAAAAAABAAAAAAAAAAhSZXNvbHZlZAAAAAI=",
        "AAAAAAAAAAAAAAARZ2V0X2V2aWRlbmNlX2hhc2gAAAAAAAAAAAAAAQAAA+kAAAPuAAAAIAAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    resolve: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<Result<void>>,
        get_state: this.txFromJSON<Result<DisputeState>>,
        get_escrow: this.txFromJSON<Result<string>>,
        initialize: this.txFromJSON<Result<void>>,
        get_disputer: this.txFromJSON<Result<string>>,
        raise_dispute: this.txFromJSON<Result<void>>,
        get_arbitrator: this.txFromJSON<Result<string>>,
        get_evidence_hash: this.txFromJSON<Result<Buffer>>
  }
}