import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListProductsQuery } from './dto/list-products.query.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List published products with pagination and filters' })
  list(@Query() query: ListProductsQuery) {
    return this.productsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a published product and its active INCI formula' })
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getById(id);
  }
}
