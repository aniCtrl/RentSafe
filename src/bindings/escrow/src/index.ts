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
  5: {message:"InvalidAmount"},
  6: {message:"DisputeContractAlreadySet"},
  7: {message:"DisputeContractNotSet"},
  8: {message:"ProposedSplitMismatch"},
  9: {message:"NoActiveProposal"}
}

export enum State {
  Created = 0,
  Funded = 1,
  Active = 2,
  SettlementRequested = 3,
  Disputed = 4,
  Resolved = 5,
  Closed = 6,
}

export type DataKey = {tag: "Landlord", values: void} | {tag: "Tenant", values: void} | {tag: "Arbitrator", values: void} | {tag: "Token", values: void} | {tag: "Amount", values: void} | {tag: "DisputeContract", values: void} | {tag: "State", values: void} | {tag: "ProposedLandlord", values: void} | {tag: "ProposedTenant", values: void} | {tag: "ProposedBy", values: void};

export interface Client {
  /**
   * Construct and simulate a fund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fund the escrow. Tenant deposits the amount.
   */
  fund: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Raise a dispute. Callable by landlord or tenant when lease is Active or SettlementRequested.
   */
  dispute: ({caller, evidence_hash}: {caller: string, evidence_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract WASM. Only callable by the arbitrator.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a activate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Activate the escrow (lease start). Callable by the landlord.
   */
  activate: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_state: (options?: MethodOptions) => Promise<AssembledTransaction<Result<State>>>

  /**
   * Construct and simulate a get_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_token: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_amount transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_amount: (options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_tenant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_tenant: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the Escrow agreement. Can only be called once.
   */
  initialize: ({landlord, tenant, arbitrator, token, amount}: {landlord: string, tenant: string, arbitrator: string, token: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_landlord transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_landlord: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_arbitrator transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_arbitrator: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Callback function called ONLY by the linked Dispute contract to execute resolution payouts.
   */
  resolve_dispute: ({landlord_share, tenant_share}: {landlord_share: i128, tenant_share: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a accept_settlement transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accept the proposed settlement. Called by the counterparty.
   */
  accept_settlement: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a request_settlement transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Request a mutual settlement split. Called by landlord or tenant.
   */
  request_settlement: ({caller, landlord_share, tenant_share}: {caller: string, landlord_share: i128, tenant_share: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_dispute_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_dispute_contract: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a set_dispute_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Link the Dispute contract address. Only callable once by the arbitrator.
   */
  set_dispute_contract: ({dispute_contract}: {dispute_contract: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

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
      new ContractSpec([ "AAAAAAAAACxGdW5kIHRoZSBlc2Nyb3cuIFRlbmFudCBkZXBvc2l0cyB0aGUgYW1vdW50LgAAAARmdW5kAAAAAAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAFxSYWlzZSBhIGRpc3B1dGUuIENhbGxhYmxlIGJ5IGxhbmRsb3JkIG9yIHRlbmFudCB3aGVuIGxlYXNlIGlzIEFjdGl2ZSBvciBTZXR0bGVtZW50UmVxdWVzdGVkLgAAAAdkaXNwdXRlAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAANZXZpZGVuY2VfaGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADtVcGdyYWRlIHRoZSBjb250cmFjdCBXQVNNLiBPbmx5IGNhbGxhYmxlIGJ5IHRoZSBhcmJpdHJhdG9yLgAAAAAHdXBncmFkZQAAAAABAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMSW52YWxpZFN0YXRlAAAAAwAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAQAAAAAAAAADUludmFsaWRBbW91bnQAAAAAAAAFAAAAAAAAABlEaXNwdXRlQ29udHJhY3RBbHJlYWR5U2V0AAAAAAAABgAAAAAAAAAVRGlzcHV0ZUNvbnRyYWN0Tm90U2V0AAAAAAAABwAAAAAAAAAVUHJvcG9zZWRTcGxpdE1pc21hdGNoAAAAAAAACAAAAAAAAAAQTm9BY3RpdmVQcm9wb3NhbAAAAAk=",
        "AAAAAwAAAAAAAAAAAAAABVN0YXRlAAAAAAAABwAAAAAAAAAHQ3JlYXRlZAAAAAAAAAAAAAAAAAZGdW5kZWQAAAAAAAEAAAAAAAAABkFjdGl2ZQAAAAAAAgAAAAAAAAATU2V0dGxlbWVudFJlcXVlc3RlZAAAAAADAAAAAAAAAAhEaXNwdXRlZAAAAAQAAAAAAAAACFJlc29sdmVkAAAABQAAAAAAAAAGQ2xvc2VkAAAAAAAG",
        "AAAAAAAAADxBY3RpdmF0ZSB0aGUgZXNjcm93IChsZWFzZSBzdGFydCkuIENhbGxhYmxlIGJ5IHRoZSBsYW5kbG9yZC4AAAAIYWN0aXZhdGUAAAAAAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRlAAAAAAAAAAAAAAEAAAPpAAAH0AAAAAVTdGF0ZQAAAAAAAAM=",
        "AAAAAAAAAAAAAAAJZ2V0X3Rva2VuAAAAAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACgAAAAAAAAAAAAAACExhbmRsb3JkAAAAAAAAAAAAAAAGVGVuYW50AAAAAAAAAAAAAAAAAApBcmJpdHJhdG9yAAAAAAAAAAAAAAAAAAVUb2tlbgAAAAAAAAAAAAAAAAAABkFtb3VudAAAAAAAAAAAAAAAAAAPRGlzcHV0ZUNvbnRyYWN0AAAAAAAAAAAAAAAABVN0YXRlAAAAAAAAAAAAAAAAAAAQUHJvcG9zZWRMYW5kbG9yZAAAAAAAAAAAAAAADlByb3Bvc2VkVGVuYW50AAAAAAAAAAAAAAAAAApQcm9wb3NlZEJ5AAA=",
        "AAAAAAAAAAAAAAAKZ2V0X2Ftb3VudAAAAAAAAAAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAAAAAAAAKZ2V0X3RlbmFudAAAAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAADlJbml0aWFsaXplIHRoZSBFc2Nyb3cgYWdyZWVtZW50LiBDYW4gb25seSBiZSBjYWxsZWQgb25jZS4AAAAAAAAKaW5pdGlhbGl6ZQAAAAAABQAAAAAAAAAIbGFuZGxvcmQAAAATAAAAAAAAAAZ0ZW5hbnQAAAAAABMAAAAAAAAACmFyYml0cmF0b3IAAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAMZ2V0X2xhbmRsb3JkAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAAAAAAAOZ2V0X2FyYml0cmF0b3IAAAAAAAAAAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAFtDYWxsYmFjayBmdW5jdGlvbiBjYWxsZWQgT05MWSBieSB0aGUgbGlua2VkIERpc3B1dGUgY29udHJhY3QgdG8gZXhlY3V0ZSByZXNvbHV0aW9uIHBheW91dHMuAAAAAA9yZXNvbHZlX2Rpc3B1dGUAAAAAAgAAAAAAAAAObGFuZGxvcmRfc2hhcmUAAAAAAAsAAAAAAAAADHRlbmFudF9zaGFyZQAAAAsAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAADtBY2NlcHQgdGhlIHByb3Bvc2VkIHNldHRsZW1lbnQuIENhbGxlZCBieSB0aGUgY291bnRlcnBhcnR5LgAAAAARYWNjZXB0X3NldHRsZW1lbnQAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAEBSZXF1ZXN0IGEgbXV0dWFsIHNldHRsZW1lbnQgc3BsaXQuIENhbGxlZCBieSBsYW5kbG9yZCBvciB0ZW5hbnQuAAAAEnJlcXVlc3Rfc2V0dGxlbWVudAAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAA5sYW5kbG9yZF9zaGFyZQAAAAAACwAAAAAAAAAMdGVuYW50X3NoYXJlAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAUZ2V0X2Rpc3B1dGVfY29udHJhY3QAAAAAAAAAAQAAA+kAAAATAAAAAw==",
        "AAAAAAAAAEhMaW5rIHRoZSBEaXNwdXRlIGNvbnRyYWN0IGFkZHJlc3MuIE9ubHkgY2FsbGFibGUgb25jZSBieSB0aGUgYXJiaXRyYXRvci4AAAAUc2V0X2Rpc3B1dGVfY29udHJhY3QAAAABAAAAAAAAABBkaXNwdXRlX2NvbnRyYWN0AAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD" ]),
      options
    )
  }
  public readonly fromJSON = {
    fund: this.txFromJSON<Result<void>>,
        dispute: this.txFromJSON<Result<void>>,
        upgrade: this.txFromJSON<Result<void>>,
        activate: this.txFromJSON<Result<void>>,
        get_state: this.txFromJSON<Result<State>>,
        get_token: this.txFromJSON<Result<string>>,
        get_amount: this.txFromJSON<Result<i128>>,
        get_tenant: this.txFromJSON<Result<string>>,
        initialize: this.txFromJSON<Result<void>>,
        get_landlord: this.txFromJSON<Result<string>>,
        get_arbitrator: this.txFromJSON<Result<string>>,
        resolve_dispute: this.txFromJSON<Result<void>>,
        accept_settlement: this.txFromJSON<Result<void>>,
        request_settlement: this.txFromJSON<Result<void>>,
        get_dispute_contract: this.txFromJSON<Result<string>>,
        set_dispute_contract: this.txFromJSON<Result<void>>
  }
}