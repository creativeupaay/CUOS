import express from "express";
import http from "http";
import dotenv from "dotenv";
import compression from "compression";
import pinoHttp from "pino-http";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import path from "path";
import { env } from "./config/env.config";
import connectDB from "./config/db.config";
import { logger } from "./utils/logger";
import v1Routes from "./routes/v1/index";
import errorHandlerMiddleware from "./middlewares/errorHandler";
import notFoundMiddleware from "./middlewares/notFound";
import cookieParser from "cookie-parser";
import { initializeSocket } from "./config/socket.config";
import otService from "./modules/collaboration/services/otService";
import { initAttendanceReminderJob } from "./modules/notification/jobs/attendanceReminder.job";
import { initBirthdayNotificationJob } from "./modules/notification/jobs/birthdayNotification.job";

// Register models
import "./modules/auth/models/Permission.model";

dotenv.config();
connectDB();

const app = express();

app.use(pinoHttp({ logger }));

// Configure helmet with exceptions for webhook
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for now
  })
);

// CORS configuration
const allowedOrigins: string[] = Array.from(new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  env.FRONTEND_URL,
  ...env.FRONTEND_URLS,
]));

const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // Allow all subdomains of creativeupaay.in for deployed environments.
  return /^https?:\/\/([a-z0-9-]+\.)*creativeupaay\.in$/i.test(origin);
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Gzip compress all responses > 1 KB — typically 70-80% size reduction on JSON
app.use(compression());

app.use(cookieParser());
// Apply express.json() to all other routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Backward-compatible aliases for Cal.com webhook URL configuration.
app.use((req, _res, next) => {
  if (req.path === '/hiring/interview/calcom/webhook') {
    req.url = `/api/v1${req.url}`;
  } else if (req.path === '/api/hiring/interview/calcom/webhook') {
    req.url = req.url.replace(/^\/api\//, '/api/v1/');
  }
  next();
});

app.use("/api/v1", v1Routes);

// Serve local fallback uploads directory publicly
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

if (env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "..", "..", "client", "dist");

  // Serve static assets with long-term caching.
  // Vite fingerprints all JS/CSS filenames, so they can safely be cached forever.
  // Only HTML must be no-cache so the browser always fetches the latest index.html.
  app.use(
    express.static(buildPath, {
      maxAge: "1y",
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );

  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(buildPath, "index.html"));
  });
}

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const args = process.argv.slice(2);
const portArgIndex = args.indexOf("--port");
const PORT =
  portArgIndex !== -1
    ? Number(args[portArgIndex + 1])
    : env.PORT;

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Initialize scheduled jobs
initAttendanceReminderJob();
initBirthdayNotificationJob();

// Start server
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Socket.io ready for real-time collaboration`);
});

// Graceful shutdown - close ports early, save files safely, then exit
const gracefulShutdown = async (signal: string) => {
  logger.info(`\n${signal} received, tearing down server connections...`);
  
  // Release the port listener immediately so rapid nodemon restarts do not crash with EADDRINUSE
  httpServer.close();
  if (io) io.close();

  try {
    logger.info('Saving all pending OT blocks to database...');
    await otService.saveAllNotes();
    logger.info('Shutdown saving complete.');
  } catch (err) {
    logger.error({ err }, 'Error during shutdown note saving');
  } finally {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon explicit handling

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Rejection');
  gracefulShutdown('unhandledRejection');
});
