/**
 * Persists known escrow contract IDs per wallet in localStorage.
 * Source of truth for dashboard "My Agreements" — bridges the gap when
 * event-based discovery misses newly created contracts not yet propagated.
 */

const STORAGE_KEY = 'rentsafe_known_escrows_v1';

interface KnownEscrowStore { [walletAddress: string]: string[]; }

export function getKnownEscrowIds(walletAddress: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: KnownEscrowStore = JSON.parse(raw);
    return parsed[walletAddress.toUpperCase()] || [];
  } catch { return []; }
}

export function addKnownEscrowId(walletAddress: string, contractId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: KnownEscrowStore = raw ? JSON.parse(raw) : {};
    const key = walletAddress.toUpperCase();
    const existing = parsed[key] || [];
    if (!existing.includes(contractId)) {
      parsed[key] = [contractId, ...existing].slice(0, 50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch (e) { console.error('Failed to persist known escrow ID:', e); }
}

export function markSettlementProposed(contractId: string, proposerAddress: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`prop_${contractId.toUpperCase()}`, proposerAddress);
  } catch (e) {
    console.error('Failed to mark settlement proposer:', e);
  }
}

export function getSettlementProposer(contractId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(`prop_${contractId.toUpperCase()}`);
  } catch {
    return null;
  }
}

export function clearSettlementProposer(contractId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`prop_${contractId.toUpperCase()}`);
  } catch (e) {
    console.error('Failed to clear settlement proposer:', e);
  }
}
