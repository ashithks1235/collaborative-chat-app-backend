const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Channel = require("./models/channelModel");
const Project = require("./models/projectModel");
const Notification = require("./models/notificationModel");
const reminderChecker = require("./utils/reminderChecker");

let io;

async function emitAdminUpdate(type, payload = {}) {

  if (!io) return;

  try {

    if (payload.user && payload.channel && payload.entityId) {

      await Activity.create({
        user: payload.user,
        channel: payload.channel,
        type: type,
        entityId: payload.entityId,
        meta: payload.meta || {}
      });

    }

  } catch (err) {
    console.error("Activity log error:", err.message);
  }

  io.emit("admin:update", {
    type,
    payload,
    timestamp: Date.now()
  });

  io.emit("system:event", {
    type,
    payload,
    timestamp: Date.now()
  });

}

/* ===============================
   ONLINE USERS MAP
   Map<userId, socketId>
================================= */
const onlineUsers = new Map();

const initSocket = (server) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173",
    ...(process.env.CLIENT_URL || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  ];

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const isExactMatch = allowedOrigins.includes(origin);
        const isVercelPreview = /^https:\/\/.+\.vercel\.app$/.test(origin);

        if (isExactMatch || isVercelPreview) {
          return callback(null, true);
        }

        return callback(new Error("Not allowed by Socket.IO CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });

  /* ===============================
   AUTH MIDDLEWARE
=============================== */
io.use((socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;

    if (!token) {
      return next(new Error("Authentication error: token missing"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      return next(new Error("Authentication error: invalid token"));
    }

    socket.user = decoded;
    socket.userId = decoded.id;

    next();
  } catch (err) {
    console.error("Socket auth failed:", err.message);
    next(new Error("Authentication error"));
  }
});

  /* ===============================
     CONNECTION
  =============================== */
  io.on("connection", (socket) => {

    socket.removeAllListeners("join:channel");
    socket.removeAllListeners("join:project");
    socket.removeAllListeners("typing:start");
    socket.removeAllListeners("typing:stop");

    console.log(`🔌 Connected: ${socket.userId}`);

    /* ===============================
       AUTO JOIN USER ROOM
    =============================== */
    socket.join(`user:${socket.userId}`);

    const existingSocket = onlineUsers.get(socket.userId);

      if (existingSocket && existingSocket !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingSocket);
        if (oldSocket) oldSocket.disconnect(true);
      }

      onlineUsers.delete(socket.userId);
      onlineUsers.set(socket.userId, socket.id);

    const users = [];

  for (const [userId, socketId] of onlineUsers.entries()) {

    const s = io.sockets.sockets.get(socketId);

      if (!s) {
        // remove stale socket
        onlineUsers.delete(userId);
        continue;
      }

      if (s?.user?.role !== "Admin") {
        users.push(userId);
      }
    }

    io.emit("users:online", users);

    /* ===============================
       JOIN CHANNEL (SECURE)
    =============================== */
    socket.on("join:channel", async (channelId) => {
      try {
        const channel = await Channel.findById(channelId);
        if (!channel) return;

        const isMember = channel.members.some(
          m => m.user.toString() === socket.userId
        );

        if (!isMember && socket.user.role !== "Admin") return;

        socket.join(`channel:${channelId}`);
        console.log(`📢 Joined channel:${channelId}`);

      } catch (err) {
        console.error("Join channel error:", err);
      }
    });

    /* ===============================
       LEAVE CHANNEL
    =============================== */
    socket.on("leave:channel", (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    /* ===============================
       JOIN PROJECT (KANBAN)
    =============================== */
    socket.on("join:project", async (projectId) => {

      console.log("Join project request:", projectId);

      try {
        const project = await Project.findById(projectId);
        if (!project) return;

        const channel = await Channel.findById(project.channel);

        const isProjectMember = project.members.some(
          m => m.toString() === socket.userId
        );

        const isChannelMember = channel.members.some(
          m => m.user.toString() === socket.userId
        );

        if (!isProjectMember && !isChannelMember && socket.user.role !== "Admin") {
          return;
        }

        socket.join(`project:${projectId}`);
        console.log(`📦 Joined project room project:${projectId}`);

      } catch (err) {
        console.error("Join project error:", err);
      }
    });

    /* ===============================
       TYPING INDICATOR
    =============================== */
    socket.on("typing:start", ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit("typing:update", {
        userId: socket.userId,
        channelId,
        typing: true
      });
    });

    socket.on("typing:stop", ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit("typing:update", {
        userId: socket.userId,
        channelId,
        typing: false
      });
    });

    /* ===============================
       THREAD REPLY
    =============================== */
    socket.on("thread:reply", (data) => {
      io.to(`channel:${data.channelId}`)
        .emit("thread:replyCreated", data);

      io.to(`user:${data.parentUserId}`)
        .emit("notification:new", {
          type: "thread_reply",
          text: "Someone replied to your thread"
        });
    });

    /* ===============================
       SEND NOTIFICATION
    =============================== */
    socket.on("notification:send", async ({ userId, payload }) => {
      try {
        const notif = await Notification.create({
          user: userId,
          text: payload.text,
          type: payload.type,
          link: payload.link
        });

        io.to(`user:${userId}`)
          .emit("notification:new", notif);

      } catch (err) {
        console.error("Notification error:", err);
      }
    });

    /* ===============================
       DISCONNECT
    =============================== */
    socket.on("disconnect", () => {

      console.log(`❌ Disconnected: ${socket.userId}`);

      onlineUsers.delete(socket.userId);

      io.emit("users:online", Array.from(onlineUsers.keys()));
    });

  });

  /* ===============================
     TASK REMINDER CRON
  =============================== */
  if (!global.reminderJobStarted) {
    reminderChecker(io);
    global.reminderJobStarted = true;
  }

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};

/* ===============================
   GET ONLINE USERS COUNT
=============================== */
function getOnlineUsers() {
  if (!io) return 0;

  let count = 0;

  for (const socketId of onlineUsers.values()) {
    const socket = io.sockets.sockets.get(socketId);

    if (socket?.user?.role !== "Admin") {
      count++;
    }
  }

  return count;
}

module.exports = { initSocket, getIO, emitAdminUpdate, getOnlineUsers };
