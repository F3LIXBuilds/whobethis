import { createRoom, getRoom, deleteRoom, listPublicRooms, findRoomFor } from '../game/rooms.js';
import { getDailyBoard } from '../game/board.js';
import { GameError, PHASE } from '../game/Room.js';
import * as store from '../store.js';
import { validateUsername, validatePassword } from '../username.js';
import * as limiter from '../rateLimit.js';
import config from '../config.js';

const LOGIN_WINDOW = 15 * 60_000;

// Behind Cloudflare these headers are trustworthy; we'll tighten this when deploying.
function clientIp(socket) {
  const h = socket.handshake.headers;
  return String(h['cf-connecting-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || socket.handshake.address);
}

export function registerHandlers(io) {
  // ---------- open-room list ----------
  let lastLobbySig = '';
  const emitLobby = () => {
    const list = listPublicRooms();
    const sig = JSON.stringify(list);
    if (sig === lastLobbySig) return;
    lastLobbySig = sig;
    io.to('lobby').emit('rooms:update', list);
  };

  // Each player gets their OWN view. There is no shared broadcast of game state.
  const broadcast = (room) => {
    room.players.forEach((p, i) => {
      if (p.socketId && p.connected) io.to(p.socketId).emit('state:update', room.viewFor(i));
    });
    emitLobby();
  };

  // Ranked result. Walkovers (quit/disconnect) before the game really started don't count.
  const onEnd = (room) => {
    const r = room.result;
    const walkover = r.reason === 'forfeit' || r.reason === 'disconnect';
    if (walkover && r.questionCount < config.minQuestionsForRankedForfeit) return;
    store.recordGame(room.players[r.winner].profileId, room.players[1 - r.winner].profileId, r.reason);
  };

  // Both players vanished: nobody wins, nothing is recorded
  const onAbandon = (room) => {
    deleteRoom(room.code);
    emitLobby();
  };

  // ---------- presence + friends ----------
  const online = new Map(); // profileId -> Set of socket ids
  const inviteCooldown = new Map(); // "from:to" -> timestamp
  const isOnline = (id) => (online.get(id)?.size ?? 0) > 0;

  const friendStatus = (id) => {
    if (!isOnline(id)) return 'offline';
    const found = findRoomFor(id);
    const busy = found && ![PHASE.GAME_OVER, PHASE.WAITING_FOR_PLAYER].includes(found.room.phase);
    return busy ? 'in-game' : 'online';
  };

  const friendsView = (id) => {
    const f = store.friendsOf(id);
    return {
      friends: f.friends.map((x) => ({ username: x.username, status: friendStatus(x.id) })),
      incoming: f.incoming.map((x) => x.username),
      outgoing: f.outgoing.map((x) => x.username),
    };
  };

  const pushFriends = (id) => {
    const view = friendsView(id);
    for (const sid of online.get(id) ?? []) io.to(sid).emit('friends:update', view);
  };
  const pushToFriendsOf = (id) => store.friendsOf(id).friends.forEach((f) => pushFriends(f.id));

  const goOffline = (socket) => {
    const p = socket.data.profile;
    if (!p) return;
    const set = online.get(p.id);
    set?.delete(socket.id);
    if (set && set.size === 0) online.delete(p.id);
    socket.data.profile = null;
    pushToFriendsOf(p.id);
  };

  const goOnline = (socket, profile) => {
    goOffline(socket); // in case this socket switched accounts
    socket.data.profile = profile;
    if (!online.has(profile.id)) online.set(profile.id, new Set());
    online.get(profile.id).add(socket.id);
    socket.join('lobby');
    pushToFriendsOf(profile.id);
  };

  // ---------- connections ----------
  io.on('connection', (socket) => {
    const bind = (room, playerIndex) => {
      socket.data.roomCode = room.code;
      socket.data.playerIndex = playerIndex;
      socket.join(room.code);
    };

    const requireProfile = () => {
      if (!socket.data.profile) throw new GameError('Pick a username first');
      return socket.data.profile;
    };

    const assertNotInGame = () => {
      const existing = getRoom(socket.data.roomCode);
      if (existing && existing.phase !== PHASE.GAME_OVER) throw new GameError('You are already in a game');
    };

    // Resolves who this socket is, from the server's records only
    const ctx = () => {
      const room = getRoom(socket.data.roomCode);
      const i = socket.data.playerIndex;
      if (!room || i == null) throw new GameError('You are not in a game');
      if (room.players[i].socketId !== socket.id) throw new GameError('Session replaced');
      return { room, i };
    };

    // If this account has a seat that is currently disconnected, take it back.
    const resumeGame = (profileId) => {
      const found = findRoomFor(profileId);
      if (!found) return;
      const { room, index } = found;
      if (room.players[index].connected) return;
      room.reconnect(room.players[index].token, socket.id);
      bind(room, index);
    };

    const on = (event, fn) =>
      socket.on(event, async (payload, ack) => {
        if (typeof payload === 'function') { ack = payload; payload = {}; }
        try {
          const data = (await fn(payload ?? {})) ?? {};
          ack?.({ ok: true, ...data });
        } catch (err) {
          if (err instanceof GameError) ack?.({ ok: false, error: err.message });
          else { console.error(err); ack?.({ ok: false, error: 'Server error' }); }
        }
      });

    // ---- profile ----
    // Test bots only (real sign-ups go through auth:register)
    on('profile:register', ({ username, test }) => {
      if (test !== true) throw new GameError('Please sign up with a username and password');
      if (!config.allowTestAccounts) {
        throw new GameError('Test accounts are disabled. Start the server with ALLOW_TEST_ACCOUNTS=1');
      }
      const v = validateUsername(username);
      if (v.error) throw new GameError(v.error);
      const res = store.register(v.name, { test: true });
      if (!res) throw new GameError('That username is taken');
      goOnline(socket, { id: res.id, username: v.name });
      return { playerId: res.id, key: res.key, profile: res.profile, rooms: listPublicRooms() };
    });

    on('profile:login', ({ playerId, key }) => {
      const res = store.login(playerId, key);
      if (!res) throw new GameError('Session expired. Please pick a username again');
      goOnline(socket, { id: res.id, username: res.username });
      resumeGame(res.id);
      return { profile: res.profile, rooms: listPublicRooms() };
    });

    on('profile:me', () => {
      const p = requireProfile();
      return { profile: store.getProfile(p.id) };
    });

    // ---- accounts: username + password ----
    on('auth:register', async ({ username, password, test }) => {
      const isTest = test === true;
      if (isTest && !config.allowTestAccounts) {
        throw new GameError('Test accounts are disabled. Start the server with ALLOW_TEST_ACCOUNTS=1');
      }
      const v = validateUsername(username);
      if (v.error) throw new GameError(v.error);
      const pw = validatePassword(password, v.name);
      if (pw.error) throw new GameError(pw.error);
      if (!isTest && !limiter.allow(`signup:${clientIp(socket)}`, 10, 60 * 60_000)) {
        throw new GameError('Too many sign-ups from this network. Try again later');
      }
      const res = await store.createAccount(v.name, password, { test: isTest });
      if (!res) throw new GameError('That username is taken');
      goOnline(socket, { id: res.id, username: v.name });
      return { playerId: res.id, key: res.key, profile: res.profile, rooms: listPublicRooms() };
    });

    on('auth:login', async ({ username, password }) => {
      const ipKey = `login-ip:${clientIp(socket)}`;
      const userKey = `login-user:${String(username ?? '').trim().toLowerCase()}`;
      if (limiter.isBlocked(ipKey, 20) || limiter.isBlocked(userKey, 5)) {
        throw new GameError('Too many attempts. Try again in a few minutes');
      }
      const res = await store.passwordLogin(username, password);
      if (!res) {
        limiter.recordFailure(ipKey, LOGIN_WINDOW);
        limiter.recordFailure(userKey, LOGIN_WINDOW);
        throw new GameError('Wrong username or password');
      }
      limiter.clearFailures(userKey);
      goOnline(socket, { id: res.id, username: res.username });
      resumeGame(res.id);
      return { playerId: res.id, key: res.key, profile: res.profile, rooms: listPublicRooms() };
    });

    on('auth:logout', ({ playerId, key }) => {
      store.revokeSession(playerId, key);
      goOffline(socket);
    });

    // For accounts created before passwords existed
    on('auth:setPassword', async ({ password }) => {
      const p = requireProfile();
      const pw = validatePassword(password, p.username);
      if (pw.error) throw new GameError(pw.error);
      const r = await store.setPassword(p.id, password);
      if (r.error) throw new GameError(r.error);
      return { profile: store.getProfile(p.id) };
    });

    on('rooms:list', () => ({ rooms: listPublicRooms() }));
    on('app:ping', () => ({})); // lets clients measure latency and detect dead connections

    // ---- friends ----
    on('friends:list', () => friendsView(requireProfile().id));

    on('friends:request', ({ username }) => {
      const p = requireProfile();
      const r = store.requestFriend(p.id, username);
      if (r.error) throw new GameError(r.error);
      pushFriends(p.id);
      pushFriends(r.otherId);
      return { status: r.status };
    });

    on('friends:respond', ({ username, accept }) => {
      const p = requireProfile();
      const r = store.respondFriend(p.id, username, accept === true);
      if (r.error) throw new GameError(r.error);
      pushFriends(p.id);
      pushFriends(r.otherId);
      return { status: r.status };
    });

    on('friends:remove', ({ username }) => {
      const p = requireProfile();
      const r = store.removeFriend(p.id, username);
      if (r.error) throw new GameError(r.error);
      pushFriends(p.id);
      pushFriends(r.otherId);
    });

    // Invite a friend to the room you're hosting
    on('invite:send', ({ username }) => {
      const p = requireProfile();
      const room = getRoom(socket.data.roomCode);
      if (!room || room.phase !== PHASE.WAITING_FOR_PLAYER) throw new GameError('Create a room first');
      const wanted = String(username ?? '').toLowerCase();
      const friend = store.friendsOf(p.id).friends.find((f) => f.username.toLowerCase() === wanted);
      if (!friend) throw new GameError('You can only invite friends');
      if (!isOnline(friend.id)) throw new GameError(`${friend.username} is offline`);
      const key = `${p.id}:${friend.id}`;
      if (Date.now() - (inviteCooldown.get(key) ?? 0) < 10_000) {
        throw new GameError('Invite already sent. Give them a moment');
      }
      inviteCooldown.set(key, Date.now());
      for (const sid of online.get(friend.id)) {
        io.to(sid).emit('invite:received', { from: p.username, code: room.code });
      }
    });

    // ---- rooms ----
    on('room:create', ({ isPublic }) => {
      const profile = requireProfile();
      assertNotInGame();
      const room = createRoom({
        onChange: broadcast,
        onEnd,
        onAbandon,
        isPublic: isPublic !== false,
        board: getDailyBoard(),
      });
      const { playerIndex, token } = room.addPlayer(socket.id, profile);
      bind(room, playerIndex);
      return { code: room.code, token, playerIndex };
    });

    on('room:join', ({ code }) => {
      const profile = requireProfile();
      assertNotInGame();
      const c = String(code ?? '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(c)) throw new GameError('Invalid room code');
      const room = getRoom(c);
      if (!room) throw new GameError('Room not found');
      const { playerIndex, token } = room.addPlayer(socket.id, profile);
      bind(room, playerIndex);
      return { code: room.code, token, playerIndex };
    });

    on('room:rejoin', ({ code, token }) => {
      const room = getRoom(String(code ?? '').toUpperCase());
      if (!room) throw new GameError('Room not found');
      const playerIndex = room.reconnect(token, socket.id);
      bind(room, playerIndex);
      return { code: room.code, playerIndex };
    });

    on('leave', () => {
      const room = getRoom(socket.data.roomCode);
      const i = socket.data.playerIndex;
      if (!room || i == null || room.players[i].socketId !== socket.id) return;
      room.leave(i);
      socket.leave(room.code);
      socket.data.roomCode = null;
      socket.data.playerIndex = null;
      if (room.phase === PHASE.WAITING_FOR_PLAYER || room.players.every((p) => p.left)) {
        deleteRoom(room.code);
        emitLobby();
      }
    });

    // ---- gameplay ----
    on('select:celebrity', ({ id }) => { const { room, i } = ctx(); room.selectCelebrity(i, id); });
    on('question:ask', ({ text }) => { const { room, i } = ctx(); room.ask(i, text); });
    on('question:answer', ({ answer }) => { const { room, i } = ctx(); room.answer(i, answer); });
    on('board:toggle', ({ id }) => {
      const { room, i } = ctx();
      return { eliminated: room.toggleCard(i, id) };
    });
    on('turn:end', () => { const { room, i } = ctx(); room.endTurn(i); });

    // ---- snipe ----
    on('snipe:start', () => { const { room, i } = ctx(); room.snipeStart(i); });
    on('snipe:cancel', () => { const { room, i } = ctx(); room.snipeCancel(i); });
    on('snipe:guess', ({ id }) => { const { room, i } = ctx(); room.snipeGuess(i, id); });

    socket.on('disconnect', () => {
      goOffline(socket);
      const room = getRoom(socket.data.roomCode);
      if (!room) return;
      room.disconnect(socket.id); // starts the reconnect grace period if a game is running

      // A host who vanished from a waiting room shouldn't stay in the open-room list
      if (room.phase === PHASE.WAITING_FOR_PLAYER) {
        setTimeout(() => {
          const host = room.players[0];
          if (getRoom(room.code) === room && room.phase === PHASE.WAITING_FOR_PLAYER && host && !host.connected) {
            deleteRoom(room.code);
            emitLobby();
          }
        }, config.waitingRoomGraceSeconds * 1000);
      }
    });
  });
}