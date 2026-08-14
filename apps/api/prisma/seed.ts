import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ESTIMATE_RULES_V1 } from './estimate-rules.v1';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await argon2.hash('Admin1234!');
  const demoPassword = await argon2.hash('Demo1234!');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@archai.uz' },
    update: {},
    create: {
      email: 'admin@archai.uz',
      passwordHash: adminPassword,
      fullName: 'ArchAI Administrator',
      role: 'ADMIN',
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: 'demo@archai.uz' },
    update: {},
    create: {
      email: 'demo@archai.uz',
      passwordHash: demoPassword,
      fullName: 'Aziz Karimov',
      role: 'USER',
    },
  });

  const existing = await prisma.project.count({ where: { ownerId: demo.id } });
  if (existing === 0) {
    await prisma.project.create({
      data: {
        ownerId: demo.id,
        name: 'Oilaviy uy — Qibray',
        description: '6 sotix yerga 2 qavatli zamonaviy oilaviy uy, garaj va terrasa bilan.',
        status: 'CONFIGURED',
        landAreaM2: 600,
        landWidthM: 20,
        landLengthM: 30,
        houseWidthM: 11,
        houseLengthM: 13,
        floorCount: 2,
        style: 'MODERN',
        hasGarage: true,
        hasTerrace: true,
        hasGarden: true,
        rooms: {
          create: [
            { type: 'LIVING_ROOM', floor: 0, widthM: 5.5, lengthM: 6, sortOrder: 0 },
            { type: 'KITCHEN', floor: 0, widthM: 3.5, lengthM: 4.5, sortOrder: 1 },
            { type: 'DINING_ROOM', floor: 0, widthM: 3.5, lengthM: 4, sortOrder: 2 },
            { type: 'BATHROOM', floor: 0, widthM: 2, lengthM: 2.5, sortOrder: 3 },
            { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4.5, sortOrder: 4 },
            { type: 'BEDROOM', floor: 1, widthM: 4, lengthM: 4, sortOrder: 5 },
            { type: 'BEDROOM', floor: 1, widthM: 3.5, lengthM: 4, sortOrder: 6 },
            { type: 'BATHROOM', floor: 1, widthM: 2, lengthM: 2.5, sortOrder: 7 },
          ],
        },
      },
    });

    await prisma.project.create({
      data: {
        ownerId: demo.id,
        name: 'Dala hovli — Chorvoq',
        description: 'Bir qavatli minimalist dam olish uyi.',
        status: 'DRAFT',
        landAreaM2: 400,
        houseWidthM: 9,
        houseLengthM: 10,
        floorCount: 1,
        style: 'MINIMALIST',
        hasTerrace: true,
      },
    });
  }

  // Prices are data an administrator may already have tuned: seed them only when
  // no active rule set exists, and never overwrite one that does.
  const activeRules = await prisma.estimateRule.findFirst({ where: { isActive: true } });
  if (activeRules === null) {
    await prisma.estimateRule.create({
      data: { version: ESTIMATE_RULES_V1.version, data: ESTIMATE_RULES_V1, isActive: true },
    });
  }

  console.log(
    `Seeded: admin=${admin.email}, demo=${demo.email}, ` +
      `estimateRules=v${activeRules?.version ?? ESTIMATE_RULES_V1.version}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
