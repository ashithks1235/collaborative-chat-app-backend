const express = require("express");
const http = require("http");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

require("dotenv").config();
require("./config/env.validation");

const { connectDB } = require("./config/db");
const { initSocket } = require("./socket");
const router = require("./routes/router");
const taskReminderCron = require("./utils/taskReminderCron");
const multer = require("multer");
const errorHandler = require("./middleware/error.middleware");

const app = express();
const server = http.createServer(app);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  if (err.message === "Unsupported file type") {
    return res.status(400).json({
      success: false,
      message: "Invalid file type"
    });
  }

  next(err);
});

/* ================= SECURITY CONFIG ================= */

// If running behind proxy (nginx, render, etc.)
app.set("trust proxy", 1);

const corsOptions = {
  origin: [process.env.CLIENT_URL || "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

/* ================= SECURITY MIDDLEWARE ================= */

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
  })
);

// CORS MUST come early
app.use(cors(corsOptions));

app.use(express.json({ limit: "10mb" }));

/* ================= RATE LIMIT ================= */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,

  // Prevent preflight failures
  skip: (req) => req.method === "OPTIONS",

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later."
    });
  }
});

app.use("/api", apiLimiter);

/* ================= ROUTES ================= */

app.use("/api", router);

app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    }
  })
);

app.get("/", (req, res) => {
  res.status(200).send(`<h1>Server started... waiting for client request</h1>`);
});

/* ================= ERROR HANDLER ================= */

app.use(errorHandler);

/* ================= GLOBAL PROCESS HANDLERS ================= */

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

/* ================= START SERVER ================= */

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Database connected");

    const io = initSocket(server);
    app.set("io", io);

    taskReminderCron(io);

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();