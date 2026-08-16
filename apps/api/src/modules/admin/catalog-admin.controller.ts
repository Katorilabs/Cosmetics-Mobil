import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IngredientAliasesService } from '../ingredients/ingredient-aliases.service.js';
import { CreateIngredientAliasDto } from '../ingredients/dto/create-ingredient-alias.dto.js';
import { ListIngredientsQuery } from '../ingredients/dto/list-ingredients.query.js';
import { AdminKeyGuard } from './admin-key.guard.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CatalogCsvImportService } from './catalog-csv-import.service.js';
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
  constructor(
    private readonly catalog: CatalogAdminService,
    private readonly csvImport: CatalogCsvImportService,
    private readonly ingredientAliases: IngredientAliasesService,
  ) {}

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

  @Get('ingredients')
  @ApiOperation({ summary: 'List canonical ingredients with their reviewed aliases' })
  listIngredients(@Query() query: ListIngredientsQuery) {
    return this.ingredientAliases.list(query);
  }

  @Post('ingredients/:ingredientId/aliases')
  @ApiOperation({ summary: 'Create a reviewed alias for a canonical ingredient' })
  createIngredientAlias(
    @Param('ingredientId', ParseUUIDPipe) ingredientId: string,
    @Body() input: CreateIngredientAliasDto,
  ) {
    return this.ingredientAliases.create(ingredientId, input);
  }

  @Delete('ingredient-aliases/:aliasId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove an ingredient alias' })
  async removeIngredientAlias(@Param('aliasId', ParseUUIDPipe) aliasId: string): Promise<void> {
    await this.ingredientAliases.remove(aliasId);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a product, first variant and first formula atomically' })
  createProduct(@Body() input: CreateProductDto) {
    return this.catalog.createProduct(input);
  }

  @Post('imports/products')
  @ApiConsumes('text/csv', 'application/csv')
  @ApiBody({
    schema: {
      type: 'string',
      format: 'binary',
      description: 'UTF-8 CSV content using the documented Cosmedia columns',
    },
  })
  @ApiOperation({ summary: 'Import validated catalogue products from CSV atomically' })
  importProducts(@Body() csvContent: string) {
    return this.csvImport.importProducts(csvContent);
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
