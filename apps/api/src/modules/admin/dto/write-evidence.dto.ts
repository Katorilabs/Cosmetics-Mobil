import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsDateString, IsEnum, IsInt, IsString, IsUrl, Length, Min, ValidateIf } from 'class-validator';
import { EvidenceEffect, EvidenceLevel, SkinConcern, SkinType } from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class WriteEvidenceDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 300)
  title!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(10, 10000)
  summary!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 200)
  sourceName!: string;

  @ApiProperty({ description: 'Citation URL; stored only, never fetched by the API' })
  @Transform(trim)
  @Length(1, 2000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, disallow_auth: true })
  sourceUrl!: string;

  @ApiProperty({ enum: EvidenceLevel })
  @IsEnum(EvidenceLevel)
  level!: EvidenceLevel;

  @ApiProperty({ enum: EvidenceEffect })
  @IsEnum(EvidenceEffect)
  effect!: EvidenceEffect;

  @ApiProperty({ enum: SkinType, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(5)
  @IsEnum(SkinType, { each: true })
  skinTypes!: SkinType[];

  @ApiProperty({ enum: SkinConcern, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsEnum(SkinConcern, { each: true })
  concerns!: SkinConcern[];

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDateString({ strict: true })
  publishedAt?: string | null;
}

export class EvidenceRevisionDto {
  @ApiProperty({ minimum: 1, description: 'Revision read before editing or moderation' })
  @IsInt()
  @Min(1)
  revision!: number;
}

export class ReplaceEvidenceDto extends WriteEvidenceDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;
}
