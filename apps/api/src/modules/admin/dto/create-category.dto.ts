import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Nemlendirici' })
  @IsString()
  @Length(2, 120)
  name!: string;
}
