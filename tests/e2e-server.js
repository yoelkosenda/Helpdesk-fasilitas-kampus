// Menyiapkan SQLite terisolasi untuk Playwright E2E agar schema.prisma PostgreSQL tidak tersentuh.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const tmp = path.join(__dirname, 'tmp');
const dbPath = path.join(tmp, 'e2e.db');
const schemaPath = path.join(tmp, 'e2e.schema.prisma');
const clientPath = path.join(tmp, 'e2e-client');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

fs.mkdirSync(tmp, { recursive: true });
process.env.DATABASE_URL = 'file:./e2e.db';
process.env.PRISMA_CLIENT_PATH = clientPath;
process.env.SEED_PASSWORD = process.env.SEED_PASSWORD || 'e2e-seed-password-123';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-jwt-secret';

const baseSchema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const sqliteSchema = baseSchema
  .replace('provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  output   = "./e2e-client"')
  .replace(/provider\s*=\s*"postgresql"/, 'provider  = "sqlite"')
  .replace(/^\s*directUrl\s*=.*\r?\n/m, '');
fs.writeFileSync(schemaPath, sqliteSchema);

fs.rmSync(dbPath, { force: true });
fs.writeFileSync(dbPath, '');
const run = (args) => execFileSync(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
run([prismaCli, 'generate', '--schema', schemaPath]);
run([prismaCli, 'db', 'push', '--schema', schemaPath, '--force-reset', '--skip-generate']);
run([path.join(root, 'prisma', 'seed.js')]);

require('../src/server');
