export const ORACLE_MANAGEMENT_PLACEHOLDER_FLAG =
  'NEXT_PUBLIC_ENABLE_ORACLE_MANAGEMENT_PLACEHOLDER';

function readOracleManagementPlaceholderFlag(): string | undefined {
  return typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_ENABLE_ORACLE_MANAGEMENT_PLACEHOLDER
    : undefined;
}

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function isOracleManagementPlaceholderEnabled(): boolean {
  return isExplicitlyEnabled(readOracleManagementPlaceholderFlag());
}
