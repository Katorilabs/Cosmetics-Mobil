import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { EvidenceState, type ListEvidenceQuery } from './dto/list-evidence.query.js';
import type { ReplaceEvidenceDto, WriteEvidenceDto } from './dto/write-evidence.dto.js';

@Injectable()
export class EvidenceAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEvidenceQuery) {
    const where: Prisma.IngredientEvidenceWhereInput = {
      ingredientId: query.ingredientId,
      level: query.level,
      effect: query.effect,
      ...(query.state ? { reviewedAt: query.state === EvidenceState.APPROVED ? { not: null } : null } : {}),
      ...(query.search ? { OR: ['title', 'summary', 'sourceName', 'sourceUrl'].map((field) => ({
        [field]: { contains: query.search, mode: 'insensitive' },
      })) } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.ingredientEvidence.findMany({
        where, skip: (query.page - 1) * query.limit, take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: { ingredient: { select: { id: true, inciName: true } } },
      }),
      this.prisma.ingredientEvidence.count({ where }),
    ]);
    return { data, meta: { page: query.page, limit: query.limit, total, pageCount: Math.ceil(total / query.limit) } };
  }

  async get(id: string) {
    const evidence = await this.prisma.ingredientEvidence.findUnique({ where: { id } });
    if (!evidence) throw this.notFound();
    return evidence;
  }

  async create(ingredientId: string, input: WriteEvidenceDto) {
    const ingredient = await this.prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { id: true } });
    if (!ingredient) throw new NotFoundException({ code: 'INGREDIENT_NOT_FOUND', message: 'Ingredient not found' });
    return this.prisma.ingredientEvidence.create({ data: { ingredientId, ...this.content(input), reviewedAt: null } });
  }

  replace(id: string, input: ReplaceEvidenceDto) {
    return this.change(id, input.revision, { ...this.content(input), reviewedAt: null });
  }

  review(id: string, revision: number, approved: boolean) {
    return this.change(id, revision, { reviewedAt: approved ? new Date() : null });
  }

  private content(input: WriteEvidenceDto) {
    return {
      title: input.title, summary: input.summary, sourceName: input.sourceName,
      sourceUrl: input.sourceUrl, level: input.level, effect: input.effect,
      skinTypes: [...input.skinTypes].sort(), concerns: [...input.concerns].sort(),
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    };
  }

  private async change(id: string, revision: number, data: Prisma.IngredientEvidenceUpdateInput) {
    try {
      // Compare and update in one SQL statement so stale moderation cannot approve edited content.
      return await this.prisma.ingredientEvidence.update({
        where: { id, revision }, data: { ...data, revision: { increment: 1 } },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2025') throw error;
      await this.get(id);
      throw new ConflictException({ code: 'EVIDENCE_REVISION_CONFLICT', message: 'Evidence changed; reload before editing or reviewing' });
    }
  }

  private notFound() {
    return new NotFoundException({ code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found' });
  }
}
