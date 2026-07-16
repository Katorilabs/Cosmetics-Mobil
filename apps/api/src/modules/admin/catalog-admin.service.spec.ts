import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { ProductStatus } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../database/prisma.service.js';
import { CatalogAdminService } from './catalog-admin.service.js';

describe('CatalogAdminService', () => {
  const prisma = {
    brand: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
  };
  const service = new CatalogAdminService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a brand with a normalized slug', async () => {
    prisma.brand.findFirst.mockResolvedValue(null);
    prisma.brand.create.mockImplementation(({ data }) => Promise.resolve(data));

    await expect(service.createBrand({ name: 'Örnek Kozmetik' })).resolves.toMatchObject({
      name: 'Örnek Kozmetik',
      slug: 'ornek-kozmetik',
    });
  });

  it('rejects a duplicate brand', async () => {
    prisma.brand.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.createBrand({ name: 'Örnek Kozmetik' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('archives rather than physically deleting a product', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.archiveProduct('product-id')).resolves.toEqual({
      id: 'product-id',
      status: ProductStatus.ARCHIVED,
    });
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'product-id', status: { not: ProductStatus.ARCHIVED } },
      data: { status: ProductStatus.ARCHIVED },
    });
  });
});
