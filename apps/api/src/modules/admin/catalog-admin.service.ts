import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { ProductStatus } from '../../generated/prisma/enums.js';
import { slugify } from '../../common/slugify.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { CreateFormulaDto } from './dto/create-formula.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class CatalogAdminService {
  constructor(private readonly prisma: PrismaService) {}

  listBrands() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async createBrand(input: CreateBrandDto) {
    const name = input.name.trim();
    const slug = slugify(name);
    const existing = await this.prisma.brand.findFirst({
      where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }] },
    });

    if (existing) {
      throw new ConflictException('Brand already exists');
    }

    return this.prisma.brand.create({ data: { name, slug, website: input.website } });
  }

  async createCategory(input: CreateCategoryDto) {
    const name = input.name.trim();
    const slug = slugify(name);
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }] },
    });

    if (existing) {
      throw new ConflictException('Category already exists');
    }

    return this.prisma.category.create({ data: { name, slug } });
  }

  async createProduct(input: CreateProductDto) {
    return this.prisma.$transaction(async (transaction) => {
      const [brand, category] = await Promise.all([
        transaction.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }),
        transaction.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
      ]);

      if (!brand || !category) {
        throw new NotFoundException('Brand or category not found');
      }

      const slug = slugify(input.name);
      const existing = await transaction.product.findUnique({ where: { slug }, select: { id: true } });

      if (existing) {
        throw new ConflictException('Product already exists');
      }

      const product = await transaction.product.create({
        data: {
          brandId: input.brandId,
          categoryId: input.categoryId,
          name: input.name.trim(),
          slug,
          description: input.description?.trim(),
          status: input.status,
        },
      });
      const variant = await transaction.productVariant.create({
        data: {
          productId: product.id,
          name: input.variant.name.trim(),
          sizeValue: input.variant.sizeValue,
          sizeUnit: input.variant.sizeUnit?.trim(),
          barcode: input.variant.barcode,
          images: {
            create: input.variant.images.map((image, index) => ({
              url: image.url,
              altText: image.altText,
              sortOrder: index,
            })),
          },
        },
      });

      await this.createFormulaVersion(transaction, variant.id, 1, input.variant.formula);

      return transaction.product.findUniqueOrThrow({
        where: { id: product.id },
        include: this.productDetailsInclude(),
      });
    });
  }

  async updateProduct(id: string, input: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        brandId: input.brandId,
        categoryId: input.categoryId,
        name: input.name?.trim(),
        description: input.description?.trim(),
        status: input.status,
      },
      include: this.productDetailsInclude(),
    });
  }

  async archiveProduct(id: string) {
    const result = await this.prisma.product.updateMany({
      where: { id, status: { not: ProductStatus.ARCHIVED } },
      data: { status: ProductStatus.ARCHIVED },
    });

    if (result.count === 0) {
      throw new NotFoundException('Active product not found');
    }

    return { id, status: ProductStatus.ARCHIVED };
  }

  async addFormula(variantId: string, input: CreateFormulaDto) {
    return this.prisma.$transaction(async (transaction) => {
      const variant = await transaction.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true },
      });

      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }

      const latest = await transaction.formulaVersion.aggregate({
        where: { variantId },
        _max: { version: true },
      });

      return this.createFormulaVersion(transaction, variantId, (latest._max.version ?? 0) + 1, input);
    });
  }

  private async createFormulaVersion(
    transaction: Prisma.TransactionClient,
    variantId: string,
    version: number,
    input: CreateFormulaDto,
  ) {
    if (input.isActive) {
      await transaction.formulaVersion.updateMany({
        where: { variantId, isActive: true },
        data: { isActive: false },
      });
    }

    const ingredients = await Promise.all(
      input.ingredients.map(async (item) => {
        const inciName = item.inciName.trim().toUpperCase();
        return transaction.ingredient.upsert({
          where: { inciName },
          update: {
            commonNames: item.commonNames,
            functions: item.functions,
            description: item.description?.trim(),
          },
          create: {
            inciName,
            slug: slugify(inciName),
            commonNames: item.commonNames ?? [],
            functions: item.functions ?? [],
            description: item.description?.trim(),
          },
        });
      }),
    );

    return transaction.formulaVersion.create({
      data: {
        variantId,
        version,
        rawInci: input.rawInci.trim(),
        sourceName: input.sourceName?.trim(),
        sourceUrl: input.sourceUrl,
        confidence: input.confidence,
        isActive: input.isActive,
        ingredients: {
          create: ingredients.map((ingredient, position) => ({
            ingredientId: ingredient.id,
            rawName: input.ingredients[position]?.rawName?.trim() ?? ingredient.inciName,
            position: position + 1,
          })),
        },
      },
      include: {
        ingredients: {
          orderBy: { position: 'asc' },
          include: { ingredient: true },
        },
      },
    });
  }

  private productDetailsInclude() {
    return {
      brand: true,
      category: true,
      variants: {
        include: {
          images: { orderBy: { sortOrder: 'asc' as const } },
          formulas: {
            orderBy: { version: 'desc' as const },
            include: {
              ingredients: {
                orderBy: { position: 'asc' as const },
                include: { ingredient: true },
              },
            },
          },
        },
      },
    };
  }
}
