const fs = require("fs");
const path = require("path");
const Message = require("../models/messageModel");
const Channel = require("../models/channelModel");
const User = require("../models/userModel");
const File = require("../models/fileModel");
const Notification = require("../models/notificationModel");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");
const sanitizeHtml = require("sanitize-html");

const getAttachmentType = (mimeType) => {
  const normalized = String(mimeType || "").toLowerCase();

  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";

  return "document";
};

const toDataUrl = (file) => {
  const mimeType = file.mimetype || "application/octet-stream";
  const fileBuffer = file.buffer || fs.readFileSync(file.path);

  return "data:" + mimeType + ";base64," + fileBuffer.toString("base64");
};

const cleanupTempFile = (file) => {
  if (file && file.path) {
    fs.promises.unlink(file.path).catch(() => {});
  }
};

/* ================= GET MESSAGES ================= */

exports.getMessages = async (channelId, user, page, limit) => {
  validateObjectId(channelId, "Channel ID");

  const channel = await Channel.findById(channelId).lean();
  if (!channel) throw new AppError("Channel not found", 404);

  const isMember = channel.members.some(
    (m) => m.user.toString() === user.id
  );

  if (!isMember && user.role !== "Admin") {
    throw new AppError("Access denied", 403);
  }

  const skip = (page - 1) * limit;

  const messages = await Message.find({
    channel: channelId,
    parentMessage: null
  })
    .populate("sender", "name email avatar role")
    .populate("attachments")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Message.countDocuments({
    channel: channelId,
    parentMessage: null
  });

  return { messages, total };
};

/* ================= SEND MESSAGE ================= */

exports.sendMessage = async (data, user, files) => {
  const { channelId, text, replyTo } = data;

  validateObjectId(channelId, "Channel ID");

  const channel = await Channel.findById(channelId);
  if (!channel) throw new AppError("Channel not found", 404);

  const isMember = channel.members.some(
    (m) => m.user.toString() === user.id
  );

  if (!isMember) {
    throw new AppError("You are not a member of this channel", 403);
  }

  if (!text?.trim() && (!files || files.length === 0)) {
    throw new AppError("Message cannot be empty", 400);
  }

  const cleanText = text
    ? sanitizeHtml(text.trim(), { allowedTags: [] })
    : "";

  const attachmentIds = [];

  if (files && files.length) {
    for (const file of files) {
      const fileDoc = await File.create({
        name: path.basename(file.originalname),
        url: toDataUrl(file),
        type: getAttachmentType(file.mimetype),
        size: file.size,
        channel: channelId,
        uploadedBy: user.id
      });

      cleanupTempFile(file);
      attachmentIds.push(fileDoc._id);
    }
  }

  const msg = await Message.create({
    channel: channelId,
    sender: user.id,
    text: cleanText,
    attachments: attachmentIds,
    replyTo: replyTo || null
  });

  return msg;
};

/* ================= TOGGLE REACTION ================= */

exports.toggleReaction = async (messageId, emoji, user) => {
  validateObjectId(messageId);

  const message = await Message.findById(messageId);
  if (!message) throw new AppError("Message not found", 404);

  const reaction = message.reactions.find((r) => r.emoji === emoji);

  if (!reaction) {
    message.reactions.push({ emoji, users: [user.id] });
  } else {
    const index = reaction.users.findIndex(
      (u) => u.toString() === user.id
    );

    if (index > -1) reaction.users.splice(index, 1);
    else reaction.users.push(user.id);

    if (reaction.users.length === 0) {
      message.reactions = message.reactions.filter(
        (r) => r.emoji !== emoji
      );
    }
  }

  await message.save();

  return message;
};

/* ================= DELETE ================= */

exports.deleteMessage = async (messageId, user) => {
  const message = await Message.findById(messageId);
  if (!message) throw new AppError("Message not found", 404);

  if (
    message.sender.toString() !== user.id &&
    user.role !== "Admin"
  ) {
    throw new AppError("Not allowed", 403);
  }

  message.text = "This message was deleted";
  message.isDeleted = true;
  message.reactions = [];
  message.attachments = [];

  await message.save();

  return message;
};
