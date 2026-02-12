import dotenv from "dotenv";
import { z } from "zod";
import path from "path";

dotenv.config();

/**
 * Zod schema for environment variables validation
 * All required environment variables must be defined here
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["staging", "production", "development"])
    .default("development"),
  PORT: z.string().transform(Number).default(8000),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

  FRONTEND_URL: z
    .string()
    .url("FRONTEND_URL must be a valid URL")
    .default("http://localhost:5173"),

});

/**
 * Validate environment variables
 * This will crash the application if any required variable is missing or invalid
 */
function validateEnv() {
  try {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      console.error("Invalid or missing environment variables:\n");
      parsed.error.issues.forEach((issue) => {
        console.error(`  ❌ ${issue.path.join(".")}: ${issue.message}`);
      });

      console.error(
        "\n⚠️  Please check your .env file and ensure all required variables are set correctly.\n"
      );
      process.exit(1);
    }

    return parsed.data;
  } catch (error) {
    console.error("\n❌ ENVIRONMENT CONFIGURATION ERROR\n");
    console.error(error);
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
  console.log("✓ Environment variables validated successfully");
}
