const channelService = require("../services/channel.service");
const { emitAdminUpdate } = require("../socket");
const { success } = require("../utils/response");

/* ================= GET CHANNELS ================= */

exports.getChannels = async (req, res, next) => {
  try {
    const channels = await channelService.getChannels(req.user);
    return success(res, channels);
  } catch (err) {
    next(err);
  }
};

/* ================= CREATE CHANNEL ================= */

exports.createChannel = async (req, res, next) => {
  try {
    const channel = await channelService.createChannel(
      req.user.id,
      req.body.name
    );

    emitAdminUpdate("channel_created", {
      user: req.user.id,
      channel: channel._id,
      entityId: channel._id
    });

    return success(res, channel, "Channel created", 201);
  } catch (err) {
    next(err);
  }
};

/* ================= GET CHANNEL ================= */

exports.getChannelById = async (req, res, next) => {
  try {
    const channel = await channelService.getChannelById(
      req.user,
      req.params.id
    );

    return success(res, channel);
  } catch (err) {
    next(err);
  }
};

exports.updateChannel = async (req, res, next) => {
  try {
    const channel = await channelService.updateChannel(
      req.user,
      req.params.id,
      req.body.name
    );

    return success(res, channel, "Channel updated");
  } catch (err) {
    next(err);
  }
};

/* ================= ADD MEMBER ================= */

exports.addMemberToChannel = async (req, res, next) => {
  try {
    const channel = await channelService.addMember(
      req.user,
      req.params.id,
      req.body.userId
    );

    return success(res, channel);
  } catch (err) {
    next(err);
  }
};

/* ================= PROMOTE ================= */

exports.promoteToAdmin = async (req, res, next) => {
  try {
    await channelService.promoteToAdmin(
      req.user.id,
      req.params.id,
      req.params.userId
    );

    return success(res, null, "User promoted to Channel Admin");
  } catch (err) {
    next(err);
  }
};

/* ================= REMOVE ================= */

exports.removeMember = async (req, res, next) => {
  try {
    await channelService.removeMember(
      req.user.id,
      req.params.id,
      req.params.userId
    );

    return success(res, null, "Member removed successfully");
  } catch (err) {
    next(err);
  }
};

/* ================= PIN ================= */

exports.pinMessage = async (req, res, next) => {
  try {
    await channelService.pinMessage(
      req.params.channelId,
      req.params.messageId
    );

    const io = req.app.get("io");
    io.to(`channel:${req.params.channelId}`)
      .emit("channel:pinned", req.params.messageId);

    return success(res, { messageId: req.params.messageId }, "Message pinned");
  } catch (err) {
    next(err);
  }
};

exports.unpinMessage = async (req, res, next) => {
  try {
    await channelService.unpinMessage(req.params.channelId);

    const io = req.app.get("io");
    io.to(`channel:${req.params.channelId}`)
      .emit("channel:unpinned");

    return success(res, null, "Message unpinned");
  } catch (err) {
    next(err);
  }
};

exports.deleteChannel = async (req, res, next) => {
  try {
    await channelService.deleteChannel(req.user, req.params.id);

    return success(res, null, "Channel deleted successfully");

  } catch (err) {
    next(err);
  }
};

/* ================= ADMIN ================= */

exports.getAllChannelsAdmin = async (req, res, next) => {
  try {
    const channels = await channelService.getAllChannelsAdmin();
    return success(res, channels);
  } catch (err) {
    next(err);
  }
};
