import { randomUUID } from 'node:crypto';
import config from '../config.js';

export const PHASE = Object.freeze({
  WAITING_FOR_PLAYER: 'WAITING_FOR_PLAYER',
  SELECTING_CELEBRITY: 'SELECTING_CELEBRITY',
  ASKING: 'ASKING',
  WAITING_FOR_ANSWER: 'WAITING_FOR_ANSWER',
  ELIMINATING: 'ELIMINATING',
  SNIPE_CONFIRMATION: 'SNIPE_CONFIRMATION',
  GAME_OVER: 'GAME_OVER',
});

export class GameError extends Error {}

const other = (i) => 1 - i;

export class Room {
  constructor(code, { onChange = () => {}, onEnd = () => {}, onAbandon = () => {}, isPublic = true, board } = {}) {
    this.code = code;
    this.onChange = onChange;
    this.onEnd = onEnd;
    this.onAbandon = onAbandon;
    this.isPublic = isPublic;
    this.board = board?.ids ?? []; // the board is locked in when the room is created
    this.boardDate = board?.date ?? null;
    this.boardSet = new Set(this.board);
    this.createdAt = Date.now();
    this.finishedAt = null;
    this.phase = PHASE.WAITING_FOR_PLAYER;
    this.players = [];
    this.activePlayer = 0;
    this.question = null; // { text, askedBy, answer }
    this.history = []; // public Q&A log
    this.questionCount = 0;
    this.selectionDeadline = null;
    this.selectionTimer = null;
    this.snipeReturnPhase = null;
    this.lastSnipe = null; // { by, guessedId, snipesLeft } after a miss that didn't end the game
    this.result = null;
    this.startedAt = null;
  }

  // ---------- helpers ----------
  _notify() { this.onChange(this); }

  _need(cond, msg) { if (!cond) throw new GameError(msg); }

  _needPhase(...phases) {
    this._need(phases.includes(this.phase), `Not allowed right now (${this.phase})`);
  }

  _needActive(i) { this._need(i === this.activePlayer, "It's not your turn"); }

  _needCelebrity(id) {
    this._need(typeof id === 'string' && this.boardSet.has(id), 'Unknown celebrity');
  }

  _inProgress() {
    return (
      this.players.length === 2 &&
      this.phase !== PHASE.WAITING_FOR_PLAYER &&
      this.phase !== PHASE.GAME_OVER
    );
  }

  _clearGrace(p) {
    clearTimeout(p.graceTimer);
    p.graceTimer = null;
    p.graceDeadline = null;
  }

  dispose() {
    clearTimeout(this.selectionTimer);
    this.players.forEach((p) => this._clearGrace(p));
  }

  // ---------- players ----------
  addPlayer(socketId, profile) {
    this._need(this.phase === PHASE.WAITING_FOR_PLAYER && this.players.length < 2, 'Room is full');
    this._need(!this.players.some((p) => p.profileId === profile.id), "You can't play against yourself");
    const token = randomUUID();
    const playerIndex = this.players.length;
    this.players.push({
      profileId: profile.id,
      token,
      socketId,
      name: profile.username,
      connected: true,
      left: false,
      secret: null,
      eliminated: new Set(),
      snipesLeft: config.snipesPerPlayer,
      missedSnipes: new Set(),
      graceTimer: null,
      graceDeadline: null,
      expired: false,
    });
    if (this.players.length === 2) this._startSelection();
    else this._notify();
    return { playerIndex, token };
  }

  // ---------- disconnects ----------
  disconnect(socketId) {
    const i = this.players.findIndex((p) => p.socketId === socketId);
    if (i === -1 || !this.players[i].connected) return;
    this.players[i].connected = false;
    if (this._inProgress()) this._startGrace(i);
    this._notify();
  }

  _startGrace(i) {
    const p = this.players[i];
    this._clearGrace(p);
    const ms = config.reconnectGraceSeconds * 1000;
    p.graceDeadline = Date.now() + ms;
    p.graceTimer = setTimeout(() => this._graceExpired(i), ms);
  }

  _graceExpired(i) {
    const p = this.players[i];
    if (!p || p.connected || this.phase === PHASE.GAME_OVER) return;
    p.graceTimer = null;
    p.graceDeadline = null;
    p.expired = true;

    const opp = this.players[other(i)];
    if (opp.connected) return this._endGame(other(i), 'disconnect');
    if (opp.expired) return this.onAbandon(this); // both gone: nobody wins
    // Opponent is also offline but still inside their own grace period: wait for them.
  }

  reconnect(token, socketId) {
    const i = this.players.findIndex((p) => p.token === token);
    this._need(i !== -1, 'Invalid session');
    const p = this.players[i];
    p.socketId = socketId;
    p.connected = true;
    p.expired = false;
    this._clearGrace(p);

    // The other player ran out of time while we were offline too: we win by walkover
    const opp = this.players[other(i)];
    if (this._inProgress() && opp?.expired) {
      this._endGame(i, 'disconnect');
      return i;
    }
    this._notify();
    return i;
  }

  leave(i) {
    const p = this.players[i];
    if (!p) return;
    p.left = true;
    if (this.phase === PHASE.GAME_OVER || this.players.length < 2) return;
    this._endGame(other(i), 'forfeit');
  }

  // ---------- selection ----------
  _startSelection() {
    this.phase = PHASE.SELECTING_CELEBRITY;
    this.selectionDeadline = Date.now() + config.selectionSeconds * 1000;
    this.selectionTimer = setTimeout(() => this._finishSelection(), config.selectionSeconds * 1000);
    this._notify();
  }

  selectCelebrity(i, id) {
    this._needPhase(PHASE.SELECTING_CELEBRITY);
    this._needCelebrity(id);
    this._need(!this.players[i].secret, 'Celebrity already locked');
    this.players[i].secret = id;
    if (this.players.every((p) => p.secret)) this._finishSelection();
    else this._notify();
  }

  _finishSelection() {
    if (this.phase !== PHASE.SELECTING_CELEBRITY) return;
    clearTimeout(this.selectionTimer);
    for (const p of this.players) {
      if (!p.secret) p.secret = this.board[Math.floor(Math.random() * this.board.length)];
    }
    this.selectionDeadline = null;
    this.activePlayer = 0;
    this.phase = PHASE.ASKING;
    this.startedAt = Date.now();
    this._notify();
  }

  // ---------- turn loop ----------
  ask(i, text) {
    this._needPhase(PHASE.ASKING);
    this._needActive(i);
    const q = typeof text === 'string' ? text.trim() : '';
    this._need(q.length > 0 && q.length <= config.maxQuestionLength, 'Invalid question');
    this.question = { text: q, askedBy: i, answer: null };
    this.questionCount += 1;
    this.lastSnipe = null;
    this.phase = PHASE.WAITING_FOR_ANSWER;
    this._notify();
  }

  answer(i, answer) {
    this._needPhase(PHASE.WAITING_FOR_ANSWER);
    this._need(i === other(this.activePlayer), 'You are not the one answering');
    this._need(answer === 'YES' || answer === 'NO', 'Answer must be YES or NO');
    this.question.answer = answer;
    this.history.push({ by: this.question.askedBy, text: this.question.text, answer });
    this.phase = PHASE.ELIMINATING;
    this._notify();
  }

  // Only changes the caller's OWN eliminated set. Never automatic.
  toggleCard(i, id) {
    this._needPhase(PHASE.ELIMINATING);
    this._needActive(i);
    this._needCelebrity(id);
    const set = this.players[i].eliminated;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this._notify();
    return set.has(id);
  }

  endTurn(i) {
    this._needPhase(PHASE.ELIMINATING);
    this._needActive(i);
    this.question = null;
    this.activePlayer = other(i);
    this.phase = PHASE.ASKING;
    this._notify();
  }

  // ---------- snipe ----------
  snipeStart(i) {
    this._needPhase(PHASE.ASKING, PHASE.ELIMINATING);
    this._needActive(i);
    this.snipeReturnPhase = this.phase;
    this.phase = PHASE.SNIPE_CONFIRMATION;
    this._notify();
  }

  snipeCancel(i) {
    this._needPhase(PHASE.SNIPE_CONFIRMATION);
    this._needActive(i);
    this.phase = this.snipeReturnPhase;
    this.snipeReturnPhase = null;
    this._notify();
  }

  snipeGuess(i, id) {
    this._needPhase(PHASE.SNIPE_CONFIRMATION);
    this._needActive(i);
    this._needCelebrity(id);
    const me = this.players[i];
    this._need(!me.missedSnipes.has(id), 'You already sniped that one');

    const hit = this.players[other(i)].secret === id;
    const extra = { sniperIndex: i, guessedId: id };
    if (hit) return this._endGame(i, 'snipe_hit', extra);

    me.snipesLeft -= 1;
    me.missedSnipes.add(id);
    if (me.snipesLeft <= 0) return this._endGame(other(i), 'snipe_miss', extra);

    // First miss: costs the turn. What was guessed is public; the secret stays hidden.
    this.lastSnipe = { by: i, guessedId: id, snipesLeft: me.snipesLeft };
    this.question = null;
    this.snipeReturnPhase = null;
    this.activePlayer = other(i);
    this.phase = PHASE.ASKING;
    this._notify();
  }

  _endGame(winner, reason, extra = {}) {
    this.dispose();
    const endedAt = Date.now();
    this.phase = PHASE.GAME_OVER;
    this.finishedAt = endedAt;
    this.result = {
      winner,
      reason, // 'snipe_hit' | 'snipe_miss' | 'forfeit' | 'disconnect'
      secrets: [this.players[0]?.secret ?? null, this.players[1]?.secret ?? null],
      questionCount: this.questionCount,
      durationMs: this.startedAt ? endedAt - this.startedAt : 0,
      ...extra,
    };
    this._notify();
    this.onEnd(this);
  }

  // ---------- per-player view (the ONLY thing that leaves the server) ----------
  viewFor(i) {
    const me = this.players[i];
    return {
      code: this.code,
      isPublic: this.isPublic,
      board: this.board, // same for both players; contains no secrets
      boardDate: this.boardDate,
      phase: this.phase,
      you: i,
      activePlayer: this.activePlayer,
      players: this.players.map((p) => ({
        name: p.name,
        connected: p.connected,
        reconnectDeadline: p.graceDeadline,
        locked: !!p.secret, // "has chosen", never WHAT they chose
        snipesLeft: p.snipesLeft, // public, like in a real game
      })),
      mySecret: me.secret, // your own pick only
      myEliminated: [...me.eliminated], // your own board only
      myMissedSnipes: [...me.missedSnipes],
      selectionDeadline: this.selectionDeadline,
      serverTime: Date.now(),
      question: this.question,
      history: this.history,
      questionCount: this.questionCount,
      lastSnipe: this.lastSnipe,
      // Secrets are included only once the game is over
      result: this.phase === PHASE.GAME_OVER ? this.result : null,
    };
  }
}