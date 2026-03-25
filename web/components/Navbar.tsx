import Link from 'next/link';
import { useWalletConnection } from '../lib/hooks/useWalletConnection';

export default function Navbar() {
  const { isConnected, connect } = useWalletConnection();

  return (
    <nav aria-label="Main navigation" className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl">Predinex</Link>
        <div className="flex gap-4">
             <Link href="/markets">Markets</Link>
             <Link href="/create">Create</Link>
             <Link href="/rewards">Rewards</Link>
        </div>
        <button onClick={connect} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            {isConnected ? 'Connected' : 'Connect Wallet'}
        </button>
      </div>
    </nav>
  );
}
// Generic navigation bar for all pages
