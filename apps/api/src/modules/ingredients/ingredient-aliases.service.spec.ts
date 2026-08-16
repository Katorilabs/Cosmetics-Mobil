import { ConflictException, NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../database/prisma.service.js';
import { IngredientAliasesService } from './ingredient-aliases.service.js';

describe('IngredientAliasesService', () => {
  it('creates a reviewed alias with a normalized unique key', async () => {
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'alias-id', ...data }));
    const prisma = {
      ingredient: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'ingredient-id' })
          .mockResolvedValueOnce(null),
      },
      ingredientAlias: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    } as unknown as PrismaService;
    const service = new IngredientAliasesService(prisma);

    const result = await service.create('ingredient-id', {
      alias: ' Vitamin   B3 ',
      sourceName: 'Manual review',
    });

    expect(result).toMatchObject({
      alias: 'Vitamin B3',
      normalizedAlias: 'VITAMIN B3',
      sourceName: 'Manual review',
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewedAt: expect.any(Date) }),
    });
  });

  it('rejects aliases that collide with canonical names', async () => {
    const prisma = {
      ingredient: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'ingredient-id' })
          .mockResolvedValueOnce({ id: 'other-ingredient-id' }),
      },
      ingredientAlias: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new IngredientAliasesService(prisma);

    await expect(service.create('ingredient-id', { alias: 'Aqua' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('reports a stable error when an alias cannot be removed', async () => {
    const prisma = {
      ingredientAlias: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    } as unknown as PrismaService;
    const service = new IngredientAliasesService(prisma);

    await expect(service.remove('missing-alias')).rejects.toBeInstanceOf(NotFoundException);
  });
});
