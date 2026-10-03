import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../socket.js';

const ACCOUNT_KEY = 'wbt-account'; // persistent: who you are on this device
const SESSION_KEY = 'wbt-session'; // per tab: which game you're in
const CELEBS_KEY = 'wbt-celebs'; // cached celebrity list so a reload doesn't wait for it
const EMPTY_FRIENDS = { friends: [], incoming: [], outgoing: [] };

const read = (kind, key) => {
  try { return JSON.parse(window[kind].getItem(key)); } catch { return null; }
};
const write = (kind, key, value) => {
  try {
    if (value) window[kind].setItem(key, JSON.stringify(value));
    else window[kind].removeItem(key);
  } catch { /* storage unavailable */ }
};

export function useGame() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [celebs, setCelebs] = useState(() => read('localStorage', CELEBS_KEY) ?? []);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [friends, setFriends] = useState(EMPTY_FRIENDS);
  const [invite, setInvite] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // True while we're putting you back into a game after a reload
  const [resuming, setResuming] = useState(() => !!read('sessionStorage', SESSION_KEY));
  const account = useRef(read('localStorage', ACCOUNT_KEY));
  const session = useRef(read('sessionStorage', SESSION_KEY));

  useEffect(() => {
    fetch('/api/celebrities')
      .then((r) => r.json())
      .then((list) => {
        setCelebs(list);
        write('localStorage', CELEBS_KEY, list);
      })
      .catch(() => setError('Could not load the celebrity list'));
  }, []);

  useEffect(() => {
    const loadFriends = () =>
      socket.emit('friends:list', {}, (r) => {
        if (r?.ok) setFriends({ friends: r.friends, incoming: r.incoming, outgoing: r.outgoing });
      });

    const rejoin = () => {
      if (!session.current) {
        setResuming(false);
        return;
      }
      socket.emit('room:rejoin', session.current, (res) => {
        if (!res?.ok) {
          session.current = null;
          write('sessionStorage', SESSION_KEY, null);
          setState(null);
        }
        setResuming(false);
      });
    };

    const onConnect = () => {
      setConnected(true);
      if (account.current) {
        socket.emit('profile:login', account.current, (res) => {
          if (res?.ok) {
            setProfile(res.profile);
            setRooms(res.rooms);
            loadFriends();
          } else {
            account.current = null;
            write('localStorage', ACCOUNT_KEY, null);
            setProfile(null);
          }
          setAuthReady(true);
          rejoin();
        });
      } else {
        setAuthReady(true);
        rejoin();
      }
    };

    const onDisconnect = () => setConnected(false);
    const onState = (s) => setState(s);
    const onRooms = (list) => setRooms(list);
    const onFriends = (f) => setFriends(f);
    const onInvite = (inv) => setInvite(inv);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state:update', onState);
    socket.on('rooms:update', onRooms);
    socket.on('friends:update', onFriends);
    socket.on('invite:received', onInvite);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state:update', onState);
      socket.off('rooms:update', onRooms);
      socket.off('friends:update', onFriends);
      socket.off('invite:received', onInvite);
    };
  }, []);

  // Never leave the player stuck on the "getting you back" screen
  useEffect(() => {
    if (!resuming) return undefined;
    const t = setTimeout(() => setResuming(false), 8000);
    return () => clearTimeout(t);
  }, [resuming]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!invite) return undefined;
    const t = setTimeout(() => setInvite(null), 60_000);
    return () => clearTimeout(t);
  }, [invite]);

  const emit = useCallback(
    (event, payload = {}) =>
      new Promise((resolve) => {
        socket.emit(event, payload, (res) => {
          if (!res?.ok) setError(res?.error || 'Something went wrong');
          resolve(res ?? { ok: false });
        });
      }),
    []
  );

  // ---------- account ----------
  const startSession = useCallback(
    async (r) => {
      account.current = { playerId: r.playerId, key: r.key };
      write('localStorage', ACCOUNT_KEY, account.current);
      setProfile(r.profile);
      setRooms(r.rooms);
      const f = await emit('friends:list');
      setFriends(f.ok ? { friends: f.friends, incoming: f.incoming, outgoing: f.outgoing } : EMPTY_FRIENDS);
    },
    [emit]
  );

  const signUp = useCallback(
    async (username, password) => {
      const r = await emit('auth:register', { username, password });
      if (r.ok) await startSession(r);
      return r;
    },
    [emit, startSession]
  );

  const logIn = useCallback(
    async (username, password) => {
      const r = await emit('auth:login', { username, password });
      if (r.ok) await startSession(r);
      return r;
    },
    [emit, startSession]
  );

  const logOut = useCallback(async () => {
    const creds = account.current;
    account.current = null;
    write('localStorage', ACCOUNT_KEY, null);
    setProfile(null);
    setFriends(EMPTY_FRIENDS);
    setInvite(null);
    if (creds) await emit('auth:logout', creds);
  }, [emit]);

  const setPassword = useCallback(
    async (password) => {
      const r = await emit('auth:setPassword', { password });
      if (r.ok) {
        setProfile(r.profile);
        setNotice('Password saved. You can now log in from any device');
      }
      return r;
    },
    [emit]
  );

  const refreshProfile = useCallback(async () => {
    const r = await emit('profile:me');
    if (r.ok) setProfile(r.profile);
  }, [emit]);

  // ---------- rooms ----------
  const enterRoom = useCallback((r) => {
    if (r.ok) {
      session.current = { code: r.code, token: r.token };
      write('sessionStorage', SESSION_KEY, session.current);
    }
  }, []);

  const createRoom = useCallback(async (isPublic) => enterRoom(await emit('room:create', { isPublic })), [emit, enterRoom]);
  const joinRoom = useCallback(async (code) => enterRoom(await emit('room:join', { code })), [emit, enterRoom]);

  const leave = useCallback(async () => {
    await emit('leave');
    session.current = null;
    write('sessionStorage', SESSION_KEY, null);
    setState(null);
    refreshProfile(); // pick up the result of the game you just finished
  }, [emit, refreshProfile]);

  // ---------- friends ----------
  const requestFriend = useCallback(
    async (username) => {
      const r = await emit('friends:request', { username });
      if (r.ok) {
        setNotice(r.status === 'accepted' ? `You and ${username} are now friends` : `Friend request sent to ${username}`);
      }
      return r;
    },
    [emit]
  );

  const inviteToRoom = useCallback(
    async (username) => {
      const r = await emit('invite:send', { username });
      if (r.ok) setNotice(`Invite sent to ${username}`);
    },
    [emit]
  );

  // From the friends list: open a private room, then invite
  const playWithFriend = useCallback(
    async (username) => {
      const r = await emit('room:create', { isPublic: false });
      if (!r.ok) return;
      enterRoom(r);
      inviteToRoom(username);
    },
    [emit, enterRoom, inviteToRoom]
  );

  const acceptInvite = useCallback(async () => {
    const code = invite?.code;
    setInvite(null);
    if (code) await joinRoom(code);
  }, [invite, joinRoom]);

  const dismissInvite = useCallback(() => setInvite(null), []);

  return {
    state, celebs, connected, error, notice, profile, rooms, friends, invite, authReady, resuming,
    emit, signUp, logIn, logOut, setPassword, createRoom, joinRoom, leave,
    requestFriend, inviteToRoom, playWithFriend, acceptInvite, dismissInvite,
  };
}