import { validateEnv } from '../src/config/env';

describe('validateEnv', () => {
  const valid = {
    DATABASE_URL: 'postgresql://intake:intake@localhost:5432/intake',
  };

  it('applies defaults when optional variables are absent', () => {
    const env = validateEnv(valid);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_POOL_MAX).toBe(10);
  });

  it('coerces numeric variables from strings', () => {
    const env = validateEnv({ ...valid, PORT: '8080' });

    expect(env.PORT).toBe(8080);
    expect(typeof env.PORT).toBe('number');
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'localhost:5432' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('rejects a non-positive port', () => {
    expect(() => validateEnv({ ...valid, PORT: '0' })).toThrow(/PORT/);
  });
});
