import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ESTIMATE_RULES_V1 } from './estimate-rules.v1';

const prisma = new PrismaClient();

/** Realistic uz FAQ content (docs/public-content.md §FAQ). */
const FAQ_ITEMS: Prisma.FaqItemCreateManyInput[] = [
  {
    category: 'Umumiy',
    sortOrder: 0,
    question: 'archAi nima va u nima qiladi?',
    answer:
      "archAi — uy qurilishini rejalashtirishga yordam beruvchi vosita. Siz yer va uy " +
      "o'lchamlari, qavatlar va xonalarni kiritasiz, u esa taxminiy qavat rejasi va " +
      "dastlabki qurilish smetasini tayyorlaydi.",
  },
  {
    category: 'Umumiy',
    sortOrder: 1,
    question: 'Loyihani AI yordamida matn orqali kirita olamanmi?',
    answer:
      "Ha. Uyingizni oddiy so'zlar bilan tasvirlab bering — masalan '6 sotix yerga 2 " +
      "qavatli, 3 xonali zamonaviy uy' — AI uni tuzilgan loyihaga aylantiradi. Natijani " +
      "doim qo'lda tahrirlashingiz mumkin.",
  },
  {
    category: 'Smeta',
    sortOrder: 0,
    question: 'Smeta qanchalik aniq?',
    answer:
      "Smeta — bu dastlabki taxmin, aniq narx emas. U ochiq narx qoidalari asosida " +
      "hisoblanadi va real narxlar mintaqa, materiallar va pudratchiga qarab farq qiladi. " +
      "Byudjetni rejalashtirishning boshlang'ich nuqtasi sifatida foydalaning.",
  },
  {
    category: 'Smeta',
    sortOrder: 1,
    question: 'Bu rasmiy qurilish hujjatimi?',
    answer:
      "Yo'q. archAi natijalari — rejalashtirish uchun taxminiy ma'lumot. Ular rasmiy " +
      "loyiha hujjati yoki qurilish ruxsatnomasi o'rnini bosmaydi. Qurilishdan oldin " +
      "litsenziyalangan me'mor va muhandis bilan maslahatlashing.",
  },
  {
    category: 'Umumiy',
    sortOrder: 2,
    question: "Qaysi tillar qo'llab-quvvatlanadi?",
    answer:
      "Interfeys o'zbek, rus va ingliz tillarida. Hozircha kontent (blog va FAQ) asosan " +
      "o'zbek tilida yuritiladi.",
  },
  {
    category: 'Maxfiylik',
    sortOrder: 0,
    question: "Ma'lumotlarim maxfiy saqlanadimi?",
    answer:
      "Loyihalaringiz sizning hisobingizga bog'langan va faqat sizga ko'rinadi. Biz " +
      "loyiha ma'lumotlaringizni uchinchi tomonlarga sotmaymiz. AI so'rovlari faqat " +
      "natijani tayyorlash uchun ishlatiladi.",
  },
  {
    category: 'Narx',
    sortOrder: 0,
    question: 'archAi bepulmi?',
    answer:
      "Ha, hozircha barcha imkoniyatlar bepul — biz beta bosqichidamiz. To'lov tizimi " +
      "hali ulanmagan. Kelajakdagi tariflar bilan Narxlar sahifasida tanishishingiz mumkin.",
  },
];

/** 2–3 published uz posts with real slugs (docs/public-content.md §Blog). */
const BLOG_POSTS: Prisma.BlogPostCreateManyInput[] = [
  {
    slug: 'uy-loyihasini-qayerdan-boshlash',
    title: 'Uy loyihasini qayerdan boshlash kerak',
    excerpt:
      "Yer o'lchami, byudjet va oila ehtiyojlaridan boshlab, birinchi qadamlarni " +
      "bosqichma-bosqich ko'rib chiqamiz.",
    body: `Yangi uy qurishni rejalashtirish ko'p qarorlardan boshlanadi. Qayerdan boshlashni bilish butun jarayonni osonlashtiradi.

## Yerdan boshlang

Avvalo yer maydoni va uning o'lchamlarini aniqlang. Yer shakli uy joylashuvini belgilaydi.

## Byudjetni belgilang

Dastlabki smeta yordamida taxminiy xarajatni chamalang. Bu real rejaga zamin bo'ladi.

## Ehtiyojlarni ro'yxatlang

Nechta yotoqxona, qavat va qo'shimcha imkoniyat (garaj, terrasa) kerakligini yozib chiqing.`,
    authorName: 'ArchAI jamoasi',
    category: 'Rejalashtirish',
    tags: ['rejalashtirish', 'boshlovchilar'],
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-07-10T09:00:00.000Z'),
    metaTitle: 'Uy loyihasini qayerdan boshlash kerak | archAi',
    metaDescription:
      "Uy qurilishini rejalashtirishning birinchi qadamlari: yer, byudjet va oila ehtiyojlari.",
  },
  {
    slug: 'smetani-qanday-oqish-kerak',
    title: "Qurilish smetasini qanday o'qish kerak",
    excerpt:
      "Struktura, pardozlash, imkoniyatlar va zaxira — smeta qatorlari nimani anglatishini " +
      "tushuntiramiz.",
    body: `Smeta dastlab murakkab ko'rinishi mumkin, lekin uning tuzilishi oddiy.

## Asosiy qatorlar

**Struktura** — poydevor, devor va tom. **Pardozlash** — ichki va tashqi bezak. **Imkoniyatlar** — garaj, terrasa va boshqalar.

## Zaxira haqida

Har bir smetaga kutilmagan xarajatlar uchun zaxira qo'shiladi. Bu me'yoriy amaliyot.

## Diapazon

Yakuniy raqam emas, balki narx oralig'iga e'tibor bering — real xarajat shu oraliqda bo'ladi.`,
    authorName: 'ArchAI jamoasi',
    category: 'Smeta',
    tags: ['smeta', 'byudjet'],
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-07-24T09:00:00.000Z'),
    metaTitle: "Qurilish smetasini qanday o'qish kerak | archAi",
    metaDescription:
      "Smeta qatorlari: struktura, pardozlash, imkoniyatlar, zaxira va narx oralig'i tushuntirilgan.",
  },
  {
    slug: 'uy-uslubini-tanlash',
    title: 'Uyingiz uchun uslubni qanday tanlash',
    excerpt:
      "Zamonaviy, minimalist yoki milliy — uslub tanlashda nimalarga e'tibor berish " +
      "kerakligini ko'rib chiqamiz.",
    body: `Uslub — bu shunchaki ko'rinish emas, u qulaylik va xarajatga ham ta'sir qiladi.

## Keng tarqalgan uslublar

**Zamonaviy** — toza chiziqlar va katta oynalar. **Minimalist** — soddalik va funksionallik. **Milliy** — an'anaviy elementlar.

## Iqlimni hisobga oling

Mintaqangiz ob-havosi materiallar va tom shaklini belgilashda muhim.

## Byudjet bilan muvozanat

Ba'zi uslublar qimmatroq pardozlashni talab qiladi — smetada buni oldindan ko'ring.`,
    authorName: 'ArchAI jamoasi',
    category: 'Dizayn',
    tags: ['uslub', 'dizayn'],
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-08-07T09:00:00.000Z'),
    metaTitle: 'Uyingiz uchun uslubni qanday tanlash | archAi',
    metaDescription:
      "Uy uslubini tanlash: zamonaviy, minimalist va milliy uslublar, iqlim va byudjet.",
  },
];

/** FREE/BASIC/PRO plans (docs/public-content.md §Pricing). Free during beta. */
const PRICING_PLANS: Prisma.PricingPlanCreateManyInput[] = [
  {
    key: 'FREE',
    name: 'Bepul',
    tagline: 'Hozircha hammasi bepul',
    priceMonthly: 0,
    limits: { projects: 3, aiParsesPerMonth: 10, pdfExportsPerMonth: 10, storageMb: 200 },
    features: ['projects_3', 'ai_parse', 'floor_plan', 'estimate', 'pdf_export'],
    sortOrder: 0,
    isActive: true,
  },
  {
    key: 'BASIC',
    name: 'Bazaviy',
    tagline: 'Faol quruvchilar uchun',
    priceMonthly: 99_000,
    limits: { projects: 25, aiParsesPerMonth: 100, pdfExportsPerMonth: 100, storageMb: 2_000 },
    features: [
      'projects_25',
      'ai_parse',
      'floor_plan',
      'estimate',
      'pdf_export',
      'priority_support',
    ],
    sortOrder: 1,
    isActive: true,
  },
  {
    key: 'PRO',
    name: 'Pro',
    tagline: 'Studiyalar va professionallar',
    priceMonthly: 299_000,
    limits: {
      projects: null,
      aiParsesPerMonth: null,
      pdfExportsPerMonth: null,
      storageMb: 20_000,
    },
    features: [
      'projects_unlimited',
      'ai_parse',
      'floor_plan',
      'estimate',
      'pdf_export',
      'priority_support',
      'early_access',
    ],
    sortOrder: 2,
    isActive: true,
  },
];

/**
 * Reference data every environment needs, production included: the estimate
 * rule set and the public marketing content. None of it is an account and none
 * of it carries a credential.
 *
 * It is split from the demo accounts because a production database needs the
 * pricing rules — without an active `estimate_rules` row the estimate and the
 * PDF export both fail with 500 — but must never receive the repo-published
 * demo passwords. Before the split the only way to get one was to also get the
 * other.
 */
async function seedReferenceData(): Promise<void> {
  // Prices are data an administrator may already have tuned: seed them only when
  // no active rule set exists, and never overwrite one that does.
  const activeRules = await prisma.estimateRule.findFirst({ where: { isActive: true } });
  if (activeRules === null) {
    await prisma.estimateRule.create({
      data: { version: ESTIMATE_RULES_V1.version, data: ESTIMATE_RULES_V1, isActive: true },
    });
  }

  // Public content is only seeded into an empty table, so an administrator's edits
  // (or deletions) are never resurrected by a re-run.
  if ((await prisma.faqItem.count()) === 0) {
    await prisma.faqItem.createMany({ data: FAQ_ITEMS });
  }
  if ((await prisma.blogPost.count()) === 0) {
    await prisma.blogPost.createMany({ data: BLOG_POSTS });
  }
  if ((await prisma.pricingPlan.count()) === 0) {
    await prisma.pricingPlan.createMany({ data: PRICING_PLANS });
  }
}

async function main() {
  // `--reference-only` seeds the rule set and public content and stops there.
  // It is the production-safe half and carries no credential, so it runs
  // without ALLOW_PROD_SEED.
  const referenceOnly =
    process.argv.includes('--reference-only') || process.env.SEED_REFERENCE_ONLY === 'true';

  if (referenceOnly) {
    await seedReferenceData();
    const rules = await prisma.estimateRule.findFirst({ where: { isActive: true } });
    console.log(
      `Seeded reference data: estimateRules=v${rules?.version ?? '?'}, ` +
        `faq=${await prisma.faqItem.count()}, blog=${await prisma.blogPost.count()}, ` +
        `pricing=${await prisma.pricingPlan.count()} (no accounts created)`,
    );
    return;
  }

  // These seeded credentials are published in the repo (README, login page hint),
  // so seeding a production database would plant a known admin password. Refuse
  // unless explicitly overridden for a deliberate demo deployment.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error(
      'Refusing to seed in production. Set ALLOW_PROD_SEED=true only for an intentional demo environment. ' +
        'For the rule set and public content alone, use `pnpm prisma:seed:reference`.',
    );
  }

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

  await seedReferenceData();

  const activeRules = await prisma.estimateRule.findFirst({ where: { isActive: true } });
  console.log(
    `Seeded: admin=${admin.email}, demo=${demo.email}, ` +
      `estimateRules=v${activeRules?.version ?? ESTIMATE_RULES_V1.version}, ` +
      `faq=${await prisma.faqItem.count()}, blog=${await prisma.blogPost.count()}, ` +
      `pricing=${await prisma.pricingPlan.count()}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
