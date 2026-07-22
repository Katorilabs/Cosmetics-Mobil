import { BadRequestException } from '@nestjs/common';
import { buildApiError } from './http-exception.filter.js';

describe('buildApiError', () => {
  it('preserves an application error code and details', () => {
    const result = buildApiError(
      new BadRequestException({
        code: 'CSV_ROWS_INVALID',
        message: 'One or more CSV rows are invalid',
        details: { rows: [{ row: 2 }] },
      }),
      '/api/v1/admin/catalog/imports/products',
      'request-1',
      '2026-07-19T00:00:00.000Z',
    );

    expect(result).toEqual({
      status: 400,
      body: {
        error: {
          code: 'CSV_ROWS_INVALID',
          message: 'One or more CSV rows are invalid',
          status: 400,
          details: { rows: [{ row: 2 }] },
          path: '/api/v1/admin/catalog/imports/products',
          timestamp: '2026-07-19T00:00:00.000Z',
          requestId: 'request-1',
        },
      },
    });
  });

  it('does not expose internal exception messages', () => {
    const result = buildApiError(
      new Error('database password leaked here'),
      '/api/v1/products',
      'request-2',
      '2026-07-19T00:00:00.000Z',
    );

    expect(result.status).toBe(500);
    expect(result.body.error.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(result)).not.toContain('database password');
  });
});
