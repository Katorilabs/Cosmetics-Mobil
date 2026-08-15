import { validateEnvironment } from './configuration.js';

describe('validateEnvironment', () => {
  it('applies safe development defaults', () => {
    const environment = validateEnvironment({
      DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
    });

    expect(environment.NODE_ENV).toBe('development');
    expect(environment.PORT).toBe(3000);
    expect(environment.API_RATE_LIMIT_LIMIT).toBe(100);
    expect(environment.AUTH_ALLOWED_ALGORITHMS).toBe('RS256');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
        PORT: 70_000,
      }),
    ).toThrow('Invalid environment configuration');
  });

  it('requires all OIDC values when one is configured', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
        AUTH_ISSUER: 'https://identity.example.com',
      }),
    ).toThrow('AUTH_ISSUER, AUTH_AUDIENCE and AUTH_JWKS_URL must be configured together');
  });

  it('requires OIDC configuration and HTTPS JWKS in production', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
      }),
    ).toThrow('OIDC authentication configuration is required in production');

    expect(() =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
        AUTH_ISSUER: 'https://identity.example.com',
        AUTH_AUDIENCE: 'cosmedia-api',
        AUTH_JWKS_URL: 'http://identity.example.com/.well-known/jwks.json',
      }),
    ).toThrow('AUTH_JWKS_URL must use HTTPS in production');
  });

  it('rejects symmetric or unsupported token algorithms', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
        AUTH_ALLOWED_ALGORITHMS: 'RS256,HS256',
      }),
    ).toThrow('AUTH_ALLOWED_ALGORITHMS contains an unsupported or symmetric algorithm');
  });
});
