import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { EvidenceEffect, EvidenceLevel } from '../../../generated/prisma/enums.js';

export enum EvidenceState {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

export class ListEvidenceQuery {
  @ApiPropertyOptional({ description: 'Search title, summary, source name or URL' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ingredientId?: string;

  @ApiPropertyOptional({ enum: EvidenceState })
  @IsOptional()
  @IsEnum(EvidenceState)
  state?: EvidenceState;

  @ApiPropertyOptional({ enum: EvidenceLevel })
  @IsOptional()
  @IsEnum(EvidenceLevel)
  level?: EvidenceLevel;

  @ApiPropertyOptional({ enum: EvidenceEffect })
  @IsOptional()
  @IsEnum(EvidenceEffect)
  effect?: EvidenceEffect;
}
