import dotenv from "dotenv";
import { z } from "zod";

import { logger } from "../utils/logger";

dotenv.config();

const parseOriginList = (value: unknown): string[] | undefined => {
  if (typeof value !== "string") return value as string[] | undefined;

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins;
};

/**
 * Zod schema for environment variables validation
 * All required environment variables must be defined here
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["staging", "production", "development"])
    .default("development"),
  PORT: z.string().default("8000").transform(Number),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  JWT_ACCESS_EXPIRY: z.string().default("8h"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  FRONTEND_URL: z
    .string()
    .url("FRONTEND_URL must be a valid URL")
    .default("http://localhost:5173"),
  FRONTEND_URLS: z.preprocess(
    parseOriginList,
    z.array(z.string().url("FRONTEND_URLS must contain valid URLs")).default([])
  ),

  // Resend email service — used for client onboarding forms & admin notifications
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("noreply@creativeupaay.com"),

  // Cal.com booking page used in interview invite emails
  CALCOM_BOOKING_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  CALCOM_FALLBACK_BOOKING_URL_TEMPLATE: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional()
  ),
  CALCOM_API_BASE_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().default("https://api.cal.com")
  ),
  CALCOM_API_TOKEN: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional()
  ),
  CALCOM_API_VERSION: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().default("2024-06-14")
  ),
  CALCOM_DEFAULT_ORGANIZER: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().default("HR Team")
  ),
  CALCOM_EVENT_LOCATION_INTEGRATION: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().default("google-meet")
  ),
  CALCOM_WEBHOOK_SECRET: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().optional()
  ),

});

/**
 * Validate environment variables
 * This will crash the application if any required variable is missing or invalid
 */
function validateEnv() {
  try {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      logger.error("Invalid or missing environment variables:\n");
      parsed.error.issues.forEach((issue) => {
        logger.error(`  ❌ ${issue.path.join(".")}: ${issue.message}`);
      });

      logger.error(
        "\n⚠️  Please check your .env file and ensure all required variables are set correctly.\n"
      );
      process.exit(1);
    }

    return parsed.data;
  } catch (error) {
    logger.error("\n❌ ENVIRONMENT CONFIGURATION ERROR\n");
    logger.error(error);
    process.exit(1);
  }
}

/**
 * Validated and typed environment configuration
 * Import this instead of using process.env directly
 */
export const env = validateEnv();

/**
 * Type-safe environment configuration object
 */
export type Env = z.infer<typeof envSchema>;

// Log successful validation in development
if (env.NODE_ENV === "development") {
  logger.info("✓ Environment variables validated successfully");
}
