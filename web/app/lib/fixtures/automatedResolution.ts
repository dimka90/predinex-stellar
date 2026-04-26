/**
 * Fixtures for AutomatedResolutionStatus component
 * Static mock data moved out of render-time component
 */

export interface Pool {
  id: number;
  title: string;
  description: string;
  outcomeA: string;
  outcomeB: string;
  totalA: number;
  totalB: number;
  settled: boolean;
  winningOutcome?: number;
  expiry: number;
  creator: string;
}

export interface ResolutionConfig {
  poolId: number;
  oracleSources: number[];
  resolutionCriteria: string;
  criteriaType: string;
  thresholdValue?: number;
  logicalOperator: string;
  retryAttempts: number;
  isAutomated: boolean;
}

export interface ResolutionAttempt {
  poolId: number;
  attemptId: number;
  attemptedAt: number;
  oracleDataUsed: number[];
  result?: number;
  failureReason?: string;
  isSuccessful: boolean;
}

export interface FallbackStatus {
  poolId: number;
  triggeredAt: number;
  failureReason: string;
  maxRetriesReached: boolean;
  manualSettlementEnabled: boolean;
  notifiedCreator: boolean;
}

export const mockPools: Pool[] = [
  {
    id: 1,
    title: "Bitcoin $100K Prediction",
    description: "Will Bitcoin reach $100,000 by end of 2024?",
    outcomeA: "Yes - Above $100K",
    outcomeB: "No - Below $100K",
    totalA: 2500000, // 2.5 STX
    totalB: 1800000, // 1.8 STX
    settled: true,
    winningOutcome: 0,
    expiry: Date.now() - 3600000,
    creator: "SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QKA"
  },
  {
    id: 2,
    title: "Weather Forecast NYC",
    description: "Will it rain in NYC tomorrow?",
    outcomeA: "Rain",
    outcomeB: "No Rain",
    totalA: 800000, // 0.8 STX
    totalB: 1200000, // 1.2 STX
    settled: false,
    expiry: Date.now() + 7200000, // 2 hours from now
    creator: "SP2JXKMSH007NPYAQHKJPQMAQYAD90NQGTVJVQ02B"
  },
  {
    id: 3,
    title: "Sports Championship",
    description: "Who will win the championship?",
    outcomeA: "Team A",
    outcomeB: "Team B",
    totalA: 1500000, // 1.5 STX
    totalB: 1000000, // 1.0 STX
    settled: false,
    expiry: Date.now() - 1800000, // 30 minutes ago (expired)
    creator: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"
  }
];

export const mockConfigs: ResolutionConfig[] = [
  {
    poolId: 1,
    oracleSources: [0, 1],
    resolutionCriteria: "price >= 100000",
    criteriaType: "price",
    thresholdValue: 100000,
    logicalOperator: "OR",
    retryAttempts: 3,
    isAutomated: true
  },
  {
    poolId: 2,
    oracleSources: [1],
    resolutionCriteria: "precipitation > 0",
    criteriaType: "weather",
    logicalOperator: "AND",
    retryAttempts: 2,
    isAutomated: true
  },
  {
    poolId: 3,
    oracleSources: [2],
    resolutionCriteria: "team_a_score > team_b_score",
    criteriaType: "sports",
    logicalOperator: "AND",
    retryAttempts: 3,
    isAutomated: true
  }
];

export const mockAttempts: ResolutionAttempt[] = [
  {
    poolId: 1,
    attemptId: 0,
    attemptedAt: Date.now() - 3600000,
    oracleDataUsed: [0, 1],
    result: 0,
    isSuccessful: true
  },
  {
    poolId: 3,
    attemptId: 0,
    attemptedAt: Date.now() - 1200000,
    oracleDataUsed: [2],
    failureReason: "Oracle data unavailable",
    isSuccessful: false
  },
  {
    poolId: 3,
    attemptId: 1,
    attemptedAt: Date.now() - 600000,
    oracleDataUsed: [2],
    failureReason: "Conflicting oracle data",
    isSuccessful: false
  }
];

export const mockFallbacks: FallbackStatus[] = [
  {
    poolId: 3,
    triggeredAt: Date.now() - 300000,
    failureReason: "Maximum retry attempts reached",
    maxRetriesReached: true,
    manualSettlementEnabled: true,
    notifiedCreator: true
  }
];
