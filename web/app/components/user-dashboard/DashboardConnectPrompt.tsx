import { Wallet } from 'lucide-react';

export function DashboardConnectPrompt() {
  return (
    <div className="glass p-8 rounded-2xl border border-border text-center">
      <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-lg font-bold mb-2">Connect Wallet to View Dashboard</p>
      <p className="text-muted-foreground">Connect your wallet to see your betting history and statistics.</p>
    </div>
  );
}
