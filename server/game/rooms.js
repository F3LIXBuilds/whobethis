import { Room, PHASE } from './Room.js';
import config from '../config.js';

const rooms = new Map();
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(opts) {
  const room = new Room(generateCode(), opts);
  rooms.set(room.code, room);
  return room;
}

export const getRoom = (code) => rooms.get(code);

export function deleteRoom(code) {
  rooms.get(code)?.dispose();
  rooms.delete(code);
}

// What the lobby "scanner" shows: public rooms with a connected host and an empty seat
export function listPublicRooms() {
  return [...rooms.values()]
    .filter((r) => r.isPublic && r.phase === PHASE.WAITING_FOR_PLAYER && r.players[0]?.connected)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 30)
    .map((r) => ({ code: r.code, host: r.players[0].name, createdAt: r.createdAt }));
}

// Clears finished games nobody explicitly left
export function sweepFinished() {
  const cutoff = Date.now() - config.finishedRoomTtlMinutes * 60_000;
  for (const [code, r] of rooms) {
    if (r.phase === PHASE.GAME_OVER && r.finishedAt < cutoff) deleteRoom(code);
  }
}

// Used to reattach a player to their seat when they log in again (e.g. after closing the browser)
export function findRoomFor(profileId) {
  for (const room of rooms.values()) {
    const index = room.players.findIndex((p) => p.profileId === profileId && !p.left);
    if (index !== -1) return { room, index };
  }
  return null;
}