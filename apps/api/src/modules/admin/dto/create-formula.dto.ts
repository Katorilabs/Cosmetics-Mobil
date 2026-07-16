import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class FormulaIngredientDto {
  @ApiProperty({ example: 'NIACINAMIDE' })
  @IsString()
  @Length(2, 200)
  inciName!: string;

  @ApiPropertyOptional({ example: 'Niacinamide' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  rawName?: string;

  @ApiPropertyOptional({ type: [String], example: ['B3 Vitamini'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonNames?: string[];

  @ApiPropertyOptional({ type: [String], example: ['skin conditioning'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  functions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateFormulaDto {
  @ApiProperty({ example: 'AQUA, NIACINAMIDE, GLYCERIN' })
  @IsString()
  @Length(3, 20_000)
  rawInci!: string;

  @ApiPropertyOptional({ example: 'Demo manufacturer feed' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  sourceName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/product' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  sourceUrl?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  confidence = 0;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive = true;

  @ApiProperty({ type: [FormulaIngredientDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormulaIngredientDto)
  ingredients!: FormulaIngredientDto[];
}
