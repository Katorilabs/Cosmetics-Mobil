import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ProductStatus } from '../../../generated/prisma/enums.js';
import { CreateFormulaDto } from './create-formula.dto.js';

export class ProductImageDto {
  @ApiProperty({ example: 'https://images.example.com/product.jpg' })
  @IsUrl({ require_protocol: true })
  url!: string;

  @ApiPropertyOptional({ example: 'Demo nemlendirici ürün görseli' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  altText?: string;
}

export class CreateVariantDto {
  @ApiProperty({ example: '50 ml' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional({ example: '50.00' })
  @IsOptional()
  @Matches(/^\d{1,6}(\.\d{1,2})?$/)
  sizeValue?: string;

  @ApiPropertyOptional({ example: 'ml' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  sizeUnit?: string;

  @ApiPropertyOptional({ example: '8690000000001' })
  @IsOptional()
  @Matches(/^\d{8,14}$/)
  barcode?: string;

  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images: ProductImageDto[] = [];

  @ApiProperty({ type: CreateFormulaDto })
  @ValidateNested()
  @Type(() => CreateFormulaDto)
  formula!: CreateFormulaDto;
}

export class CreateProductDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  brandId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Daily Balance Moisturizer' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 5_000)
  description?: string;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProductStatus)
  status: ProductStatus = ProductStatus.DRAFT;

  @ApiProperty({ type: CreateVariantDto })
  @ValidateNested()
  @Type(() => CreateVariantDto)
  variant!: CreateVariantDto;
}
