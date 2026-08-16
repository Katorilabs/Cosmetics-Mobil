import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateIngredientAliasDto {
  @ApiProperty({ example: 'Vitamin B3' })
  @IsString()
  @Length(2, 200)
  alias!: string;

  @ApiPropertyOptional({ example: 'CosIng manual review' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  sourceName?: string;
}
