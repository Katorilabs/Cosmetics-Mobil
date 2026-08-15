import { ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaService } from '../../database/prisma.service.js';
import { IdentityService } from './identity.service.js';

const existingUser = {
  id: '1be9c619-2928-4cb7-b5f2-b6b989a61ee4',
  externalAuthId: 'identity-user-1',
  email: 'user@example.com',
  displayName: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('IdentityService', () => {
  it('does not overwrite an application display-name choice from later token claims', async () => {
    const update = jest.fn();
    const service = new IdentityService({
      user: {
        findUnique: jest.fn().mockResolvedValue(existingUser),
        update,
      },
    } as unknown as PrismaService);

    await expect(service.synchronize({
      subject: existingUser.externalAuthId,
      email: existingUser.email!,
      displayName: 'Provider Name',
    })).resolves.toEqual(existingUser);
    expect(update).not.toHaveBeenCalled();
  });

  it('recovers idempotently when concurrent requests create the same subject', async () => {
    const findUnique = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser);
    const service = new IdentityService({
      user: {
        findUnique,
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    } as unknown as PrismaService);

    await expect(service.synchronize({
      subject: existingUser.externalAuthId,
      email: existingUser.email!,
    })).resolves.toEqual(existingUser);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects a unique email collision with a different identity', async () => {
    const service = new IdentityService({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    } as unknown as PrismaService);

    await expect(service.synchronize({
      subject: 'different-subject',
      email: existingUser.email!,
    })).rejects.toBeInstanceOf(ConflictException);
  });
});
