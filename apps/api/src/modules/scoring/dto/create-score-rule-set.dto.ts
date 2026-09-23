import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateScoreRuleDto {
  @ApiProperty({ example: 'PROFILE_BENEFICIAL_EVIDENCE' })
  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Z][A-Z0-9_]*$/)
  code!: string;

  @ApiProperty({ example: 'Profile-relevant beneficial evidence' })
  @IsString()
  @Length(3, 200)
  name!: string;

  @ApiProperty()
  @IsString()
  @Length(3, 1_000)
  description!: string;

  @ApiProperty({ minimum: -100, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-100)
  @Max(100)
  weight!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  conditions!: Record<string, unknown>;
}

export class CreateScoreRuleSetDto {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  activate = false;

  @ApiProperty({ type: [CreateScoreRuleDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateScoreRuleDto)
  rules!: CreateScoreRuleDto[];
}
