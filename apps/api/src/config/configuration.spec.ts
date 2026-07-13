import { validateEnvironment } from './configuration.js';

describe('validateEnvironment', () => {
  it('applies safe development defaults', () => {
    const environment = validateEnvironment({
      DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
    });

    expect(environment.NODE_ENV).toBe('development');
    expect(environment.PORT).toBe(3000);
    expect(environment.API_RATE_LIMIT_LIMIT).toBe(100);
  });

  it('rejects an invalid port', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://cosmedia:cosmedia@localhost:5432/cosmedia',
        PORT: 70_000,
      }),
    ).toThrow('Invalid environment configuration');
  });
});
