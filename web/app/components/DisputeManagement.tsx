"use client";

import { useState, useEffect } from 'react';
import { useWallet } from './WalletAdapterProvider';
import { useDisputes } from '../lib/hooks/useDisputes';
import { fetchPredinexContractEvents, predinexReadApi } from '../lib/adapters/predinex-read-api';

interface Dispute {
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

interface DisputeVote {
  disputeId: number;
  voter: string;
  vote: boolean;
  votedAt: number;
}

async function fetchDisputesFromContract(): Promise<Dispute[]> {
  try {
    const data = await fetchPredinexContractEvents(100);
    
    const disputes: Dispute[] = [];
    const events = data.results || [];
    
    for (const event of events) {
      if (event.event === 'smart_contract_event' && event.data.event_name === 'dispute-created') {
        const eventData = event.data.event_data;
        const pool = await predinexReadApi.getPool(eventData.pool_id);
        
        disputes.push({
          id: Number(eventData.dispute_id),
          poolId: Number(eventData.pool_id),
          poolTitle: pool?.title || `Pool #${eventData.pool_id}`,
          disputer: eventData.disputer,
          disputeBond: Number(eventData.bond),
          disputeReason: eventData.reason || 'Dispute reason not available',
          votingDeadline: Number(eventData.voting_deadline),
          votesFor: 0,
          votesAgainst: 0,
          status: 'active',
          createdAt: Number(eventData.created_at)
        });
      }
    }
    
    return disputes;
  } catch (error) {
    console.error('Failed to fetch disputes from contract:', error);
    return [];
  }
}

export default function DisputeManagement() {
  const { address } = useWallet();
  const { disputes: hookDisputes, addVote } = useDisputes();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [userVotes, setUserVotes] = useState<DisputeVote[]>([]);
  const [selectedTab, setSelectedTab] = useState<'active' | 'resolved' | 'create'>('active');
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(0);

  const userAddress = address;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadDisputes() {
      setIsLoading(true);
      try {
        const fetchedDisputes = await fetchDisputesFromContract();
        if (fetchedDisputes.length > 0) {
          setDisputes(fetchedDisputes);
        } else {
          const mockDisputes: Dispute[] = [
            {
              id: 0,
              poolId: 1,
              poolTitle: "Bitcoin $100K Prediction",
              disputer: "SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QKA",
              disputeBond: 115000,
              disputeReason: "The automated resolution used incorrect price data.",
              votingDeadline: Date.now() + 86400000,
              votesFor: 3,
              votesAgainst: 7,
              status: 'active',
              createdAt: Date.now() - 3600000
            },
            {
              id: 1,
              poolId: 2,
              poolTitle: "Weather Forecast NYC",
              disputer: "SP2JXKMSH007NPYAQHKJPQMAQYAD90NQGTVJVQ02B",
              disputeBond: 50000,
              disputeReason: "Official weather service data contradicts the oracle's reading.",
              votingDeadline: Date.now() - 3600000,
              votesFor: 8,
              votesAgainst: 2,
              status: 'resolved',
              resolution: true,
              createdAt: Date.now() - 172800000
            }
          ];
          setDisputes(mockDisputes);
        }
      } catch (error) {
        console.error('Error loading disputes:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadDisputes();
  }, []);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const formatSTX = (microSTX: number) => {
    return (microSTX / 1000000).toFixed(2);
  };

  const formatTimeRemaining = (deadline: number) => {
    if (now === 0) return 'Loading...';
    const remaining = deadline - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  const hasUserVoted = (disputeId: number) => {
    return userVotes.some(vote => vote.disputeId === disputeId);
  };

  const getUserVote = (disputeId: number) => {
    return userVotes.find(vote => vote.disputeId === disputeId);
  };

  const handleVote = async (disputeId: number, vote: boolean) => {
    if (!userAddress) return;
    setIsLoading(true);
    
    try {
      const voteData = await addVote(disputeId.toString(), userAddress, vote, 1000000);
      if (voteData) {
        const newVote: DisputeVote = {
          disputeId,
          voter: userAddress,
          vote,
          votedAt: Date.now(),
        };
        setUserVotes(prev => [...prev, newVote]);
        
        setDisputes(prev => prev.map(d => {
          if (d.id === disputeId) {
            return {
              ...d,
              votesFor: vote ? d.votesFor + 1 : d.votesFor,
              votesAgainst: !vote ? d.votesAgainst + 1 : d.votesAgainst
            };
          }
          return d;
        }));
      }
    } catch (error) {
      console.error('Failed to cast vote:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderActiveDisputes = () => {
    const activeDisputes = disputes.filter(d => d.status === 'active');
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">Active Disputes</h3>
          <div className="text-sm text-muted-foreground">
            {activeDisputes.length} active disputes
          </div>
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
                <div key={dispute.id} className="glass p-6 rounded-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm">Dispute #{dispute.id}</span>
                        <span className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded text-xs">
                          Active
                        </span>
                      </div>
                      <h4 className="font-semibold text-lg mb-1">{dispute.poolTitle}</h4>
                      <div className="text-sm text-muted-foreground">
                        Pool #{dispute.poolId} • Disputed by {formatAddress(dispute.disputer)}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {formatSTX(dispute.disputeBond)} STX bond
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeRemaining(dispute.votingDeadline)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-sm font-medium mb-2">Dispute Reason:</div>
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      {dispute.disputeReason}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex space-x-6">
                      <div>
                        <div className="text-sm text-muted-foreground">Votes For</div>
                        <div className="text-lg font-semibold text-green-500">{dispute.votesFor}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Votes Against</div>
                        <div className="text-lg font-semibold text-red-500">{dispute.votesAgainst}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Current Outcome</div>
                        <div className={`text-sm font-semibold ${
                          dispute.votesFor > dispute.votesAgainst ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {dispute.votesFor > dispute.votesAgainst ? 'Upheld' : 'Rejected'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {userVote ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">You voted:</span>
                      <span className={`font-semibold ${userVote.vote ? 'text-green-500' : 'text-red-500'}`}>
                        {userVote.vote ? 'FOR' : 'AGAINST'}
                      </span>
                    </div>
                  ) : canVote ? (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleVote(dispute.id, true)}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                      >
                        Vote FOR Dispute
                      </button>
                      <button
                        onClick={() => handleVote(dispute.id, false)}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        Vote AGAINST Dispute
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Voting period has ended
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderResolvedDisputes = () => {
    const resolvedDisputes = disputes.filter(d => d.status === 'resolved');
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">Resolved Disputes</h3>
          <div className="text-sm text-muted-foreground">
            {resolvedDisputes.length} resolved disputes
          </div>
        </div>
        
        <div className="space-y-4">
          {resolvedDisputes.map((dispute) => (
            <div key={dispute.id} className="glass p-6 rounded-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm">Dispute #{dispute.id}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      dispute.resolution 
                        ? 'bg-green-500/10 text-green-500' 
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {dispute.resolution ? 'Upheld' : 'Rejected'}
                    </span>
                  </div>
                  <h4 className="font-semibold text-lg mb-1">{dispute.poolTitle}</h4>
                  <div className="text-sm text-muted-foreground">
                    Pool #{dispute.poolId} • Disputed by {formatAddress(dispute.disputer)}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {formatSTX(dispute.disputeBond)} STX bond
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dispute.resolution ? 'Refunded' : 'Forfeited'}
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                  {dispute.disputeReason}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex space-x-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Final Votes For</div>
                    <div className="text-lg font-semibold text-green-500">{dispute.votesFor}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Final Votes Against</div>
                    <div className="text-lg font-semibold text-red-500">{dispute.votesAgainst}</div>
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Resolved {new Date(dispute.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCreateDispute = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Create New Dispute</h3>
      
      <div className="glass p-6 rounded-xl">
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Pool ID
            </label>
            <input
              type="number"
              placeholder="Enter pool ID to dispute"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Dispute Reason
            </label>
            <textarea
              rows={4}
              placeholder="Explain why you believe the automated resolution was incorrect. Provide specific evidence and sources."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Evidence Hash (Optional)
            </label>
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
                  Creating a dispute requires a bond equal to 5% of the total pool value. 
                  This bond will be refunded if the dispute is upheld, or forfeited if rejected.
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

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dispute Management</h1>
        <p className="text-muted-foreground">
          Community-driven dispute resolution for automated market settlements
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-muted p-1 rounded-lg">
        {[
          { key: 'active' as const, label: 'Active Disputes' },
          { key: 'resolved' as const, label: 'Resolved' },
          { key: 'create' as const, label: 'Create Dispute' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key)}
            className={`flex-1 px-4 py-2 rounded-md transition-colors ${
              selectedTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {selectedTab === 'active' && renderActiveDisputes()}
        {selectedTab === 'resolved' && renderResolvedDisputes()}
        {selectedTab === 'create' && renderCreateDispute()}
      </div>
    </div>
  );
}