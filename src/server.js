const app = require('./app');
const config = require('./config');
const prisma = require('./db');
const { mulaiScheduler } = require('./services/autoClose');

const server = app.listen(config.port, () => {
  console.log(`Helpdesk Fasilitas Kampus API berjalan di http://localhost:${config.port}`);
  mulaiScheduler();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
