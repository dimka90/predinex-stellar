import type { Dispute, DisputeVote } from '@/app/lib/disputes/types';
import { ActiveDisputeCard } from './ActiveDisputeCard';

interface ActiveDisputesSectionProps {
  disputes: Dispute[];
  now: number;
  isLoading: boolean;
  hasUserVoted: (id: number) => boolean;
  getUserVote: (id: number) => DisputeVote | undefined;
  onVote: (disputeId: number, vote: boolean) => void;
}

export function ActiveDisputesSection({
  disputes,
  now,
  isLoading,
  hasUserVoted,
  getUserVote,
  onVote,
}: ActiveDisputesSectionProps) {
  const activeDisputes = disputes.filter((d) => d.status === 'active');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Active Disputes</h3>
        <div className="text-sm text-muted-foreground">{activeDisputes.length} active disputes</div>
      </div>

      {activeDisputes.length === 0 ? (
        <div className="glass p-8 rounded-xl text-center">
          <div className="text-muted-foreground">No active disputes</div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeDisputes.map((dispute) => {
            const userVote = getUserVote(dispute.id);
            const canVote = !hasUserVoted(dispute.id) && dispute.votingDeadline > now;

            return (
              <ActiveDisputeCard
                key={dispute.id}
                dispute={dispute}
                now={now}
                isLoading={isLoading}
                userVote={userVote}
                canVote={canVote}
                onVoteFor={() => onVote(dispute.id, true)}
                onVoteAgainst={() => onVote(dispute.id, false)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
