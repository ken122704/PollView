// load-test.mjs
// Run with: node load-test.mjs
//
// Simulates 50 concurrent users joining the same poll room
// and spamming votes as fast as possible for 10 seconds.
// Watch your server terminal — all votes should be counted correctly.

import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';
const NUM_USERS = 50;
const TEST_DURATION_MS = 10_000; // 10 seconds
const VOTE_INTERVAL_MS = 200;    // Each user votes every 200ms

let POLL_ID = null; // Will be discovered dynamically
let totalVotesSent = 0;
let totalVotesConfirmed = 0;

console.log(`\n🚀 Starting load test: ${NUM_USERS} concurrent users\n`);

// ── STEP 1: Discover the poll ID from the server ─────────────────────────────
const discoverySocket = io(SERVER_URL, { transports: ['websocket'] });

discoverySocket.on('connect', () => {
  discoverySocket.emit('get_polls');
});

discoverySocket.on('polls_list', (polls) => {
  if (polls.length === 0) {
    console.error('❌ No polls found on the server. Is the server running?');
    process.exit(1);
  }

  POLL_ID = polls[0].id;
  console.log(`📊 Targeting poll: "${polls[0].question}" (${POLL_ID})\n`);
  discoverySocket.disconnect();

  // ── STEP 2: Spin up all simulated users ──────────────────────────────────
  startLoadTest();
});

discoverySocket.on('connect_error', () => {
  console.error('❌ Cannot connect to server. Is it running on port 3001?');
  process.exit(1);
});

function startLoadTest() {
  const sockets = [];
  const options = ['opt_0', 'opt_1', 'opt_2', 'opt_3']; // Match seeded poll options

  for (let i = 0; i < NUM_USERS; i++) {
    const userSocket = io(SERVER_URL, { transports: ['websocket'] });

    userSocket.on('connect', () => {
      // Join the poll room
      userSocket.emit('join_poll', POLL_ID);

      // Vote repeatedly at the interval
      const intervalId = setInterval(() => {
        // Pick a random option
        const optionId = options[Math.floor(Math.random() * options.length)];
        userSocket.emit('cast_vote', { pollId: POLL_ID, optionId });
        totalVotesSent++;
      }, VOTE_INTERVAL_MS);

      userSocket.on('poll_update', () => {
        totalVotesConfirmed++;
      });

      // Store cleanup references
      sockets.push({ socket: userSocket, intervalId });
    });
  }

  // ── STEP 3: Stop after duration and report ───────────────────────────────
  setTimeout(() => {
    // Stop all vote intervals
    sockets.forEach(({ socket, intervalId }) => {
      clearInterval(intervalId);
    });

    // Give a moment for the last confirmations to arrive
    setTimeout(() => {
      console.log('\n📈 LOAD TEST RESULTS');
      console.log('─────────────────────────────────');
      console.log(`👥 Concurrent users:    ${NUM_USERS}`);
      console.log(`📤 Total votes sent:    ${totalVotesSent}`);
      console.log(`📥 Updates confirmed:   ${totalVotesConfirmed}`);
      console.log(`⏱️  Duration:            ${TEST_DURATION_MS / 1000}s`);
      console.log(
        `⚡ Throughput:          ~${Math.floor(totalVotesSent / (TEST_DURATION_MS / 1000))} votes/sec`
      );
      console.log('─────────────────────────────────');
      console.log(
        '\n✅ Check your server terminal — all votes should appear in the final poll_update.'
      );
      console.log(
        '   Open http://localhost:5173 to see the final live vote counts.\n'
      );

      sockets.forEach(({ socket }) => socket.disconnect());
      process.exit(0);
    }, 2000);
  }, TEST_DURATION_MS);
}