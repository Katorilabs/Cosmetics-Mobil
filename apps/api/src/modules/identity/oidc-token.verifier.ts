import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type RemoteJWKSet } from 'jose';
import { AuthTokenVerifier, type VerifiedIdentity } from './auth-token.verifier.js';

type AuthConfiguration = {
  issuer?: string;
  audience?: string;
  jwksUrl?: string;
  algorithms: string[];
  configured: boolean;
};

@Injectable()
export class OidcTokenVerifier extends AuthTokenVerifier {
  private remoteJwks?: RemoteJWKSet;

  constructor(private readonly config: ConfigService) {
    super();
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    const auth = this.config.getOrThrow<AuthConfiguration>('auth');

    if (!auth.configured || !auth.issuer || !auth.audience || !auth.jwksUrl) {
      throw new ServiceUnavailableException({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'Authentication is not configured',
      });
    }

    this.remoteJwks ??= createRemoteJWKSet(new URL(auth.jwksUrl), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
    });

    try {
      const { payload } = await jwtVerify(token, this.remoteJwks, {
        issuer: auth.issuer,
        audience: auth.audience,
        algorithms: auth.algorithms,
      });
      const subject = payload.sub?.trim();

      if (!subject || subject.length > 500) {
        throw new Error('Token subject is missing or invalid');
      }

      const email = payload.email_verified === true && typeof payload.email === 'string'
        ? payload.email.trim().toLowerCase()
        : undefined;
      const displayName = this.readDisplayName(payload);

      return {
        subject,
        ...(email && email.length <= 320 ? { email } : {}),
        ...(displayName ? { displayName } : {}),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;

      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Access token is invalid or expired',
      });
    }
  }

  private readDisplayName(payload: Record<string, unknown>): string | undefined {
    if (typeof payload.name === 'string') {
      const name = payload.name.trim();
      return name ? name.slice(0, 120) : undefined;
    }

    const parts = [payload.given_name, payload.family_name]
      .filter((part): part is string => typeof part === 'string')
      .map((part) => part.trim())
      .filter(Boolean);
    const name = parts.join(' ');
    return name ? name.slice(0, 120) : undefined;
  }
}
