import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminKeyGuard } from './admin-key.guard.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { CreateFormulaDto } from './dto/create-formula.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@ApiTags('admin/catalog')
@ApiSecurity('admin-key')
@UseGuards(AdminKeyGuard)
@Controller({ path: 'admin/catalog', version: '1' })
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogAdminService) {}

  @Get('brands')
  @ApiOperation({ summary: 'List catalogue brands' })
  listBrands() {
    return this.catalog.listBrands();
  }

  @Post('brands')
  @ApiOperation({ summary: 'Create a catalogue brand' })
  createBrand(@Body() input: CreateBrandDto) {
    return this.catalog.createBrand(input);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List catalogue categories' })
  listCategories() {
    return this.catalog.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a catalogue category' })
  createCategory(@Body() input: CreateCategoryDto) {
    return this.catalog.createCategory(input);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product, first variant and first formula atomically' })
  createProduct(@Body() input: CreateProductDto) {
    return this.catalog.createProduct(input);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update catalogue product metadata or publication status' })
  updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(id, input);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Archive a product without deleting its history' })
  archiveProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.archiveProduct(id);
  }

  @Post('variants/:variantId/formulas')
  @ApiOperation({ summary: 'Add a new versioned INCI formula to a product variant' })
  addFormula(
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() input: CreateFormulaDto,
  ) {
    return this.catalog.addFormula(variantId, input);
  }
}
