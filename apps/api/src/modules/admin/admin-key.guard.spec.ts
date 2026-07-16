import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard.js';

function contextWithKey(key?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header: () => key }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminKeyGuard', () => {
  const key = 'a-secure-development-key-with-32-chars';
  const guard = new AdminKeyGuard({ get: () => key } as unknown as ConfigService);

  it('accepts the configured key', () => {
    expect(guard.canActivate(contextWithKey(key))).toBe(true);
  });

  it('rejects a wrong key', () => {
    expect(() => guard.canActivate(contextWithKey('wrong-key'))).toThrow(UnauthorizedException);
  });
});
