import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { AuthenticatedRequest, AuthenticatedUser } from './authenticated-user.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthTokenVerifier, VerifiedIdentity } from './auth-token.verifier.js';
import type { IdentityService } from './identity.service.js';

describe('AuthGuard', () => {
  const verifiedIdentity: VerifiedIdentity = {
    subject: 'identity-user-1',
    email: 'user@example.com',
  };
  const applicationUser: AuthenticatedUser = {
    id: '1be9c619-2928-4cb7-b5f2-b6b989a61ee4',
    externalAuthId: verifiedIdentity.subject,
    email: verifiedIdentity.email!,
    displayName: null,
  };

  function contextWithAuthorization(authorization?: string): {
    context: ExecutionContext;
    request: AuthenticatedRequest;
  } {
    const request: AuthenticatedRequest = {
      header: (name) => (name === 'authorization' ? authorization : undefined),
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { context, request };
  }

  it('verifies the Bearer token and attaches the synchronized user', async () => {
    const verifier = { verify: jest.fn().mockResolvedValue(verifiedIdentity) };
    const identity = { synchronize: jest.fn().mockResolvedValue(applicationUser) };
    const guard = new AuthGuard(
      verifier as unknown as AuthTokenVerifier,
      identity as unknown as IdentityService,
    );
    const { context, request } = contextWithAuthorization('Bearer signed-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith('signed-token');
    expect(identity.synchronize).toHaveBeenCalledWith(verifiedIdentity);
    expect(request.user).toEqual(applicationUser);
  });

  it.each([undefined, '', 'Basic value', 'Bearer', 'Bearer token with-spaces'])(
    'rejects a missing or malformed Authorization header: %s',
    async (authorization) => {
      const verifier = { verify: jest.fn() };
      const guard = new AuthGuard(
        verifier as unknown as AuthTokenVerifier,
        { synchronize: jest.fn() } as unknown as IdentityService,
      );
      const { context } = contextWithAuthorization(authorization);

      await expect(guard.canActivate(context)).rejects.toMatchObject<UnauthorizedException>({
        status: 401,
      });
      expect(verifier.verify).not.toHaveBeenCalled();
    },
  );
});
