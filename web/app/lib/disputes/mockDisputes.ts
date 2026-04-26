import type { Dispute } from './types';

export function getMockDisputes(): Dispute[] {
  return [
    {
      id: 0,
      poolId: 1,
      poolTitle: 'Bitcoin $100K Prediction',
      disputer: 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QKA',
      disputeBond: 115000,
      disputeReason: 'The automated resolution used incorrect price data.',
      votingDeadline: Date.now() + 86400000,
      votesFor: 3,
      votesAgainst: 7,
      status: 'active',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 1,
      poolId: 2,
      poolTitle: 'Weather Forecast NYC',
      disputer: 'SP2JXKMSH007NPYAQHKJPQMAQYAD90NQGTVJVQ02B',
      disputeBond: 50000,
      disputeReason: "Official weather service data contradicts the oracle's reading.",
      votingDeadline: Date.now() - 3600000,
      votesFor: 8,
      votesAgainst: 2,
      status: 'resolved',
      resolution: true,
      createdAt: Date.now() - 172800000,
    },
  ];
}
