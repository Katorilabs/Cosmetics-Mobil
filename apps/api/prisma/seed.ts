import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  EvidenceEffect,
  EvidenceLevel,
  ProductStatus,
  SkinConcern,
  SkinType,
} from '../src/generated/prisma/enums.js';

const rootEnvironmentFile = fileURLToPath(new URL('../../../.env', import.meta.url));

if (existsSync(rootEnvironmentFile)) {
  process.loadEnvFile(rootEnvironmentFile);
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ingredients = [
  {
    inciName: 'AQUA',
    commonNames: ['Su'],
    functions: ['solvent'],
    description: 'Demo formüllerde çözücü baz olarak kullanılan içerik.',
  },
  {
    inciName: 'GLYCERIN',
    commonNames: ['Gliserin'],
    functions: ['humectant', 'skin conditioning'],
    description: 'Cildin nem tutmasına yardımcı olan humektan.',
  },
  {
    inciName: 'NIACINAMIDE',
    commonNames: ['Niasinamid', 'B3 Vitamini'],
    functions: ['skin conditioning'],
    description: 'Kozmetik formüllerde cilt bakım amacıyla kullanılan niasinamid.',
  },
  {
    inciName: 'PANTHENOL',
    commonNames: ['Pantenol', 'Provitamin B5'],
    functions: ['humectant', 'skin conditioning'],
    description: 'Nem desteği ve cilt bakım fonksiyonuyla kullanılan içerik.',
  },
  {
    inciName: 'SODIUM HYALURONATE',
    commonNames: ['Sodyum Hiyalüronat'],
    functions: ['humectant'],
    description: 'Hyalüronik asidin tuz formu olarak kullanılan humektan.',
  },
  {
    inciName: 'COCO-GLUCOSIDE',
    commonNames: [],
    functions: ['surfactant', 'cleansing'],
    description: 'Temizleyici ürünlerde kullanılan yüzey aktif içerik.',
  },
  {
    inciName: 'BETAINE',
    commonNames: ['Betain'],
    functions: ['humectant', 'skin conditioning'],
    description: 'Formülde nem desteği amacıyla kullanılan içerik.',
  },
];

const products = [
  {
    name: 'Daily Balance Gel Cream',
    slug: 'daily-balance-gel-cream',
    categorySlug: 'nemlendirici',
    description: 'Katalog, formül versiyonu ve filtreleme akışını test eden demo nemlendirici.',
    variant: { name: '50 ml', sizeValue: '50.00', sizeUnit: 'ml', barcode: '8690000000001' },
    inciNames: ['AQUA', 'GLYCERIN', 'NIACINAMIDE', 'PANTHENOL', 'SODIUM HYALURONATE'],
  },
  {
    name: 'Gentle Daily Cleanser',
    slug: 'gentle-daily-cleanser',
    categorySlug: 'temizleyici',
    description: 'Katalog ve INCI normalizasyon akışını test eden demo temizleyici.',
    variant: { name: '200 ml', sizeValue: '200.00', sizeUnit: 'ml', barcode: '8690000000002' },
    inciNames: ['AQUA', 'COCO-GLUCOSIDE', 'GLYCERIN', 'BETAINE', 'PANTHENOL'],
  },
];

const ingredientAliases = [
  { inciName: 'AQUA', alias: 'Water' },
  { inciName: 'NIACINAMIDE', alias: 'Vitamin B3' },
  { inciName: 'NIACINAMIDE', alias: 'Niasinamid' },
  { inciName: 'PANTHENOL', alias: 'Provitamin B5' },
];

async function seed(): Promise<void> {
  const brand = await prisma.brand.upsert({
    where: { slug: 'cosmedia-demo-lab' },
    update: { name: 'Cosmedia Demo Lab', website: 'https://example.com' },
    create: { name: 'Cosmedia Demo Lab', slug: 'cosmedia-demo-lab', website: 'https://example.com' },
  });
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'nemlendirici' },
      update: { name: 'Nemlendirici' },
      create: { name: 'Nemlendirici', slug: 'nemlendirici' },
    }),
    prisma.category.upsert({
      where: { slug: 'temizleyici' },
      update: { name: 'Temizleyici' },
      create: { name: 'Temizleyici', slug: 'temizleyici' },
    }),
  ]);
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const ingredientRecords = await Promise.all(
    ingredients.map((ingredient) =>
      prisma.ingredient.upsert({
        where: { normalizedName: ingredient.inciName },
        update: { ...ingredient, normalizedName: ingredient.inciName },
        create: {
          ...ingredient,
          normalizedName: ingredient.inciName,
          slug: ingredient.inciName.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-'),
        },
      }),
    ),
  );
  const ingredientByName = new Map(
    ingredientRecords.map((ingredient) => [ingredient.inciName, ingredient]),
  );
  const niacinamide = ingredientByName.get('NIACINAMIDE');

  if (!niacinamide) {
    throw new Error('NIACINAMIDE seed ingredient is missing');
  }

  for (const item of ingredientAliases) {
    const ingredient = ingredientByName.get(item.inciName);

    if (!ingredient) {
      throw new Error(`Seed alias ingredient is missing: ${item.inciName}`);
    }

    const normalizedAlias = item.alias.trim().replace(/\s+/g, ' ').toLocaleUpperCase('en-US');
    await prisma.ingredientAlias.upsert({
      where: { normalizedAlias },
      update: {
        ingredientId: ingredient.id,
        alias: item.alias,
        sourceName: 'Cosmedia demo manual review',
        reviewedAt: new Date('2026-08-16T00:00:00.000Z'),
      },
      create: {
        ingredientId: ingredient.id,
        alias: item.alias,
        normalizedAlias,
        sourceName: 'Cosmedia demo manual review',
        reviewedAt: new Date('2026-08-16T00:00:00.000Z'),
      },
    });
  }

  const niacinamideEvidenceKey = {
    ingredientId: niacinamide.id,
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/7657446/',
    title: 'Topical nicotinamide compared with clindamycin gel in inflammatory acne',
  };
  const existingNiacinamideEvidence = await prisma.ingredientEvidence.findFirst({
    where: niacinamideEvidenceKey,
    select: { id: true },
  });
  const niacinamideEvidence = {
    ...niacinamideEvidenceKey,
    summary: 'Bu çalışma %4 topikal nikotinamid jeli incelemiştir. Bir üründe yalnızca INCI adının bulunması aynı konsantrasyon veya klinik etkiyi garanti etmez.',
    sourceName: 'PubMed / International Journal of Dermatology',
    level: EvidenceLevel.MODERATE,
    effect: EvidenceEffect.BENEFICIAL,
    skinTypes: [SkinType.OILY, SkinType.COMBINATION],
    concerns: [SkinConcern.ACNE],
    publishedAt: new Date('1995-06-01T00:00:00.000Z'),
    reviewedAt: new Date('2026-08-16T00:00:00.000Z'),
  };

  if (existingNiacinamideEvidence) {
    await prisma.ingredientEvidence.update({
      where: { id: existingNiacinamideEvidence.id },
      data: niacinamideEvidence,
    });
  } else {
    await prisma.ingredientEvidence.create({ data: niacinamideEvidence });
  }

  for (const item of products) {
    const category = categoryBySlug.get(item.categorySlug);

    if (!category) {
      throw new Error(`Seed category is missing: ${item.categorySlug}`);
    }

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        brandId: brand.id,
        categoryId: category.id,
        name: item.name,
        description: item.description,
        status: ProductStatus.PUBLISHED,
      },
      create: {
        brandId: brand.id,
        categoryId: category.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        status: ProductStatus.PUBLISHED,
      },
    });
    const variant = await prisma.productVariant.upsert({
      where: { productId_name: { productId: product.id, name: item.variant.name } },
      update: {
        sizeValue: item.variant.sizeValue,
        sizeUnit: item.variant.sizeUnit,
        barcode: item.variant.barcode,
        isActive: true,
      },
      create: {
        productId: product.id,
        ...item.variant,
      },
    });
    const rawInci = item.inciNames.join(', ');
    const formula = await prisma.formulaVersion.upsert({
      where: { variantId_version: { variantId: variant.id, version: 1 } },
      update: {
        rawInci,
        sourceName: 'Cosmedia demo seed',
        isActive: true,
        confidence: '1.0000',
      },
      create: {
        variantId: variant.id,
        version: 1,
        rawInci,
        sourceName: 'Cosmedia demo seed',
        isActive: true,
        confidence: '1.0000',
      },
    });

    await prisma.productIngredient.deleteMany({ where: { formulaId: formula.id } });
    await prisma.productIngredient.createMany({
      data: item.inciNames.map((inciName, index) => {
        const ingredient = ingredientByName.get(inciName);

        if (!ingredient) {
          throw new Error(`Seed ingredient is missing: ${inciName}`);
        }

        return {
          formulaId: formula.id,
          ingredientId: ingredient.id,
          rawName: inciName,
          position: index + 1,
        };
      }),
    });
  }

  console.log(
    `Seed complete: ${products.length} products, ${ingredients.length} ingredients, ${ingredientAliases.length} reviewed aliases, 1 reviewed evidence record`,
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
