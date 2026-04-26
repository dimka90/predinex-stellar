export interface Dispute {
  id: number;
  poolId: number;
  poolTitle: string;
  disputer: string;
  disputeBond: number;
  disputeReason: string;
  votingDeadline: number;
  votesFor: number;
  votesAgainst: number;
  status: 'active' | 'resolved';
  resolution?: boolean;
  createdAt: number;
}

export interface DisputeVote {
  disputeId: number;
  voter: string;
  vote: boolean;
  votedAt: number;
}

export type DisputeTabId = 'active' | 'resolved' | 'create';
