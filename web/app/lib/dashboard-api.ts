// Enhanced contract integration for dashboard data

import { fetchCallReadOnlyFunction, cvToValue, principalCV, uintCV } from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET, type StacksNetwork } from "@stacks/network";
import { UserBet, BetHistory, DashboardData } from "./dashboard-types";
import { PoolData } from "./market-types";
import { fetchAllPools, getEnhancedPool } from "./enhanced-stacks-api";
import { 
  calculatePortfolio, 
  calculatePotentialWinnings, 
  calculateActualWinnings,
  processMarketStatistics,
  calculatePlatformMetrics,
  isClaimEligible,
  calculateBetProfitLoss
} from "./dashboard-utils";
import { getRuntimeConfig } from "./runtime-config";

function getStacksNetwork(): StacksNetwork {
  const cfg = getRuntimeConfig();
  return cfg.network === 'testnet' ? STACKS_TESTNET : STACKS_MAINNET;
}

/**
 * Get all user bets for a specific address
 */
export async function getUserBets(userAddress: string): Promise<UserBet[]> {
  try {
    const cfg = getRuntimeConfig();
    const network = getStacksNetwork();
    // Get all pools to check for user bets
    const pools = await fetchAllPools();
    const userBets: UserBet[] = [];
    
    for (const pool of pools) {
      try {
        const result = await fetchCallReadOnlyFunction({
          contractAddress: cfg.contract.address,
          contractName: cfg.contract.name,
          functionName: 'get-user-bet',
          functionArgs: [uintCV(pool.poolId), principalCV(userAddress)],
          senderAddress: cfg.contract.address,
          network,
        });

        const betData = cvToValue(result, true);
        if (betData && (betData['amount-a'] > 0 || betData['amount-b'] > 0)) {
          // User has bets in this pool
          const amountA = Number(betData['amount-a'] || 0);
          const amountB = Number(betData['amount-b'] || 0);
          const totalBet = Number(betData['total-bet'] || 0);
          
          // Determine which outcome was chosen and create bet records
          if (amountA > 0) {
            const bet = await createUserBet(pool, userAddress, 'A', amountA);
            if (bet) userBets.push(bet);
          }
          
          if (amountB > 0) {
            const bet = await createUserBet(pool, userAddress, 'B', amountB);
            if (bet) userBets.push(bet);
          }
        }
      } catch (error) {
        console.error(`Failed to get user bet for pool ${pool.poolId}:`, error);
      }
    }
    
    return userBets;
  } catch (error) {
    console.error('Failed to get user bets:', error);
    return [];
  }
}

/**
 * Create a UserBet object from pool data and bet information
 */
async function createUserBet(
  pool: PoolData,
  userAddress: string,
  outcome: 'A' | 'B',
  betAmount: number
): Promise<UserBet | null> {
  try {
    const currentBlockHeight = 150000; // Mock current block height
    
    // Determine market status
    let status: 'active' | 'won' | 'lost' | 'expired' = 'active';
    let claimStatus: 'unclaimed' | 'claimed' | 'not_eligible' = 'not_eligible';
    let claimableAmount = 0;
    
    if (pool.settled) {
      const winningOutcome = pool.winningOutcome === 0 ? 'A' : 'B';
      status = outcome === winningOutcome ? 'won' : 'lost';
      
      if (status === 'won') {
        claimableAmount = calculateActualWinnings(
          betAmount,
          Number(pool.totalA),
          Number(pool.totalB),
          outcome,
          winningOutcome
        );
        
        // Check if already claimed (mock implementation)
        const alreadyClaimed = await checkIfClaimed(pool.poolId, userAddress);
        claimStatus = alreadyClaimed ? 'claimed' : 'unclaimed';
      }
    } else if (currentBlockHeight > pool.expiry) {
      status = 'expired';
    }
    
    const potentialWinnings = status === 'active' 
      ? calculatePotentialWinnings(
          betAmount,
          Number(pool.totalA),
          Number(pool.totalB),
          outcome
        )
      : 0;
    
    const currentOdds = calculateCurrentOdds(
      Number(pool.totalA),
      Number(pool.totalB),
      outcome
    );
    
    return {
      poolId: pool.poolId,
      marketTitle: pool.title,
      outcomeChosen: outcome,
      outcomeName: outcome === 'A' ? pool.outcomeAName : pool.outcomeBName,
      amountBet: betAmount,
      betTimestamp: pool.createdAt, // Mock: use pool creation time
      currentOdds,
      potentialWinnings,
      status,
      claimStatus,
      claimableAmount: claimableAmount > 0 ? claimableAmount : undefined
    };
  } catch (error) {
    console.error('Failed to create user bet:', error);
    return null;
  }
}

/**
 * Check if user has already claimed winnings for a pool
 */
async function checkIfClaimed(poolId: number, userAddress: string): Promise<boolean> {
  try {
    const cfg = getRuntimeConfig();
    const network = getStacksNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: cfg.contract.address,
      contractName: cfg.contract.name,
      functionName: 'get-user-bet', // This would need to be enhanced to track claims
      functionArgs: [uintCV(poolId), principalCV(userAddress)],
      senderAddress: cfg.contract.address,
      network,
    });
    
    // Mock implementation - in real app, would check claims map
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Calculate current odds for a specific outcome
 */
function calculateCurrentOdds(totalA: number, totalB: number, outcome: 'A' | 'B'): number {
  const total = totalA + totalB;
  if (total === 0) return 50;
  
  const outcomeAmount = outcome === 'A' ? totalA : totalB;
  return Math.round((outcomeAmount / total) * 100);
}

/**
 * Get complete dashboard data for a user
 */
export async function fetchDashboardData(userAddress: string): Promise<DashboardData> {
  try {
    // Fetch user bets
    const userBets = await getUserBets(userAddress);
    
    // Separate active bets and history
    const activeBets = userBets.filter(bet => bet.status === 'active');
    const betHistory: BetHistory[] = userBets.map(bet => ({
      ...bet,
      marketStatus: bet.status === 'active' ? 'active' : 'settled',
      profitLoss: calculateBetProfitLoss(bet as BetHistory),
      actualWinnings: bet.status === 'won' ? bet.claimableAmount : undefined
    }));
    
    // Calculate portfolio
    const userPortfolio = calculatePortfolio(userBets);
    
    // Get market statistics
    const pools = await fetchAllPools();
    const marketStats = processMarketStatistics(pools);
    
    // Calculate platform metrics
    const platformMetrics = calculatePlatformMetrics(pools, userBets);
    
    return {
      userPortfolio,
      activeBets,
      betHistory,
      marketStats,
      platformMetrics,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    throw error;
  }
}

/**
 * Get claimable winnings for a user
 */
export async function getClaimableWinnings(userAddress: string): Promise<UserBet[]> {
  const userBets = await getUserBets(userAddress);
  return userBets.filter(isClaimEligible);
}

/**
 * Execute claim transaction for a specific pool
 */
export async function claimWinnings(poolId: number): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // This would integrate with the wallet to execute the claim transaction
    // For now, return a mock success response
    return {
      success: true,
      txId: `mock-tx-${poolId}-${Date.now()}`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
