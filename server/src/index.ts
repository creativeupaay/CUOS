import express from "express";
import http from "http";
import dotenv from "dotenv";
import morgan from "morgan";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import path from "path";
import { env } from "./config/env.config";
import connectDB from "./config/db.config";
import v1Routes from "./routes/v1/index";
import errorHandlerMiddleware from "./middlewares/errorHandler";
import notFoundMiddleware from "./middlewares/notFound";
import cookieParser from "cookie-parser";
import { initializeSocket } from "./config/socket.config";
import otService from "./modules/collaboration/services/otService";

// Register models
import "./modules/auth/models/Permission.model";

dotenv.config();

connectDB();

const app = express();

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Configure helmet with exceptions for webhook
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for now
  })
);

// CORS configuration
const allowedOrigins: string[] = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

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
  app.use(express.static(buildPath));

  app.get("*", (req, res) => {
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

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready for real-time collaboration`);
});

// Graceful shutdown - save all notes before exit
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, saving all notes...');
  await otService.saveAllNotes();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, saving all notes...');
  await otService.saveAllNotes();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

