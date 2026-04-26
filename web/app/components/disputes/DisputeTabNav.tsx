import type { DisputeTabId } from '@/app/lib/disputes/types';

const TABS: { key: DisputeTabId; label: string }[] = [
  { key: 'active', label: 'Active Disputes' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'create', label: 'Create Dispute' },
];

interface DisputeTabNavProps {
  selected: DisputeTabId;
  onSelect: (tab: DisputeTabId) => void;
}

export function DisputeTabNav({ selected, onSelect }: DisputeTabNavProps) {
  return (
    <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onSelect(tab.key)}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            selected === tab.key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
