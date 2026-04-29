export const ORACLE_MANAGEMENT_PLACEHOLDER_FLAG =
  'NEXT_PUBLIC_ENABLE_ORACLE_MANAGEMENT_PLACEHOLDER';

export const DISPUTE_MOCK_DATA_FLAG = 'NEXT_PUBLIC_ENABLE_DISPUTE_MOCK_DATA';

function readOracleManagementPlaceholderFlag(): string | undefined {
  // Next.js automatically makes NEXT_PUBLIC_* variables available on both client and server
  // Using globalThis to access process.env in a type-safe way
  const env = (globalThis as any).process?.env || {};
  return env.NEXT_PUBLIC_ENABLE_ORACLE_MANAGEMENT_PLACEHOLDER;
}

function readDisputeMockDataFlag(): string | undefined {
  // Next.js automatically makes NEXT_PUBLIC_* variables available on both client and server
  // Using globalThis to access process.env in a type-safe way
  const env = (globalThis as any).process?.env || {};
  return env.NEXT_PUBLIC_ENABLE_DISPUTE_MOCK_DATA;
}

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function isOracleManagementPlaceholderEnabled(): boolean {
  return isExplicitlyEnabled(readOracleManagementPlaceholderFlag());
}

export function isDisputeMockDataEnabled(): boolean {
  return isExplicitlyEnabled(readDisputeMockDataFlag());
}
