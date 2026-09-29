import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';
import { ReviewStatus } from '../../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class ReviewPageQuery {
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
}

export class WriteReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Plain text, never HTML' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  title?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Plain text, never HTML' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  body?: string | null;
}

export class ReplaceReviewDto extends WriteReviewDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;
}

export class ModerateReviewDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status!: ReviewStatus;
}

export class AdminReviewsQuery extends ReviewPageQuery {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantId?: string;
}

export enum ReportReason { SPAM = 'SPAM', OFFENSIVE = 'OFFENSIVE', MISLEADING = 'MISLEADING', OTHER = 'OTHER' }

export class ReportReviewDto {
  @ApiProperty({ minimum: 1, description: 'Revision displayed in the public review' })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason!: ReportReason;
}

export enum ReportState { OPEN = 'OPEN', RESOLVED = 'RESOLVED' }

export class ListReportsQuery extends ReviewPageQuery {
  @ApiPropertyOptional({ enum: ReportState, default: ReportState.OPEN })
  @IsEnum(ReportState)
  state: ReportState = ReportState.OPEN;
}
