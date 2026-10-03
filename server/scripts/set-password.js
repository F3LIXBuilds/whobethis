import fs from 'node:fs';
import config from '../config.js';
import { hashPassword } from '../store.js';

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
  console.log('Usage: node scripts/set-password.js <username> <password, 8+ characters>');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
const player = Object.values(db.players ?? {}).find((p) => p.usernameLower === username.toLowerCase());
if (!player) {
  console.log(`No account named "${username}".`);
  process.exit(1);
}

player.passwordHash = await hashPassword(password);
player.sessions = []; // sign out every device
player.keyHash = null;
fs.writeFileSync(config.dataFile, JSON.stringify(db));
console.log(`Password set for ${player.username}. They can log in now.`);
