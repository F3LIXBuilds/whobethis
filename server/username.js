import config from './config.js';

const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'support', 'official', 'system', 'staff', 'whobethis'];
// Starter list only. Extend it before launch (or use a profanity package).
const BLOCKED = ['fuck', 'shit', 'bitch', 'nigger', 'nigga', 'cunt', 'rape'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };

export function validateUsername(raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  const { min, max } = config.username;

  if (name.length < min || name.length > max) return { error: `Username must be ${min}-${max} characters` };
  if (!/^[A-Za-z0-9_]+$/.test(name)) return { error: 'Use letters, numbers and underscores only' };

  const norm = name.toLowerCase().replace(/_/g, '').replace(/[0134578]/g, (c) => LEET[c]);
  if (RESERVED.includes(norm) || BLOCKED.some((w) => norm.includes(w))) {
    return { error: 'That username is not allowed' };
  }
  return { name };
}

const COMMON_PASSWORDS = ['password', '12345678', '123456789', 'qwertyui', '11111111', 'iloveyou', 'password1'];

export function validatePassword(raw, username = '') {
  const { min, max } = config.password;
  if (typeof raw !== 'string') return { error: 'Enter a password' };
  if (raw.length < min) return { error: `Password must be at least ${min} characters` };
  if (raw.length > max) return { error: `Password must be at most ${max} characters` };
  if (raw.trim().length === 0) return { error: 'Password can’t be only spaces' };
  if (raw.toLowerCase() === String(username).toLowerCase()) {
    return { error: 'Password can’t be the same as your username' };
  }
  if (COMMON_PASSWORDS.includes(raw.toLowerCase())) return { error: 'That password is too common' };
  return { ok: true };
}