const { PrismaClient } = process.env.PRISMA_CLIENT_PATH
  ? require(process.env.PRISMA_CLIENT_PATH)
  : require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
