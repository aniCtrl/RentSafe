/**
 * Standardizes and translates raw Stellar SDK, Soroban, and wallet errors 
 * into clear, actionable, human-readable messages for the user.
 */
export function translateStellarError(error: unknown): string {
  if (!error) return 'An unknown error occurred.';

  const rawMessage = error instanceof Error 
    ? error.message 
    : (typeof error === 'object' && 'message' in (error as any) 
        ? String((error as any).message) 
        : String(error));

  const lowerMessage = rawMessage.toLowerCase();

  if (lowerMessage.includes('trying to invoke non-existent contract function')) {
    return 'This RentSafe contract is out of date for this action. Ask the platform admin to upgrade the dispute contract, then retry the transaction.';
  }

  // 1. User rejection / Cancellation errors
  if (
    lowerMessage.includes('user closed the modal') || 
    lowerMessage.includes('user rejected') || 
    lowerMessage.includes('connection declined') ||
    lowerMessage.includes('declined by user')
  ) {
    return 'Transaction request cancelled. You rejected the signature in your wallet.';
  }

  // 2. Account / Funding issues
  if (lowerMessage.includes('tx_insufficient_balance') || lowerMessage.includes('underfunded')) {
    return 'Your wallet has insufficient XLM balance to complete this transaction or cover the gas fees.';
  }
  if (lowerMessage.includes('op_no_destination') || lowerMessage.includes('tx_no_source_account')) {
    return 'The wallet account is not active on-chain. Please fund it with at least 1-2 XLM to initialize it.';
  }

  // 3. Soroban VM Contract Errors (mapping enum Error { ... })
  // Gated by: Error(Contract, #X)
  const contractErrorMatch = rawMessage.match(/Error\(Contract,\s*#?(\d+)\)/i);
  if (contractErrorMatch) {
    const errorCode = parseInt(contractErrorMatch[1], 10);
    switch (errorCode) {
      case 1:
        return 'Configuration error: The contract has already been initialized.';
      case 2:
        return 'System error: The contract has not been initialized yet.';
      case 3:
        return 'Access denied: You are not authorized to perform this operation (signature check failed).';
      case 4:
        return 'Invalid amount: The deposit or rent amount must be greater than zero, and deductions cannot exceed the total deposit.';
      case 5:
        return 'Invalid lease range: The lease end date must be strictly after the start date.';
      case 6:
        return 'Not found: The requested rental agreement does not exist in the contract registry.';
      case 7:
        return 'Action not allowed: The agreement is in an invalid status for this operation.';
      case 8:
        return 'Deduction error: There is no active, pending deduction request for this agreement.';
      case 9:
        return 'Dispute unresolved: Payout remains locked until the landlord and tenant complete settlement.';
      case 10:
        return 'Invalid split distribution: The resolution split amounts do not equal the total deposit amount.';
      case 11:
        return 'Arithmetic calculation error: An integer overflow or calculation mismatch occurred inside the contract.';
      default:
        return `Smart contract executed with error code #${errorCode}. Operation aborted.`;
    }
  }

  // 4. General RPC simulation failures
  if (lowerMessage.includes('simulation error') || lowerMessage.includes('simulation failed')) {
    return 'Transaction simulation failed. The smart contract rejected the call. Please verify agreement states or auth permissions.';
  }

  if (lowerMessage.includes('tx_bad_auth') || lowerMessage.includes('bad_auth')) {
    return 'Authentication failure: Signature validation failed. Check if your connected wallet matches the expected role address.';
  }

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Transaction timed out in the ledger queue. Please wait a few seconds and try again.';
  }

  // 5. Default fallback
  return rawMessage;
}
