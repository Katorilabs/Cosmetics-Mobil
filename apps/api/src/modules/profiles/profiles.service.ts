import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { UpsertSkinProfileDto } from './dto/upsert-skin-profile.dto.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const profile = await this.prisma.skinProfile.findUnique({ where: { userId } });

    if (!profile) {
      throw new NotFoundException({
        code: 'SKIN_PROFILE_NOT_FOUND',
        message: 'Skin profile not found',
      });
    }

    return profile;
  }

  async upsert(userId: string, input: UpsertSkinProfileDto) {
    const data = {
      skinType: input.skinType,
      concerns: input.concerns,
      allergies: this.normalize(input.allergies),
      avoidInci: this.normalize(input.avoidInci, true),
    };

    return this.prisma.skinProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.skinProfile.deleteMany({ where: { userId } });
  }

  private normalize(values: string[], uppercase = false): string[] {
    const unique = new Map<string, string>();

    for (const rawValue of values) {
      const value = rawValue.trim().replace(/\s+/g, ' ');
      if (!value) continue;
      const normalized = uppercase ? value.toUpperCase() : value;
      unique.set(normalized.toLocaleUpperCase('en-US'), normalized);
    }

    return [...unique.values()];
  }
}
