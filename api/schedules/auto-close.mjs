import { handleSchedule } from '@vercel/schedules';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { jalankanAutoClose } = require('../../src/services/autoClose');

export const POST = handleSchedule(async () => {
  const closed = await jalankanAutoClose();
  if (closed.length) {
    console.log(`[auto-close] ${closed.length} laporan ditutup: ${closed.join(', ')}`);
  }
});
