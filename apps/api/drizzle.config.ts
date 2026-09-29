import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://intake:intake@localhost:5432/intake',
  },
  // Review every migration before it runs — see ADR 002.
  verbose: true,
  strict: true,
});
