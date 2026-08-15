import { z } from 'zod';

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.url().optional(),
);
const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
const allowedOidcAlgorithms = new Set([
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
]);

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CORS_ORIGINS: z.string().default('http://localhost:8081,http://localhost:19006'),
  API_RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  API_RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(100),
  ADMIN_API_KEY: z.string().min(32).optional(),
  AUTH_ISSUER: optionalUrl,
  AUTH_AUDIENCE: optionalString,
  AUTH_JWKS_URL: optionalUrl,
  AUTH_ALLOWED_ALGORITHMS: z.string().default('RS256'),
}).superRefine((environment, context) => {
  const authValues = [environment.AUTH_ISSUER, environment.AUTH_AUDIENCE, environment.AUTH_JWKS_URL];
  const configuredValues = authValues.filter(Boolean).length;

  if (configuredValues > 0 && configuredValues < authValues.length) {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_ISSUER'],
      message: 'AUTH_ISSUER, AUTH_AUDIENCE and AUTH_JWKS_URL must be configured together',
    });
  }

  if (environment.NODE_ENV === 'production' && configuredValues !== authValues.length) {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_ISSUER'],
      message: 'OIDC authentication configuration is required in production',
    });
  }

  if (environment.NODE_ENV === 'production' && environment.AUTH_JWKS_URL?.startsWith('http:')) {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_JWKS_URL'],
      message: 'AUTH_JWKS_URL must use HTTPS in production',
    });
  }

  const algorithms = environment.AUTH_ALLOWED_ALGORITHMS.split(',')
    .map((algorithm) => algorithm.trim().toUpperCase())
    .filter(Boolean);
  if (algorithms.length === 0 || algorithms.some((item) => !allowedOidcAlgorithms.has(item))) {
    context.addIssue({
      code: 'custom',
      path: ['AUTH_ALLOWED_ALGORITHMS'],
      message: 'AUTH_ALLOWED_ALGORITHMS contains an unsupported or symmetric algorithm',
    });
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(values: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}

export function configuration(): Record<string, unknown> {
  const env = validateEnvironment(process.env);
  const authAlgorithms = env.AUTH_ALLOWED_ALGORITHMS.split(',')
    .map((algorithm) => algorithm.trim().toUpperCase())
    .filter(Boolean);

  return {
    environment: env.NODE_ENV,
    http: {
      port: env.PORT,
      corsOrigins: env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
    database: {
      url: env.DATABASE_URL,
    },
    rateLimit: {
      ttlMs: env.API_RATE_LIMIT_TTL_MS,
      limit: env.API_RATE_LIMIT_LIMIT,
    },
    admin: {
      apiKey: env.ADMIN_API_KEY,
    },
    auth: {
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
      jwksUrl: env.AUTH_JWKS_URL,
      algorithms: [...new Set(authAlgorithms)],
      configured: Boolean(env.AUTH_ISSUER && env.AUTH_AUDIENCE && env.AUTH_JWKS_URL),
    },
  };
}
