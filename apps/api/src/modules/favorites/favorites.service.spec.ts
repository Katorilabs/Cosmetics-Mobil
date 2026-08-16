import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../database/prisma.service.js';
import { FavoritesService } from './favorites.service.js';

describe('FavoritesService', () => {
  it('adds the same published variant idempotently', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'favorite-id' });
    const service = new FavoritesService({
      productVariant: { findFirst: jest.fn().mockResolvedValue({ id: 'variant-id' }) },
      favorite: { upsert },
    } as unknown as PrismaService);

    await expect(service.add('user-id', 'variant-id')).resolves.toEqual({ id: 'favorite-id' });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_variantId: { userId: 'user-id', variantId: 'variant-id' } },
      update: {},
      create: { userId: 'user-id', variantId: 'variant-id' },
    }));
  });

  it('rejects an inactive, missing or unpublished variant', async () => {
    const service = new FavoritesService({
      productVariant: { findFirst: jest.fn().mockResolvedValue(null) },
      favorite: { upsert: jest.fn() },
    } as unknown as PrismaService);

    await expect(service.add('user-id', 'variant-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a paginated favorite list', async () => {
    const items = [{ id: 'favorite-id' }];
    const transaction = jest.fn().mockResolvedValue([items, 21]);
    const service = new FavoritesService({
      favorite: {
        findMany: jest.fn().mockReturnValue('find-many-query'),
        count: jest.fn().mockReturnValue('count-query'),
      },
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(service.list('user-id', { page: 2, limit: 20 })).resolves.toEqual({
      data: items,
      meta: { page: 2, limit: 20, total: 21, pageCount: 2 },
    });
    expect(transaction).toHaveBeenCalledWith(['find-many-query', 'count-query']);
  });

  it('allows removal to be safely repeated', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new FavoritesService({
      favorite: { deleteMany },
    } as unknown as PrismaService);

    await expect(service.remove('user-id', 'variant-id')).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-id', variantId: 'variant-id' },
    });
  });
});
