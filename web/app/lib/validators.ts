/**
 * Validation utilities for form inputs and contract data
 * Provides reusable validation functions
 */

/**
 * Validate pool title
 * @param title Pool title
 * @returns Validation result
 */
import { MAX_POOL_DURATION_SECONDS as MAX_POOL_DURATION_SECS } from './constants';

export { MAX_POOL_DURATION_SECS };
export const MIN_POOL_DURATION_SECS = 300;

export function validatePoolTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title is required' };
  }
  if (title.length > 256) {
    return { valid: false, error: 'Title must be less than 256 characters' };
  }
  if (title.length < 5) {
    return { valid: false, error: 'Title must be at least 5 characters' };
  }
  return { valid: true };
}

/**
 * Validate pool description
 * @param description Pool description
 * @returns Validation result
 */
export function validatePoolDescription(description: string): { valid: boolean; error?: string } {
  if (!description || description.trim().length === 0) {
    return { valid: false, error: 'Description is required' };
  }
  if (description.length > 512) {
    return { valid: false, error: 'Description must be less than 512 characters' };
  }
  if (description.length < 10) {
    return { valid: false, error: 'Description must be at least 10 characters' };
  }
  return { valid: true };
}

/**
 * Validate outcome name
 * @param outcome Outcome name
 * @returns Validation result
 */
export function validateOutcome(outcome: string): { valid: boolean; error?: string } {
  if (!outcome || outcome.trim().length === 0) {
    return { valid: false, error: 'Outcome is required' };
  }
  if (outcome.length > 128) {
    return { valid: false, error: 'Outcome must be less than 128 characters' };
  }
  if (outcome.length < 2) {
    return { valid: false, error: 'Outcome must be at least 2 characters' };
  }
  return { valid: true };
}

/**
 * Validate pool duration in seconds
 * @param duration Duration in seconds
 * @returns Validation result
 */
export function validateDuration(duration: number): { valid: boolean; error?: string } {
  if (!duration || duration <= 0) {
    return { valid: false, error: 'Duration must be greater than 0' };
  }
  if (duration < MIN_POOL_DURATION_SECS) {
    return {
      valid: false,
      error: `Duration must be at least ${MIN_POOL_DURATION_SECS} seconds (5 minutes)`,
    };
  }
  if (duration > MAX_POOL_DURATION_SECS) {
    return {
      valid: false,
      error: `Duration must be less than ${MAX_POOL_DURATION_SECS.toLocaleString()} seconds`,
    };
  }
  return { valid: true };
}

/**
 * Validate bet amount in STX
 * @param amount Bet amount in STX
 * @returns Validation result
 */
export function validateBetAmount(amount: number): { valid: boolean; error?: string } {
  if (!amount || isNaN(amount)) {
    return { valid: false, error: 'Amount is required' };
  }
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }
  if (amount < 0.1) {
    return { valid: false, error: 'Minimum bet is 0.1 XLM' };
  }
  if (amount > 1000000) {
    return { valid: false, error: 'Maximum bet is 1,000,000 XLM' };
  }
  return { valid: true };
}

/**
 * Validate Stellar address format
 * @param address Stellar address (G... strkey)
 * @returns Validation result
 */
export function validateStellarAddress(address: string): { valid: boolean; error?: string } {
  if (!address) {
    return { valid: false, error: 'Address is required' };
  }
  // Stellar public keys (strkey) are 56 characters starting with G
  if (!address.match(/^G[A-Z2-7]{55}$/)) {
    return { valid: false, error: 'Invalid Stellar address format' };
  }
  return { valid: true };
}

// Mainnet addresses begin with SP or SM; testnet addresses begin with ST or SN.
const NETWORK_ADDRESS_PREFIXES: Record<'mainnet' | 'testnet', string[]> = {
  mainnet: ['SP', 'SM'],
  testnet: ['ST', 'SN'],
};

/**
 * Validate that a contract identifier (C... strkey) is well-formed.
 *
 * @param contractId  Full contract identifier, e.g. `CCZABC...XYZ`
 * @param _network    Target network (kept for interface compatibility)
 * @returns Validation result with an actionable error message on failure
 */
export function validateContractId(
  contractId: string,
  _network: 'mainnet' | 'testnet'
): { valid: boolean; error?: string } {
  if (!contractId || contractId.trim().length === 0) {
    return { valid: false, error: 'Contract identifier is required' };
  }

  const id = contractId.trim();
  // Soroban contract IDs are 56 characters starting with C
  if (!/^C[A-Z2-7]{55}$/.test(id)) {
    return {
      valid: false,
      error: `Invalid contract identifier '${id}'. Soroban contract IDs must be 56 characters starting with C.`,
    };
  }

  return { valid: true };
}

/**
 * Validate withdrawal amount
 * @param amount Withdrawal amount
 * @param availableBalance Available balance
 * @returns Validation result
 */
export function validateWithdrawalAmount(
  amount: number,
  availableBalance: number
): { valid: boolean; error?: string } {
  if (!amount || amount <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }
  if (amount > availableBalance) {
    return { valid: false, error: 'Insufficient balance' };
  }
  return { valid: true };
}

/**
 * Validate pool creation form
 * @param data Form data
 * @returns Validation result
 */
export function validatePoolCreationForm(data: {
  title: string;
  description: string;
  outcomeA: string;
  outcomeB: string;
  duration: number;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const titleValidation = validatePoolTitle(data.title);
  if (!titleValidation.valid) errors.title = titleValidation.error!;

  const descriptionValidation = validatePoolDescription(data.description);
  if (!descriptionValidation.valid) errors.description = descriptionValidation.error!;

  const outcomeAValidation = validateOutcome(data.outcomeA);
  if (!outcomeAValidation.valid) errors.outcomeA = outcomeAValidation.error!;

  const outcomeBValidation = validateOutcome(data.outcomeB);
  if (!outcomeBValidation.valid) errors.outcomeB = outcomeBValidation.error!;

  const durationValidation = validateDuration(data.duration);
  if (!durationValidation.valid) errors.duration = durationValidation.error!;

  // Check outcomes are different
  if (data.outcomeA.toLowerCase() === data.outcomeB.toLowerCase()) {
    errors.outcomeB = 'Outcomes must be different';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
