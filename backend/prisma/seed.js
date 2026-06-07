const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Seed Users
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  const members = [
    { name: '张三', phone: '13800138000', email: 'zhangsan@example.com', level: 'GOLD', points: 1500 },
    { name: '李四', phone: '13900139000', email: 'lisi@example.com', level: 'NORMAL', points: 200 },
    { name: '王五', phone: '13700137000', email: 'wangwu@example.com', level: 'SILVER', points: 800 },
    { name: '赵六', phone: '13600136000', email: 'zhaoliu@example.com', level: 'PLATINUM', points: 5000 },
    { name: '孙七', phone: '13500135000', email: 'sunqi@example.com', level: 'NORMAL', points: 50, status: 'INACTIVE' },
  ];

  console.log('Start seeding...');

  for (const m of members) {
    await prisma.member.upsert({
      where: { phone: m.phone },
      update: {},
      create: m,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
