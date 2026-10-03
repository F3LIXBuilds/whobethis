import fs from 'node:fs';
import config from '../config.js';

// Matches the bot names the test script generates, e.g. P1_x7k2m9
const TEST_NAME = /^(P1|P2|P|A|B|C|FA|FB)_[a-z0-9]{1,6}$/;
const apply = process.argv.includes('--delete');

let db;
try {
  db = JSON.parse(fs.readFileSync(config.dataFile, 'utf8'));
} catch {
  console.log('No database file found at', config.dataFile);
  process.exit(0);
}

const all = Object.values(db.players ?? {});
const doomed = all.filter((p) => TEST_NAME.test(p.username));
console.log(`Found ${doomed.length} test account(s): ${doomed.map((p) => p.username).join(', ') || '(none)'}`);
console.log(`${all.length - doomed.length} other account(s) will be kept.`);

if (!apply) {
  console.log('\nDry run only. Re-run with --delete to remove them.');
  process.exit(0);
}

for (const p of doomed) delete db.players[p.id];
fs.writeFileSync(config.dataFile, JSON.stringify(db));
console.log('Removed.');