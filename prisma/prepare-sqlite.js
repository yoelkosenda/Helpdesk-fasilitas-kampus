// Prisma 6 may not create a missing SQLite file before db push on Windows.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveDatabasePath(databaseUrl) {
  const value = databaseUrl.slice('file:'.length).split('?')[0];
  const decoded = decodeURIComponent(value).replace(/\\/g, '/');

  if (/^\/[A-Za-z]:\//.test(decoded)) return path.win32.resolve(decoded.slice(1));
  if (/^[A-Za-z]:\//.test(decoded)) return path.win32.resolve(decoded);
  if (decoded.startsWith('/')) return path.resolve(decoded);
  return path.resolve(__dirname, decoded);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL belum diatur. Salin .env.example ke .env.');
  if (!databaseUrl.startsWith('file:')) return; // Other Prisma providers manage their own database files.

  const databasePath = resolveDatabasePath(databaseUrl);
  if (fs.existsSync(databasePath)) return;

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const projectRoot = path.resolve(__dirname, '..');
  const relativePath = path.relative(projectRoot, databasePath).replace(/\\/g, '/');
  const datasource = `file:./${relativePath}`;
  const { getEnginesPath } = require('@prisma/engines');
  const { getBinaryTargetForCurrentPlatform } = require('@prisma/get-platform');
  const binaryTarget = await getBinaryTargetForCurrentPlatform();
  const enginePath = path.join(getEnginesPath(), `schema-engine-${binaryTarget}${process.platform === 'win32' ? '.exe' : ''}`);
  const result = spawnSync(enginePath, ['cli', '--datasource', datasource, 'create-database'], {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
  });

  if (result.error || result.status !== 0) {
    throw result.error || new Error(result.stderr || `Gagal membuat file SQLite: ${databasePath}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
