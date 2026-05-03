// pollStore.ts
// ---------------------------------------------------------------------------
// WHY THIS EXISTS:
// When 50 users vote at the same millisecond, naive code does this:
//   1. Read current count (e.g. 10)
//   2. Add 1 → 11
//   3. Write 11 back
// If two requests do step 1 simultaneously they BOTH read 10, both write 11,
// and you lose a vote. This is a classic race condition.
//
// The fix: use a Mutex (mutual exclusion lock). Only ONE vote operation
// runs at a time. Others wait in line. No votes are lost.
// ---------------------------------------------------------------------------

interface PollOption {
  id: string;
  label: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
}

// In-memory store — good enough for a demo, easily swappable for PostgreSQL
const polls: Map<string, Poll> = new Map();

// Simple async mutex implementation
class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (!this.locked) {
          this.locked = true;
          // Return the release function
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

// One mutex per poll — so Poll A's votes don't block Poll B's votes
const pollMutexes: Map<string, Mutex> = new Map();

function getMutex(pollId: string): Mutex {
  if (!pollMutexes.has(pollId)) {
    pollMutexes.set(pollId, new Mutex());
  }
  return pollMutexes.get(pollId)!;
}

// --- Public API ---

export function createPoll(question: string, options: string[]): Poll {
  const poll: Poll = {
    id: `poll_${Date.now()}`,
    question,
    options: options.map((label, i) => ({ id: `opt_${i}`, label, votes: 0 })),
    totalVotes: 0,
  };
  polls.set(poll.id, poll);
  return poll;
}

export function getPoll(pollId: string): Poll | undefined {
  return polls.get(pollId);
}

export function getAllPolls(): Poll[] {
  return Array.from(polls.values());
}

// THE CRITICAL FUNCTION — atomic vote with mutex protection
export async function castVote(
  pollId: string,
  optionId: string
): Promise<Poll | null> {
  const mutex = getMutex(pollId);

  // Acquire the lock — if another vote is in progress, this WAITS here
  const release = await mutex.acquire();

  try {
    const poll = polls.get(pollId);
    if (!poll) return null;

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) return null;

    // Safe to read and write — we own the lock
    option.votes += 1;
    poll.totalVotes += 1;

    return { ...poll, options: [...poll.options] }; // return a copy
  } finally {
    // ALWAYS release, even if an error is thrown
    release();
  }
}

// Seed one default poll so the app works immediately on startup
export function seedDefaultPoll(): Poll {
  return createPoll('What is your favorite programming language?', [
    'TypeScript',
    'Python',
    'Rust',
    'Go',
  ]);
}