import type { z } from 'zod';
import { productSchema, productsSchema, reviewsSchema, statisticsSchema } from './contracts';

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly requestId?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function resolveApiUrl(configured: string | undefined, platform: string, development: boolean): string {
  const value = configured?.trim() || (development
    ? `http://${platform === 'android' ? '10.0.2.2' : 'localhost'}:3000/api/v1`
    : '');
  let url: URL;
  try { url = new URL(value); } catch {
    throw new ApiError('Uygulamanın sunucu adresi ayarlanmamış.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ApiError('Uygulamanın sunucu adresi geçersiz.');
  }
  return value.replace(/\/+$/, '');
}

export function createApi(baseUrl: () => string, transport: typeof fetch = fetch, timeoutMs = 12000) {
  async function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const response = await transport(`${baseUrl()}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new ApiError(response.status === 404 ? 'Bu içerik artık yayında değil.'
          : response.status === 429 ? 'Çok sık istek gönderildi. Biraz sonra tekrar deneyin.'
          : 'Sunucuya şu anda ulaşılamıyor. Lütfen tekrar deneyin.', response.status,
        response.headers.get('x-request-id') ?? undefined);
      }
      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) throw new ApiError('Sunucudan beklenmeyen bir yanıt geldi. Lütfen tekrar deneyin.');
      return parsed.data;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof ApiError) throw error;
      throw new ApiError(timedOut ? 'Bağlantı zaman aşımına uğradı. Tekrar deneyin.' : 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
  return {
    products: (search: string, page: number, signal?: AbortSignal) => {
      const query = new URLSearchParams({ page: String(page), limit: '12' });
      if (search.trim()) query.set('search', search.trim());
      return get(`/products?${query}`, productsSchema, signal);
    },
    product: (id: string, signal?: AbortSignal) => get(`/products/${encodeURIComponent(id)}`, productSchema, signal),
    reviews: (id: string, page: number, signal?: AbortSignal) => get(`/variants/${encodeURIComponent(id)}/reviews?page=${page}&limit=5`, reviewsSchema, signal),
    statistics: (id: string, signal?: AbortSignal) => get(`/variants/${encodeURIComponent(id)}/review-statistics`, statisticsSchema, signal),
  };
}
