import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-user.js';
import { AuthTokenVerifier } from './auth-token.verifier.js';
import { IdentityService } from './identity.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly verifier: AuthTokenVerifier,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const token = this.readBearerToken(authorization);
    const verifiedIdentity = await this.verifier.verify(token);
    request.user = await this.identity.synchronize(verifiedIdentity);
    return true;
  }

  private readBearerToken(authorization: string | undefined): string {
    if (!authorization) {
      throw this.authenticationRequired();
    }

    const match = /^Bearer ([^\s]+)$/i.exec(authorization.trim());
    if (!match?.[1] || match[1].length > 10_000) {
      throw this.authenticationRequired();
    }

    return match[1];
  }

  private authenticationRequired(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_REQUIRED',
      message: 'A Bearer access token is required',
    });
  }
}
