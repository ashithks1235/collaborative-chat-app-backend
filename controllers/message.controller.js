const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Notification = require("../models/notificationModel");
const Channel = require("../models/channelModel");
const File = require("../models/fileModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");
const { success } = require("../utils/response");
const sanitizeHtml = require("sanitize-html");
const { emitAdminUpdate } = require("../socket");
const path = require("path");
const messageService = require("../services/message.service");

/* =====================================================
   GET MESSAGES (Paginated + Thread Preview + Unread)
===================================================== */
exports.getMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    let { page = 1, limit = 30 } = req.query;

    validateObjectId(channelId, "Channel ID");

    const channel = await Channel.findById(channelId).lean();
    if (!channel) throw new AppError("Channel not found", 404);

    const isMember = channel.members.some(
      m => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 50);

    const skip = (page - 1) * limit;

    /* ============================================
       FETCH ONLY TOP-LEVEL MESSAGES
    ============================================ */
    const messages = await Message.find({
      channel: channelId,
      parentMessage: null
    })
      .populate("sender", "name avatar role")
      .populate("attachments", "name url type size createdAt")
      .populate({
        path: "replyTo",
        populate: [
          { path: "sender", select: "name avatar" },
          { path: "attachments", select: "name url type size createdAt" }
        ]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const messageIds = messages.map(m => m._id);

    /* ============================================
       FETCH ALL REPLIES FOR UNREAD CALCULATION
    ============================================ */
    const replies = await Message.find({
      parentMessage: { $in: messageIds },
      isDeleted: false
    })
      .select("parentMessage text sender createdAt seenBy")
      .lean();

    /* ============================================
       CALCULATE:
       - Last Reply
       - Unread Count
    ============================================ */
    const replyMap = {};
    const unreadCountMap = {};

    replies.forEach(r => {
      const parentId = r.parentMessage.toString();

      // Track latest reply
      if (
        !replyMap[parentId] ||
        new Date(r.createdAt) > new Date(replyMap[parentId].createdAt)
      ) {
        replyMap[parentId] = r;
      }

      // Count unread replies
      const seen = r.seenBy?.some(
        id => id.toString() === req.user.id
      );

      if (!seen) {
        unreadCountMap[parentId] =
          (unreadCountMap[parentId] || 0) + 1;
      }
    });

    /* ============================================
       ENHANCE MESSAGE OBJECT
    ============================================ */
    const enhancedMessages = messages.map(m => {
      const id = m._id.toString();

      return {
        ...m,
        lastReply: replyMap[id] || null,
        unreadThreadCount: unreadCountMap[id] || 0,
        hasUnreadThread: (unreadCountMap[id] || 0) > 0
      };
    });

    /* ============================================
       TOTAL COUNT (TOP-LEVEL ONLY)
    ============================================ */
    const total = await Message.countDocuments({
      channel: channelId,
      parentMessage: null
    });

    return success(res, {
      messages: enhancedMessages.reverse(),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + messages.length < total
      }
    });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   SEND MESSAGE (Sanitized + Mention + Attachments)
===================================================== */
exports.sendMessage = async (req, res, next) => {
  try {
    const msg = await messageService.sendMessage(
      req.body,
      req.user,
      req.files
    );

    const populated = await Message.findById(msg._id)
      .populate("sender", "name avatar role")
      .populate("attachments", "name url type size createdAt");

    const io = req.app.get("io");
    const channel = await Channel.findById(req.body.channelId).select("members").lean();

    // 🔥 SOCKET KEPT HERE
    io.to(`channel:${req.body.channelId}`)
      .emit("message:new", populated);

    if (channel?.members?.length) {
      channel.members.forEach((member) => {
        const memberId = member.user?.toString?.() || member.user;

        if (!memberId || String(memberId) === String(req.user.id)) return;

        io.to(`user:${memberId}`).emit("channel:unread", {
          channelId: req.body.channelId,
          messageId: populated._id,
          senderId: req.user.id
        });
      });
    }

    return success(res, populated, "Message sent", 201);

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   TOGGLE REACTION
===================================================== */
exports.toggleReaction = async (req, res, next) => {
  try {
    const message = await messageService.toggleReaction(
      req.params.messageId,
      req.body.emoji,
      req.user
    );

    const populated = await Message.findById(message._id)
      .populate("sender", "name avatar role");

    const io = req.app.get("io");

    io.to(`channel:${message.channel}`)
      .emit("message:reaction", populated);

    return success(res, populated, "Reaction updated");

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   TOGGLE PIN MESSAGE
===================================================== */
exports.togglePin = async (req, res, next) => {
  try {

    const { messageId } = req.params;

    validateObjectId(messageId);

    const message = await Message.findById(messageId);
    if (!message) throw new AppError("Message not found", 404);

    const channel = await Channel.findById(message.channel);

    const isAdmin = channel.members.some(
      m =>
        m.user.toString() === req.user.id &&
        m.role === "admin"
    );

    if (!isAdmin && req.user.role !== "Admin") {
      throw new AppError("Only admins can pin messages", 403);
    }

    /* =====================================
          ALLOW ONLY ONE PINNED MESSAGE
        ===================================== */

        if (!message.pinned) {

          const previousPinned = await Message.findOne({
            channel: message.channel,
            pinned: true,
            parentMessage: null
          });

          if (previousPinned) {
            previousPinned.pinned = false;
            await previousPinned.save();

            const io = req.app.get("io");

            io.to(`channel:${message.channel}`)
              .emit("message:unpinned", previousPinned);
          }

        }
    /* =====================================
       TOGGLE PIN
    ===================================== */

    message.pinned = !message.pinned;

    await message.save();

    const populated = await Message.findById(message._id)
      .populate("sender", "name avatar role")
      .populate("attachments", "name url type size createdAt");

    const io = req.app.get("io");

    io.to(`channel:${message.channel}`)
      .emit("message:pinned", populated);

    return success(res, populated, "Pin updated");

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   EDIT MESSAGE (Supports Threads + Realtime)
===================================================== */
exports.editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    validateObjectId(messageId, "Message ID");

    const message = await Message.findById(messageId);
    if (!message) throw new AppError("Message not found", 404);

    const channel = await Channel.findById(message.channel);
    if (!channel) throw new AppError("Channel not found", 404);

    const isMember = channel.members.some(
      m => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    if (message.sender.toString() !== req.user.id) {
      throw new AppError("Not allowed", 403);
    }

    if (!text || !text.trim()) {
      throw new AppError("Message cannot be empty", 400);
    }

    /* ---------- Sanitize ---------- */
    message.text = sanitizeHtml(text.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    });

    message.editedAt = new Date();

    await message.save();

    /* ---------- Populate sender ---------- */
    const populated = await Message.findById(message._id)
      .populate("sender", "name avatar role")
      .populate("attachments", "name url type size createdAt");

    const io = req.app.get("io");

    /* ---------- Emit Correct Event ---------- */
    if (message.parentMessage) {
      // 🔥 Thread reply updated
      io.to(`channel:${message.channel}`)
        .emit("thread:replyUpdated", populated);
    } else {
      // 🔥 Normal message updated
      io.to(`channel:${message.channel}`)
        .emit("message:updated", populated);
    }

    return success(res, populated, "Message updated");

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   SOFT DELETE MESSAGE (Thread Aware + Safe ReplyCount)
===================================================== */
exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    validateObjectId(messageId, "Message ID");

    const message = await Message.findById(messageId);
    if (!message) throw new AppError("Message not found", 404);

    const channel = await Channel.findById(message.channel);
    if (!channel) throw new AppError("Channel not found", 404);

    const isMember = channel.members.some(
      m => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    if (
      message.sender.toString() !== req.user.id &&
      req.user.role !== "Admin"
    ) {
      throw new AppError("Not allowed", 403);
    }

    /* ============================================
       IF THIS IS A THREAD REPLY
    ============================================ */
    if (message.parentMessage) {
      await Message.findByIdAndUpdate(
        message.parentMessage,
        {
          $inc: { replyCount: -1 }
        }
      );

      // Prevent negative replyCount
      await Message.updateOne(
        { _id: message.parentMessage, replyCount: { $lt: 0 } },
        { $set: { replyCount: 0 } }
      );
    }

    /* ============================================
       SOFT DELETE
    ============================================ */
    message.text = "This message was deleted";
    message.isDeleted = true;
    message.deletedAt = new Date();

    // Remove reactions on delete
    message.reactions = [];

    // Remove attachments
    message.attachments = [];

    await message.save();

    const io = req.app.get("io");

    /* ============================================
       EMIT CORRECT EVENT
    ============================================ */
    if (message.parentMessage) {
      io.to(`channel:${message.channel}`)
        .emit("thread:replyDeleted", {
          messageId,
          parentMessage: message.parentMessage
        });
    } else {
      io.to(`channel:${message.channel}`)
        .emit("message:deleted", messageId);
    }

    return success(res, null, "Message deleted");

  } catch (err) {
    next(err);
  }
};

exports.addThreadReply = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    validateObjectId(messageId, "Message ID");

    const parent = await Message.findById(messageId);
    if (!parent) throw new AppError("Parent message not found", 404);

    const reply = await Message.create({
      channel: parent.channel,
      sender: req.user.id,
      text: sanitizeHtml(text.trim(), {
        allowedTags: [],
        allowedAttributes: {}
      }),
      parentMessage: parent._id
    });

    await Message.findByIdAndUpdate(messageId, {
      $inc: { replyCount: 1 }
    });

    const populated = await Message.findById(reply._id)
      .populate("sender", "name avatar role");

    const io = req.app.get("io");
    io.to(`channel:${parent.channel}`)
      .emit("thread:replyAdded", {
        parentMessage: messageId,
        reply: populated
      });

    return success(res, populated, "Reply added", 201);

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   GET THREAD REPLIES (Secure + Paginated)
===================================================== */
exports.getThreadReplies = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    let { page = 1, limit = 20 } = req.query;

    validateObjectId(messageId, "Message ID");

    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 50);

    const skip = (page - 1) * limit;

    /* ---------- Ensure Parent Message Exists ---------- */
    const parent = await Message.findById(messageId).lean();
    if (!parent) {
      throw new AppError("Parent message not found", 404);
    }

    /* ---------- Ensure Channel Exists ---------- */
    const channel = await Channel.findById(parent.channel).lean();
    if (!channel) {
      throw new AppError("Channel not found", 404);
    }

    /* ---------- Access Control ---------- */
    const isMember = channel.members.some(
      m => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    /* ---------- Fetch Replies ---------- */
    const replies = await Message.find({
      parentMessage: messageId,
      isDeleted: false
    })
      .populate("sender", "name avatar role")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Message.countDocuments({
      parentMessage: messageId,
      isDeleted: false
    });

    return success(res, {
      replies,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + replies.length < total
      }
    });

  } catch (err) {
    next(err);
  }
};

exports.markThreadRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    validateObjectId(messageId);

    await Message.updateMany(
      {
        parentMessage: messageId,
        seenBy: { $ne: req.user.id }
      },
      {
        $addToSet: { seenBy: req.user.id }
      }
    );

    return success(res, null, "Thread marked read");

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   SEARCH MESSAGES (Channel scoped)
===================================================== */
exports.searchMessages = async (req, res, next) => {
  try {

    const { q, channelId } = req.query;

    validateObjectId(channelId, "Channel ID");

    if (!q || q.trim().length < 2) {
      return success(res, { messages: [] });
    }

    const messages = await Message.find({
      channel: channelId,
      parentMessage: null,
      isDeleted: false,
      text: { $regex: q, $options: "i" }
    })
      .limit(20)
      .populate("sender", "name avatar")
      .populate("channel", "name")
      .sort({ createdAt: -1 })
      .lean();

    return success(res, { messages });

  } catch (err) {
    next(err);
  }
};
