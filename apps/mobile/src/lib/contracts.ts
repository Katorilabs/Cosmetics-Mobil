import { z } from 'zod';

const image = z.object({ url: z.string(), altText: z.string().nullable().optional() });
const taxonomy = z.object({ id: z.uuid(), name: z.string() });
export const productCardSchema = z.object({
  id: z.uuid(), name: z.string(), slug: z.string(), brand: taxonomy, category: taxonomy,
  variants: z.array(z.object({ id: z.uuid(), name: z.string(), images: z.array(image) })),
});
const ingredient = z.object({
  inciName: z.string(), commonNames: z.array(z.string()), functions: z.array(z.string()),
  description: z.string().nullable(),
});
export const productSchema = productCardSchema.extend({
  description: z.string().nullable(),
  variants: z.array(z.object({
    id: z.uuid(), name: z.string(), images: z.array(image),
    formulas: z.array(z.object({
      id: z.uuid(), version: z.number().int(), rawInci: z.string(),
      sourceName: z.string().nullable(), sourceUrl: z.string().nullable(),
      ingredients: z.array(z.object({
        position: z.number().int(), rawName: z.string(), isUncertain: z.boolean(), ingredient: ingredient.nullable(),
      })),
    })),
  })),
});
const meta = z.object({ page: z.number().int(), limit: z.number().int(), total: z.number().int(), pageCount: z.number().int() });
export const productsSchema = z.object({ data: z.array(productCardSchema), meta });
export const reviewsSchema = z.object({
  data: z.array(z.object({
    id: z.uuid(), rating: z.number().int().min(1).max(5), title: z.string().nullable(),
    body: z.string().nullable(), createdAt: z.string(),
  })), meta,
});
export const statisticsSchema = z.object({
  count: z.number().int().nonnegative(), averageRating: z.number().min(1).max(5).nullable(),
  distribution: z.array(z.object({ rating: z.number().int().min(1).max(5), count: z.number().int().nonnegative() })).nullable(),
});
export type ProductCard = z.infer<typeof productCardSchema>;
export type Product = z.infer<typeof productSchema>;
