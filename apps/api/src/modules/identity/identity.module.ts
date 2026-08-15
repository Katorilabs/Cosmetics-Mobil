import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { AuthTokenVerifier } from './auth-token.verifier.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { OidcTokenVerifier } from './oidc-token.verifier.js';

@Module({
  controllers: [IdentityController],
  providers: [
    AuthGuard,
    IdentityService,
    OidcTokenVerifier,
    { provide: AuthTokenVerifier, useExisting: OidcTokenVerifier },
  ],
  exports: [AuthGuard, AuthTokenVerifier, IdentityService],
})
export class IdentityModule {}
