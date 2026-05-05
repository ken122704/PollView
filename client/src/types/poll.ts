export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  shortCode: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  status: 'waiting' | 'active' | 'closed';
}

export interface AnalysisSummary {
  pollId: string;
  question: string;
  totalVotes: number;
  winner: string;
  winnerVotes: number;
  winnerPercentage: string | number;
  breakdown: Array<{
    label: string;
    votes: number;
    percentage: string | number;
  }>;
  generatedAt: string;
}