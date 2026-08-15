import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OidcTokenVerifier } from './oidc-token.verifier.js';

describe('OidcTokenVerifier', () => {
  it('fails closed when OIDC is not configured', async () => {
    const verifier = new OidcTokenVerifier({
      getOrThrow: () => ({ configured: false, algorithms: ['RS256'] }),
    } as unknown as ConfigService);

    await expect(verifier.verify('untrusted-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
