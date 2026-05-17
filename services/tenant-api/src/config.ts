import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_MIGRATION_URL: z.string().min(1, 'DATABASE_MIGRATION_URL is required'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Encryption
  MASTER_KEY: z
    .string()
    .min(32, 'MASTER_KEY must be at least 32 bytes (hex-encoded or raw)')
    .refine(
      (v) => Buffer.from(v, 'utf8').length >= 32,
      'MASTER_KEY must encode to at least 32 bytes',
    ),

  // MinIO / S3
  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT is required'),
  S3_PORT: z.coerce.number().int().positive().default(9000),
  S3_USE_SSL: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  S3_BUCKET_KB: z.string().min(1, 'S3_BUCKET_KB is required'),

  // Flow Engine
  FLOW_ENGINE_ADMIN_URL: z.string().url('FLOW_ENGINE_ADMIN_URL must be a valid URL'),
  INTERNAL_API_TOKEN: z.string().min(1, 'INTERNAL_API_TOKEN is required'),

  // KB limits
  KB_MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(10),
  KB_MAX_DOCUMENTS_PER_TENANT: z.coerce.number().int().positive().default(100),

  // Dry-run timeout
  DRY_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export type Config = z.infer<typeof configSchema>;

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
