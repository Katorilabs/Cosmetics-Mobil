import { NotFoundException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { SkinConcern, SkinType } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../database/prisma.service.js';
import { ProfilesService } from './profiles.service.js';

describe('ProfilesService', () => {
  it('normalizes user-entered values before upserting', async () => {
    const upsert = jest.fn().mockImplementation(({ create }) => create);
    const service = new ProfilesService({
      skinProfile: { upsert },
    } as unknown as PrismaService);

    const result = await service.upsert('user-id', {
      skinType: SkinType.COMBINATION,
      concerns: [SkinConcern.ACNE, SkinConcern.LARGE_PORES],
      allergies: [' Fragrance ', 'Latex'],
      avoidInci: [' parfum ', 'alcohol   denat.'],
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      update: {
        skinType: SkinType.COMBINATION,
        concerns: [SkinConcern.ACNE, SkinConcern.LARGE_PORES],
        allergies: ['Fragrance', 'Latex'],
        avoidInci: ['PARFUM', 'ALCOHOL DENAT.'],
      },
      create: {
        userId: 'user-id',
        skinType: SkinType.COMBINATION,
        concerns: [SkinConcern.ACNE, SkinConcern.LARGE_PORES],
        allergies: ['Fragrance', 'Latex'],
        avoidInci: ['PARFUM', 'ALCOHOL DENAT.'],
      },
    });
    expect(result).toMatchObject({ userId: 'user-id', skinType: SkinType.COMBINATION });
  });

  it('returns an application error when the profile does not exist', async () => {
    const service = new ProfilesService({
      skinProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(service.get('missing-user')).rejects.toMatchObject<NotFoundException>({
      status: 404,
    });
  });

  it('allows profile deletion to be safely repeated', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const service = new ProfilesService({
      skinProfile: { deleteMany },
    } as unknown as PrismaService);

    await expect(service.remove('user-id')).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-id' } });
  });
});
