const Channel = require("../models/channelModel");
const User = require("../models/userModel");
const validateObjectId = require("../utils/validateObjectId");
const {
  getChannelWithPermissionCheck,
  isChannelAdmin
} = require("../utils/channelPermissions");
const AppError = require("../utils/AppError");

/* =====================================================
   GET CHANNELS
===================================================== */
exports.getChannels = async (req, res, next) => {
  try {
    let channels;

    if (req.user.role === "Admin") {
      channels = await Channel.find({
        "members.user": req.user.id
      })
        .populate("members.user", "name avatar role")
        .lean();
    } else {
      channels = await Channel.find({
        "members.user": req.user.id
      })
        .populate("members.user", "name avatar role")
        .lean();
    }

    res.status(200).json(channels);

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   CREATE CHANNEL
===================================================== */
exports.createChannel = async (req, res, next) => {
  try {
    if (!req.body.name || req.body.name.trim() === "") {
      throw new AppError("Channel name is required", 400);
    }

    const channel = await Channel.create({
      name: req.body.name.trim(),
      createdBy: req.user.id,
      members: [
        {
          user: req.user.id,
          role: "admin"
        }
      ]
    });

    res.status(201).json(channel);

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   GET CHANNEL BY ID
===================================================== */
exports.getChannelById = async (req, res, next) => {
  try {
    const { id } = req.params;

    validateObjectId(id, "Channel ID");

    let channel;

    if (req.user.role === "Admin") {
      channel = await Channel.findById(id)
        .populate("members.user", "name email role avatar")
        .lean();
    } else {
      channel = await Channel.findOne({
        _id: id,
        "members.user": req.user.id
      })
        .populate("members.user", "name email role avatar")
        .lean();
    }

    if (!channel) {
      throw new AppError("Channel not found", 404);
    }

    res.status(200).json(channel);

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   ADD MEMBER
===================================================== */
exports.addMemberToChannel = async (req, res, next) => {
  try {
    const channelId = req.params.id;
    const { userId } = req.body;

    validateObjectId(channelId, "Channel ID");
    validateObjectId(userId, "User ID");

    const channel = await Channel.findById(channelId);
    if (!channel) throw new AppError("Channel not found", 404);

    const currentUserMember = channel.members.find(
      m => m.user.toString() === req.user.id
    );

    if (!currentUserMember || currentUserMember.role !== "admin") {
      throw new AppError("Only Channel Admin can add members", 403);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const alreadyMember = channel.members.some(
      m => m.user.toString() === userId
    );

    if (alreadyMember) {
      throw new AppError("User already in channel", 400);
    }

    channel.members.push({
      user: userId,
      role: "member"
    });

    await channel.save();

    const updated = await Channel.findById(channelId)
      .populate("members.user", "name email role avatar")
      .lean();

    res.status(200).json(updated);

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   PROMOTE MEMBER TO ADMIN
===================================================== */
exports.promoteToAdmin = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    validateObjectId(id, "Channel ID");
    validateObjectId(userId, "User ID");

    const { channel, member, error } =
      await getChannelWithPermissionCheck(id, req.user.id);

    if (error) throw new AppError(error, 404);

    if (!isChannelAdmin(member)) {
      throw new AppError("Only Channel Admin can promote members", 403);
    }

    const target = channel.members.find(
      m => m.user.toString() === userId
    );

    if (!target) {
      throw new AppError("User not in channel", 404);
    }

    target.role = "admin";

    await channel.save();

    res.status(200).json({
      message: "User promoted to Channel Admin"
    });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   REMOVE MEMBER
===================================================== */
exports.removeMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    validateObjectId(id, "Channel ID");
    validateObjectId(userId, "User ID");

    const { channel, member, error } =
      await getChannelWithPermissionCheck(id, req.user.id);

    if (error) throw new AppError(error, 404);

    if (!isChannelAdmin(member)) {
      throw new AppError("Only Channel Admin can remove members", 403);
    }

    if (userId === req.user.id) {
      throw new AppError("Admin cannot remove himself", 400);
    }

    channel.members = channel.members.filter(
      m => m.user.toString() !== userId
    );

    await channel.save();

    res.status(200).json({
      message: "Member removed successfully"
    });

  } catch (err) {
    next(err);
  }
};

exports.pinMessage = async (req, res, next) => {
  try {
    const { channelId, messageId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel) throw new AppError("Channel not found", 404);

    channel.pinnedMessage = messageId;
    await channel.save();

    const io = req.app.get("io");
    io.to(`channel:${channelId}`).emit("channel:pinned", messageId);

    res.status(200).json({ success: true, messageId });

  } catch (err) {
    next(err);
  }
};

exports.unpinMessage = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findById(channelId);
    if (!channel) throw new AppError("Channel not found", 404);

    channel.pinnedMessage = null;
    await channel.save();

    const io = req.app.get("io");
    io.to(`channel:${channelId}`).emit("channel:unpinned");

    res.status(200).json({ success: true });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   GET ALL CHANNELS (SUPER ADMIN)
===================================================== */
exports.getAllChannelsAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    const channels = await Channel.find()
      .populate("createdBy", "name email")
      .populate("members.user", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(channels);

  } catch (err) {
    next(err);
  }
};


