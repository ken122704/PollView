interface PollOption {
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

const polls: Map<string, Poll> = new Map();

class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          resolve(() => {
            this.locked = false;
            if (this.queue.length > 0) {
              const next = this.queue.shift()!;
              next();
            }
          });
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}

const pollMutexes: Map<string, Mutex> = new Map();

function getMutex(pollId: string): Mutex {
  if (!pollMutexes.has(pollId)) {
    pollMutexes.set(pollId, new Mutex());
  }
  return pollMutexes.get(pollId)!;
}

function generateShortCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function createPoll(question: string, options: string[]): Poll {
  const poll: Poll = {
    id: `poll_${Date.now()}`,
    shortCode: generateShortCode(),
    question,
    options: options.map((label, i) => ({ id: `opt_${i}`, label, votes: 0 })),
    totalVotes: 0,
    status: 'waiting',
  };
  polls.set(poll.id, poll);
  return poll;
}

export function getPoll(pollId: string): Poll | undefined {
  return polls.get(pollId);
}

export function getPollByShortCode(shortCode: string): Poll | undefined {
  return Array.from(polls.values()).find(p => p.shortCode === shortCode);
}

export function getAllPolls(): Poll[] {
  return Array.from(polls.values());
}

export function updatePollStatus(pollId: string, status: 'waiting' | 'active' | 'closed'): Poll | null {
  const poll = polls.get(pollId);
  if (!poll) return null;
  poll.status = status;
  polls.set(pollId, poll);
  return poll;
}

export async function castVote(
  pollId: string,
  optionId: string
): Promise<Poll | null> {
  const mutex = getMutex(pollId);
  const release = await mutex.acquire();

  try {
    const poll = polls.get(pollId);
    if (!poll) return null;

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) return null;

    option.votes += 1;
    poll.totalVotes += 1;

    return { ...poll, options: [...poll.options] }; 
  } finally {
    release();
  }
}

export function seedDefaultPoll(): Poll {
  const poll = createPoll('Which frontend framework do you use the most in production?', [
    'React',
    'Vue',
    'Angular',
    'Svelte',
  ]);
  // Start the default poll as active for testing
  poll.status = 'active'; 
  return poll;
}

export function updatePoll(
  pollId: string,
  question: string,
  options: string[]
): Poll | null {
  const poll = polls.get(pollId);
  if (!poll) return null;

  const updatedOptions: PollOption[] = options.map((label, i) => {
    const existing = poll.options.find(o => o.label === label);
    return {
      id: existing?.id ?? `opt_${i}_${Date.now()}`,
      label,
      votes: existing?.votes ?? 0,
    };
  });

  const totalVotes = updatedOptions.reduce((sum, o) => sum + o.votes, 0);

  const updated: Poll = {
    ...poll,
    question,
    options: updatedOptions,
    totalVotes,
  };

  polls.set(pollId, updated);
  return { ...updated, options: [...updated.options] };
}