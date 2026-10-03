import { io } from 'socket.io-client';

const URL = process.env.SERVER_URL || 'http://localhost:3001';
let failures = 0;
const created = []; // usernames of every bot, to prove none reach the leaderboard

const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
};

function makeClient(name) {
  const username = `${name}_${Math.random().toString(36).slice(2, 8)}`;
  created.push(username);
  const socket = io(URL, { transports: ['websocket'] });
  const c = { name, username, socket, state: null, waiters: [], creds: null };
  socket.on('state:update', (s) => {
    c.state = s;
    c.waiters = c.waiters.filter((w) => !w(s));
  });
  c.ready = new Promise((resolve, reject) =>
    socket.once('connect', () => {
      socket.emit('profile:register', { username, test: true }, (r) => {
        if (!r.ok) return reject(new Error(r.error));
        c.creds = { playerId: r.playerId, key: r.key };
        resolve();
      });
    })
  );
  return c;
}

const send = (c, event, payload = {}) =>
  new Promise((resolve) => c.socket.emit(event, payload, resolve));

const waitFor = (c, pred, ms = 5000) =>
  new Promise((resolve, reject) => {
    if (c.state && pred(c.state)) return resolve(c.state);
    const t = setTimeout(() => reject(new Error(`${c.name} timed out`)), ms);
    c.waiters.push((s) => {
      if (pred(s)) { clearTimeout(t); resolve(s); return true; }
      return false;
    });
  });

const both = (x, y, pred, ms) => Promise.all([waitFor(x, pred, ms), waitFor(y, pred, ms)]);

// The board list contains every id, so ignore it when checking for leaked secrets
const leaks = (state, secret) => {
  const { board, ...rest } = state;
  return JSON.stringify(rest).includes(`"${secret}"`);
};

async function startGame() {
  const p1 = makeClient('P1');
  const p2 = makeClient('P2');
  await Promise.all([p1.ready, p2.ready]);

  const created1 = await send(p1, 'room:create');
  const joined = await send(p2, 'room:join', { code: created1.code });
  if (!created1.ok || !joined.ok) throw new Error('Could not create/join room');

  await both(p1, p2, (s) => s.phase === 'SELECTING_CELEBRITY');
  const b = p1.state.board; // today's board, whatever it is
  const ids = { a: b[0], b: b[1], c: b[2], d: b[3], e: b[4] };

  await send(p1, 'select:celebrity', { id: ids.a });
  await send(p2, 'select:celebrity', { id: ids.b });
  await both(p1, p2, (s) => s.phase === 'ASKING');
  return { p1, p2, code: created1.code, tokens: [created1.token, joined.token], ids };
}

async function exchange(asker, answerer, text = 'Is your celebrity a musician?') {
  await send(asker, 'question:ask', { text });
  await waitFor(answerer, (s) => s.phase === 'WAITING_FOR_ANSWER');
  await send(answerer, 'question:answer', { answer: 'YES' });
  await waitFor(asker, (s) => s.phase === 'ELIMINATING');
}

async function misc() {
  console.log('\n--- Misc validation ---');
  const p = makeClient('P');
  await p.ready;
  let r = await send(p, 'room:join', { code: 'ZZZZZZ' });
  check('Joining a missing room fails', !r.ok);
  r = await send(p, 'room:join', { code: 'x' });
  check('Malformed room code fails', !r.ok);
  p.socket.close();
}

async function lobbyTest() {
  console.log('\n--- Usernames & open rooms ---');
  const raw = io(URL, { transports: ['websocket'] });
  await new Promise((r) => raw.on('connect', r));
  const reg = (username) =>
    new Promise((res) =>
      raw.emit('auth:register', { username, password: 'long-enough-pw1', test: true }, res)
    );
  check('Too-short username rejected', !(await reg('x')).ok);
  check('Bad characters rejected', !(await reg('bad name!')).ok);
  check('Reserved username rejected', !(await reg('admin')).ok);
  const early = await new Promise((res) => raw.emit('room:create', {}, res));
  check('Cannot create a room without a username', !early.ok);
  raw.close();

  const a = makeClient('A');
  const b = makeClient('B');
  const c = makeClient('C');
  await Promise.all([a.ready, b.ready, c.ready]);

  const pub = await send(a, 'room:create', { isPublic: true });
  let list = await send(b, 'rooms:list');
  check('Public room appears in the list', list.rooms.some((r) => r.code === pub.code));

  const self = await send(a, 'room:join', { code: pub.code });
  check('Cannot join while already in a game', !self.ok);

  await send(b, 'room:join', { code: pub.code });
  list = await send(c, 'rooms:list');
  check('Full room leaves the list', !list.rooms.some((r) => r.code === pub.code));

  const priv = await send(c, 'room:create', { isPublic: false });
  list = await send(b, 'rooms:list');
  check('Private room is NOT listed', !list.rooms.some((r) => r.code === priv.code));

  [a, b, c].forEach((x) => x.socket.close());
}

async function friendsTest() {
  console.log('\n--- Friends & invites ---');
  const a = makeClient('FA');
  const b = makeClient('FB');
  await Promise.all([a.ready, b.ready]);

  let r = await send(a, 'friends:request', { username: a.username });
  check("Can't add yourself", !r.ok);
  r = await send(a, 'friends:request', { username: 'NoSuchPlayer999' });
  check('Unknown username rejected', !r.ok);

  r = await send(a, 'friends:request', { username: b.username });
  check('Friend request sent', r.ok && r.status === 'sent');
  r = await send(a, 'friends:request', { username: b.username });
  check('Duplicate request rejected', !r.ok);

  let list = await send(b, 'friends:list');
  check('Recipient sees the request', list.incoming.includes(a.username));
  r = await send(b, 'friends:respond', { username: a.username, accept: true });
  check('Request accepted', r.ok);
  list = await send(a, 'friends:list');
  check('Both are friends, and shown online', list.friends.some((f) => f.username === b.username && f.status === 'online'));

  r = await send(a, 'invite:send', { username: b.username });
  check('Cannot invite without a room', !r.ok);

  const invited = new Promise((res) => b.socket.once('invite:received', res));
  const room = await send(a, 'room:create', { isPublic: false });
  r = await send(a, 'invite:send', { username: b.username });
  const inv = await invited;
  check('Friend receives the invite with the room code', r.ok && inv.code === room.code && inv.from === a.username);

  r = await send(b, 'friends:remove', { username: a.username });
  list = await send(a, 'friends:list');
  check('Removing a friend works both ways', r.ok && list.friends.length === 0);

  a.socket.close();
  b.socket.close();
}

async function gameOne() {
  console.log('\n--- Game 1: full loop, correct snipe ---');
  const { p1, p2, ids } = await startGame();

  const pool = await (await fetch(`${URL}/api/celebrities`)).json();
  const catOf = Object.fromEntries(pool.map((c) => [c.id, c.category]));
  const firstRow = new Set(p1.state.board.slice(0, 8).map((id) => catOf[id]));

  check('Both players get the same board', JSON.stringify(p1.state.board) === JSON.stringify(p2.state.board));
  check('Categories are mixed across the first cards', firstRow.size >= 3);
  check('P1 goes first', p1.state.activePlayer === 0);
  check('P1 sees own secret', p1.state.mySecret === ids.a);
  check("P1 view does NOT contain P2's secret", !leaks(p1.state, ids.b));
  check("P2 view does NOT contain P1's secret", !leaks(p2.state, ids.a));
  check('Everyone starts with 2 snipes', p1.state.players.every((p) => p.snipesLeft === 2));

  let r = await send(p2, 'question:ask', { text: 'Am I allowed?' });
  check('P2 cannot ask on P1 turn', !r.ok);
  r = await send(p1, 'question:answer', { answer: 'YES' });
  check('Cannot answer before a question exists', !r.ok);

  await send(p1, 'question:ask', { text: 'Is your celebrity a musician?' });
  await waitFor(p2, (s) => s.phase === 'WAITING_FOR_ANSWER');
  check('P2 sees the question', p2.state.question?.text === 'Is your celebrity a musician?');
  r = await send(p1, 'question:answer', { answer: 'YES' });
  check('Asker cannot answer own question', !r.ok);
  await send(p2, 'question:answer', { answer: 'NO' });
  await waitFor(p1, (s) => s.phase === 'ELIMINATING');
  check('P1 receives the answer', p1.state.question.answer === 'NO');

  r = await send(p1, 'board:toggle', { id: ids.c });
  check('P1 eliminates a card', r.ok && r.eliminated === true);
  r = await send(p1, 'board:toggle', { id: ids.c });
  check('P1 can bring the card back up', r.ok && r.eliminated === false);
  await send(p1, 'board:toggle', { id: ids.d });
  check("P2's board is untouched by P1's eliminations", p2.state.myEliminated.length === 0);

  r = await send(p1, 'board:toggle', { id: 'not-a-real-id' });
  check('Unknown celebrity id rejected', !r.ok);
  const offBoard = pool.find((c) => !p1.state.board.includes(c.id));
  if (offBoard) {
    r = await send(p1, 'board:toggle', { id: offBoard.id });
    check("A celebrity that isn't on today's board is rejected", !r.ok);
  }

  await send(p1, 'turn:end');
  await both(p1, p2, (s) => s.phase === 'ASKING' && s.activePlayer === 1);
  r = await send(p1, 'question:ask', { text: 'Out of turn?' });
  check('P1 cannot ask on P2 turn', !r.ok);
  r = await send(p1, 'snipe:start');
  check('P1 cannot snipe on P2 turn', !r.ok);

  await exchange(p2, p1, 'Is your celebrity male?');
  await send(p2, 'snipe:start');
  await waitFor(p2, (s) => s.phase === 'SNIPE_CONFIRMATION');
  await send(p2, 'snipe:cancel');
  await waitFor(p2, (s) => s.phase === 'ELIMINATING');
  check('Snipe cancel returns to previous phase', p2.state.phase === 'ELIMINATING');
  check("Still no leak of P1's secret before game over", !leaks(p2.state, ids.a));

  await send(p2, 'snipe:start');
  await send(p2, 'snipe:guess', { id: ids.a });
  await both(p1, p2, (s) => s.phase === 'GAME_OVER');
  check('Correct snipe: P2 wins', p2.state.result.winner === 1 && p2.state.result.reason === 'snipe_hit');
  check(
    'Secrets revealed to both at game over',
    p1.state.result.secrets[0] === ids.a && p1.state.result.secrets[1] === ids.b
  );
  check('Question count recorded', p2.state.result.questionCount === 2);

  p1.socket.close();
  p2.socket.close();
}

async function gameTwo() {
  console.log('\n--- Game 2: two snipes, both miss = loss ---');
  const { p1, p2, ids } = await startGame();

  await exchange(p1, p2);
  await send(p1, 'snipe:start');
  let r = await send(p1, 'snipe:guess', { id: ids.c });
  check('First miss is accepted', r.ok);
  await both(p1, p2, (s) => s.phase === 'ASKING' && s.activePlayer === 1);
  check('First miss costs the turn, not the game', p1.state.phase === 'ASKING' && p1.state.activePlayer === 1);
  check('P1 has 1 snipe left (visible to both)', p1.state.players[0].snipesLeft === 1 && p2.state.players[0].snipesLeft === 1);
  check('The missed guess is public', p2.state.lastSnipe?.guessedId === ids.c);
  r = await send(p1, 'snipe:start');
  check('Cannot snipe on the opponent’s turn', !r.ok);

  await exchange(p2, p1);
  await send(p2, 'turn:end');
  await both(p1, p2, (s) => s.phase === 'ASKING' && s.activePlayer === 0);
  await exchange(p1, p2);

  await send(p1, 'snipe:start');
  r = await send(p1, 'snipe:guess', { id: ids.c });
  check('Cannot repeat a guess that already missed', !r.ok);
  await send(p1, 'snipe:guess', { id: ids.d });
  await both(p1, p2, (s) => s.phase === 'GAME_OVER');
  check(
    'Missing the last snipe loses the game',
    p1.state.result.winner === 1 && p1.state.result.reason === 'snipe_miss'
  );

  p1.socket.close();
  p2.socket.close();
}

async function quitTest() {
  console.log('\n--- Game 3: quitting hands the win to the opponent ---');
  const { p1, p2 } = await startGame();
  await exchange(p1, p2);
  await send(p1, 'turn:end');
  await both(p1, p2, (s) => s.phase === 'ASKING' && s.activePlayer === 1);
  await exchange(p2, p1);
  await send(p1, 'leave'); // P1 rage-quits
  await waitFor(p2, (s) => s.phase === 'GAME_OVER');
  check('Opponent wins when you quit', p2.state.result.winner === 1 && p2.state.result.reason === 'forfeit');
  p1.socket.close();
  p2.socket.close();
}

async function disconnectTest() {
  console.log('\n--- Game 4: disconnect, reconnect, resume ---');
  const { p1, p2, code, tokens, ids } = await startGame();
  await exchange(p1, p2);
  await send(p1, 'board:toggle', { id: ids.c });

  p1.socket.disconnect();
  await waitFor(p2, (s) => s.players[0].connected === false);
  check('Opponent sees the disconnect', p2.state.players[0].connected === false);
  check('Reconnect deadline is sent', typeof p2.state.players[0].reconnectDeadline === 'number');
  check("P2 view still hides P1's secret", !leaks(p2.state, ids.a));

  const back = new Promise((r) => p1.socket.once('connect', r));
  p1.socket.connect();
  await back;
  const t0 = Date.now();
  const rejoin = await send(p1, 'room:rejoin', { code, token: tokens[0] });
  check('Rejoin with token succeeds', rejoin.ok);
  await waitFor(p1, (s) => s.serverTime >= t0 && s.players[0].connected);
  check('Own board restored', p1.state.myEliminated.includes(ids.c));
  check('Own secret restored', p1.state.mySecret === ids.a);
  await waitFor(p2, (s) => s.players[0].connected === true);
  check('Opponent sees the reconnect', p2.state.players[0].connected === true);

  // P2 closes the browser entirely (token lost) and later logs in again
  p2.socket.close();
  await waitFor(p1, (s) => s.players[1].connected === false);
  const s2 = io(URL, { transports: ['websocket'] });
  const resumed = new Promise((res) => s2.on('state:update', res));
  await new Promise((r) => s2.on('connect', r));
  const login = await new Promise((res) => s2.emit('profile:login', p2.creds, res));
  const view = await resumed;
  check('Login resumes a disconnected game', login.ok && view.you === 1 && view.mySecret === ids.b);

  s2.close();
  p1.socket.close();
}

// Needs the server started with RECONNECT_GRACE_SECONDS=3
async function graceTest() {
  console.log('\n--- Game 5: opponent never returns ---');
  const { p1, p2 } = await startGame();
  await exchange(p1, p2);
  p2.socket.close();
  await waitFor(p1, (s) => s.phase === 'GAME_OVER', 15000);
  check(
    'Opponent wins after the grace period',
    p1.state.result.winner === 0 && p1.state.result.reason === 'disconnect'
  );
  p1.socket.close();
}

async function autopickTest() {
  console.log('\n--- Selection timeout auto-picks (waits ~30s) ---');
  const p1 = makeClient('P1');
  const p2 = makeClient('P2');
  await Promise.all([p1.ready, p2.ready]);
  const c = await send(p1, 'room:create');
  await send(p2, 'room:join', { code: c.code });
  await waitFor(p1, (s) => s.phase === 'ASKING', 40000);
  check(
    'Both players were auto-assigned a celebrity from the board',
    p1.state.board.includes(p1.state.mySecret) && p2.state.board.includes(p2.state.mySecret)
  );
  p1.socket.close();
  p2.socket.close();
}

async function leaderboardTest() {
  console.log('\n--- Leaderboard ---');
  const rows = await (await fetch(`${URL}/api/leaderboard`)).json();
  check('Test accounts never appear on the leaderboard', !rows.some((r) => created.includes(r.username)));
}

async function accountTest() {
  console.log('\n--- Accounts: username + password ---');
  const open = async () => {
    const s = io(URL, { transports: ['websocket'] });
    await new Promise((r) => s.on('connect', r));
    return { s, call: (event, payload) => new Promise((res) => s.emit(event, payload, res)) };
  };
  const a = await open();
  const b = await open();
  const name = `AC_${Math.random().toString(36).slice(2, 8)}`;
  created.push(name);

  let r = await a.call('auth:register', { username: name, password: 'short', test: true });
  check('Short password rejected', !r.ok);
  r = await a.call('auth:register', { username: name, password: 'correct-horse-9', test: true });
  check('Sign-up with a good password works', r.ok && !!r.key && !!r.playerId);
  const first = r;

  r = await b.call('auth:login', { username: name, password: 'wrong-password' });
  check('Wrong password rejected', !r.ok);
  r = await b.call('auth:login', { username: 'NoSuchUser999', password: 'whatever123' });
  check('Unknown username gets the same generic error', !r.ok && r.error === 'Wrong username or password');
  r = await b.call('auth:login', { username: name.toLowerCase(), password: 'correct-horse-9' });
  check('Login works (username is case-insensitive)', r.ok && !!r.key && r.key !== first.key);
  const second = r;

  let t = await b.call('profile:login', { playerId: second.playerId, key: second.key });
  check('Second device key works', t.ok);
  t = await b.call('profile:login', { playerId: first.playerId, key: first.key });
  check('First device key still works', t.ok);

  await b.call('auth:logout', { playerId: second.playerId, key: second.key });
  t = await b.call('profile:login', { playerId: second.playerId, key: second.key });
  check('Logging out revokes only that device', !t.ok);
  t = await b.call('profile:login', { playerId: first.playerId, key: first.key });
  check('The other device stays logged in', t.ok);

  a.s.close();
  b.s.close();
}

try {
  await misc();
  await lobbyTest();
  await accountTest();
  await friendsTest();
  await gameOne();
  await gameTwo();
  await quitTest();
  await disconnectTest();
  if (process.argv.includes('--grace')) await graceTest();
  if (process.argv.includes('--autopick')) await autopickTest();
  await leaderboardTest();
} catch (err) {
  console.error('Test crashed:', err.message);
  failures++;
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);