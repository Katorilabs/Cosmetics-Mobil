import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthenticatedUser } from './authenticated-user.js';
import type { VerifiedIdentity } from './auth-token.verifier.js';
import type { UpdateMeDto } from './dto/update-me.dto.js';

const userSelection = {
  id: true,
  externalAuthId: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async synchronize(identity: VerifiedIdentity): Promise<AuthenticatedUser> {
    const existing = await this.prisma.user.findUnique({
      where: { externalAuthId: identity.subject },
      select: userSelection,
    });

    try {
      if (!existing) {
        return await this.prisma.user.create({
          data: {
            externalAuthId: identity.subject,
            email: identity.email,
            displayName: identity.displayName,
          },
          select: userSelection,
        });
      }

      const emailChanged = identity.email !== undefined && identity.email !== existing.email;
      if (!emailChanged) return existing;

      return await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email: identity.email,
        },
        select: userSelection,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        if (!existing) {
          const concurrentlyCreated = await this.prisma.user.findUnique({
            where: { externalAuthId: identity.subject },
            select: userSelection,
          });
          if (concurrentlyCreated) return concurrentlyCreated;
        }

        throw new ConflictException({
          code: 'AUTH_IDENTITY_CONFLICT',
          message: 'This identity cannot be linked to the current account',
        });
      }
      throw error;
    }
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelection,
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return user;
  }

  async update(id: string, input: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName?.trim() || null }),
      },
      select: userSelection,
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'P2002';
  }
}
