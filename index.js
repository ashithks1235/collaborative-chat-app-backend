const express = require("express");
const http = require("http");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

require("dotenv").config();
require("./config/env.validation"); // ✅ Validate ENV immediately

const { connectDB } = require("./config/db");
const { initSocket } = require("./socket");
const router = require("./routes/router");
const taskReminderCron = require("./utils/taskReminderCron");
const errorHandler = require("./middleware/error.middleware");

const app = express();
const server = http.createServer(app);

/* ================= SECURITY MIDDLEWARE ================= */

// Global API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 500,
  message: "Too many requests. Please try again later."
});

app.use("/api", apiLimiter);

app.use(helmet());

// CORS from ENV (not hardcoded)
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(express.json());

/* ================= ROUTES ================= */

app.use("/api", router);
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.status(200).send(`<h1>Server started... waiting for client request</h1>`);
});

// Global error handler must be LAST middleware
app.use(errorHandler);

/* ================= START SERVER FUNCTION ================= */

const startServer = async () => {
  try {
    // 1️⃣ Connect DB first
    await connectDB();
    console.log("✅ Database connected");

    // 2️⃣ Initialize Socket AFTER DB
    const io = initSocket(server);
    app.set("io", io);

    // 3️⃣ Start cron jobs AFTER socket ready
    taskReminderCron(io);

    // 4️⃣ Start server
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
