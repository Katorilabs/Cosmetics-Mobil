import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SkinConcern, SkinType } from '../../../generated/prisma/enums.js';

export class UpsertSkinProfileDto {
  @ApiProperty({ enum: SkinType })
  @IsEnum(SkinType)
  skinType: SkinType;

  @ApiProperty({ enum: SkinConcern, isArray: true, example: ['ACNE', 'LARGE_PORES'] })
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsEnum(SkinConcern, { each: true })
  concerns: SkinConcern[];

  @ApiProperty({ type: [String], example: ['Fragrance'] })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((value: unknown) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(120, { each: true })
  allergies: string[];

  @ApiProperty({ type: [String], example: ['PARFUM', 'ALCOHOL DENAT.'] })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((value: unknown) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(200, { each: true })
  avoidInci: string[];
}
