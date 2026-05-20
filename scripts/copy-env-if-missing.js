/* Copies .env.example → .env when .env does not exist (never overwrites). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, '.env');
const src = path.join(root, '.env.example');

if (fs.existsSync(dest)) {
  process.stdout.write('.env already exists; leaving it unchanged.\n');
  process.exit(0);
}
if (!fs.existsSync(src)) {
  process.stderr.write('Missing .env.example\n');
  process.exit(1);
}
fs.copyFileSync(src, dest);
process.stdout.write('Created .env from .env.example — add your Supabase URL and anon key.\n');
