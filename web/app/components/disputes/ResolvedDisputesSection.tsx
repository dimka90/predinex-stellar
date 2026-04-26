import type { Dispute } from '@/app/lib/disputes/types';
import { ResolvedDisputeCard } from './ResolvedDisputeCard';

interface ResolvedDisputesSectionProps {
  disputes: Dispute[];
}

export function ResolvedDisputesSection({ disputes }: ResolvedDisputesSectionProps) {
  const resolvedDisputes = disputes.filter((d) => d.status === 'resolved');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Resolved Disputes</h3>
        <div className="text-sm text-muted-foreground">{resolvedDisputes.length} resolved disputes</div>
      </div>

      <div className="space-y-4">
        {resolvedDisputes.map((dispute) => (
          <ResolvedDisputeCard key={dispute.id} dispute={dispute} />
        ))}
      </div>
    </div>
  );
}
