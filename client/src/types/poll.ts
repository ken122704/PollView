export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
}

export interface AnalysisSummary {
  winner: string;
  winnerPercentage: string;
  totalVotes: number;
  breakdown: { label: string; votes: number; percentage: string }[];
  generatedAt: string;
}