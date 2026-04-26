interface CreateDisputeSectionProps {
  isLoading: boolean;
}

export function CreateDisputeSection({ isLoading }: CreateDisputeSectionProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Create New Dispute</h3>

      <div className="glass p-6 rounded-xl">
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="block text-sm font-medium mb-2">Pool ID</label>
            <input
              type="number"
              placeholder="Enter pool ID to dispute"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Dispute Reason</label>
            <textarea
              rows={4}
              placeholder="Explain why you believe the automated resolution was incorrect. Provide specific evidence and sources."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Evidence Hash (Optional)</label>
            <input
              type="text"
              placeholder="Hash of supporting evidence (IPFS, etc.)"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <div className="text-yellow-500 mt-0.5">⚠️</div>
              <div className="text-sm">
                <div className="font-semibold text-yellow-500 mb-1">Dispute Bond Required</div>
                <div className="text-muted-foreground">
                  Creating a dispute requires a bond equal to 5% of the total pool value. This bond will be
                  refunded if the dispute is upheld, or forfeited if rejected.
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating Dispute...' : 'Create Dispute'}
          </button>
        </form>
      </div>

      <div className="glass p-4 rounded-lg">
        <h4 className="font-semibold mb-2">Dispute Process</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Disputes can only be created for settled pools</li>
          <li>• Community voting period lasts 48 hours</li>
          <li>• Simple majority determines the outcome</li>
          <li>• Upheld disputes result in bond refund and fee refund</li>
          <li>• Rejected disputes result in bond forfeiture</li>
        </ul>
      </div>
    </div>
  );
}
