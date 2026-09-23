import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListScoreRulesQuery {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}
