import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default {
  port: Number(process.env.PORT) || 3001,
  selectionSeconds: Number(process.env.SELECTION_SECONDS) || 30,

  // Each player gets this many snipes. A miss costs your turn; missing the last one loses the game.
  snipesPerPlayer: 2,

  // Daily board
  boardSize: Number(process.env.BOARD_SIZE) || 40,
  boardTimezone: 'Africa/Lagos',

  // Friends
  maxFriends: 100,
  maxPendingRequests: 20,

  // Reserved for a future timed mode (null = no turn timer)
  turnTimeLimitSeconds: null,

  reconnectGraceSeconds: Number(process.env.RECONNECT_GRACE_SECONDS) || 45,
  allowTestAccounts: process.env.ALLOW_TEST_ACCOUNTS === '1',
  maxQuestionLength: 200,

  // Persistence (swap store.js for PostgreSQL later)
  dataFile: process.env.DATA_FILE || path.join(here, 'data', 'db.json'),

  username: { min: 3, max: 16 },
  password: { min: 8, max: 128 },
  leaderboardSize: 50,
  minQuestionsForRankedForfeit: 2,
  waitingRoomGraceSeconds: 15,
  finishedRoomTtlMinutes: 10,
};