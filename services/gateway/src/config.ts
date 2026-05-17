import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Meta webhook credentials
  META_APP_SECRET: z.string().min(1, 'META_APP_SECRET is required'),
  META_VERIFY_TOKEN: z.string().min(1, 'META_VERIFY_TOKEN is required'),

  // Infrastructure URLs
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
  POSTGRES_URL: z.string().url('POSTGRES_URL must be a valid URL'),

  // Tunables
  TENANT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  STREAM_MAXLEN_APPROX: z.coerce.number().int().positive().default(10000),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Loads and validates typed configuration from environment variables.
 * Throws a ZodError with field-level messages if any required variable
 * is missing or malformed.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration error:\n${formatted}`);
  }
  return result.data;
}
