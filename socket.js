const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Channel = require("./models/channelModel");
const Project = require("./models/projectModel");
const Notification = require("./models/notificationModel");
const reminderChecker = require("./utils/reminderChecker");

let io;

/* ===============================
   ONLINE USERS MAP
   Map<userId, socketId>
================================= */
const onlineUsers = new Map();

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });

  /* ===============================
     AUTH MIDDLEWARE
  =============================== */
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.user = decoded;       // { id, role }
      socket.userId = decoded.id;

      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  /* ===============================
     CONNECTION
  =============================== */
  io.on("connection", (socket) => {

    console.log(`🔌 Connected: ${socket.userId}`);

    /* ===============================
       AUTO JOIN USER ROOM
    =============================== */
    socket.join(`user:${socket.userId}`);

    onlineUsers.set(socket.userId, socket.id);

    io.emit("users:online", Array.from(onlineUsers.keys()));

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
      try {
        const project = await Project.findById(projectId);
        if (!project) return;

        const isMember = project.members.some(
          m => m.toString() === socket.userId
        );

        if (!isMember && socket.user.role !== "Admin") return;

        socket.join(`project:${projectId}`);
        console.log(`📦 Joined project:${projectId}`);

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
  reminderChecker(io);

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};

module.exports = { initSocket, getIO };
