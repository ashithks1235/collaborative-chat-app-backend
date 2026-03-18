const Channel = require("../models/channelModel");
const User = require("../models/userModel");
const validateObjectId = require("../utils/validateObjectId");
const {
  getChannelWithPermissionCheck,
  isChannelAdmin
} = require("../utils/channelPermissions");
const AppError = require("../utils/AppError");

/* ================= GET CHANNELS ================= */

exports.getChannels = async (user) => {
  let channels;

  if (user.role === "Admin") {
    channels = await Channel.find();
  } else {
    channels = await Channel.find({
      "members.user": user.id
    });
  }

  return channels
    .populate("members.user", "name avatar role")
    .lean()
    .then(channels =>
      channels.map(ch => ({
        ...ch,
        members: ch.members.filter(m => m.user)
      }))
    );
};

/* ================= CREATE CHANNEL ================= */

exports.createChannel = async (userId, name) => {
  if (!name || name.trim() === "") {
    throw new AppError("Channel name is required", 400);
  }

  const channel = await Channel.create({
    name: name.trim(),
    createdBy: userId,
    members: [
      {
        user: userId,
        role: "admin"
      }
    ]
  });

  return channel;
};

/* ================= GET CHANNEL ================= */

exports.getChannelById = async (user, channelId) => {
  validateObjectId(channelId, "Channel ID");

  let channel;

  if (user.role === "Admin") {
    channel = await Channel.findById(channelId)
      .populate("members.user", "name email role avatar")
      .lean();
  } else {
    channel = await Channel.findOne({
      _id: channelId,
      "members.user": user.id
    })
      .populate("members.user", "name email role avatar")
      .lean();
  }

  if (!channel) throw new AppError("Channel not found", 404);

  return channel;
};

/* ================= ADD MEMBER ================= */

exports.addMember = async (currentUser, channelId, userId) => {
  validateObjectId(channelId, "Channel ID");
  validateObjectId(userId, "User ID");

  const channel = await Channel.findById(channelId);
  if (!channel) throw new AppError("Channel not found", 404);

  const currentUserMember = channel.members.find(
    m => m.user.toString() === currentUser.id
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

  return await Channel.findById(channelId)
    .populate("members.user", "name email role avatar")
    .lean();
};

/* ================= PROMOTE ================= */

exports.promoteToAdmin = async (currentUserId, channelId, targetUserId) => {
  validateObjectId(channelId);
  validateObjectId(targetUserId);

  const { channel, member, error } =
    await getChannelWithPermissionCheck(channelId, currentUserId);

  if (error) throw new AppError(error, 404);

  if (!isChannelAdmin(member)) {
    throw new AppError("Only Channel Admin can promote members", 403);
  }

  const target = channel.members.find(
    m => m.user.toString() === targetUserId
  );

  if (!target) throw new AppError("User not in channel", 404);

  target.role = "admin";

  await channel.save();

  return true;
};

/* ================= REMOVE MEMBER ================= */

exports.removeMember = async (currentUserId, channelId, targetUserId) => {
  validateObjectId(channelId);
  validateObjectId(targetUserId);

  const { channel, member, error } =
    await getChannelWithPermissionCheck(channelId, currentUserId);

  if (error) throw new AppError(error, 404);

  if (!isChannelAdmin(member)) {
    throw new AppError("Only Channel Admin can remove members", 403);
  }

  if (targetUserId === currentUserId) {
    throw new AppError("Admin cannot remove himself", 400);
  }

  channel.members = channel.members.filter(
    m => m.user.toString() !== targetUserId
  );

  await channel.save();

  return true;
};

/* ================= PIN ================= */

exports.pinMessage = async (channelId, messageId) => {
  const channel = await Channel.findById(channelId);
  if (!channel) throw new AppError("Channel not found", 404);

  channel.pinnedMessage = messageId;
  await channel.save();

  return true;
};

exports.unpinMessage = async (channelId) => {
  const channel = await Channel.findById(channelId);
  if (!channel) throw new AppError("Channel not found", 404);

  channel.pinnedMessage = null;
  await channel.save();

  return true;
};

exports.deleteChannel = async (user, channelId) => {
  validateObjectId(channelId);

  const channel = await Channel.findById(channelId);
  if (!channel) throw new AppError("Channel not found", 404);

  const isMember = channel.members.find(
    m => m.user.toString() === user.id
  );

  if (
    user.role !== "Admin" &&
    channel.createdBy.toString() !== user.id &&
    (!isMember || isMember.role !== "admin")
  ) {
    throw new AppError("Not authorized to delete channel", 403);
  }

  await channel.deleteOne();

  return true;
};

/* ================= ADMIN ================= */

exports.getAllChannelsAdmin = async () => {
  return await Channel.find()
    .populate("createdBy", "name email")
    .populate("members.user", "name email")
    .sort({ createdAt: -1 })
    .lean();
};

