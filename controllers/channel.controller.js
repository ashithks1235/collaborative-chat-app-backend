const channelService = require("../services/channel.service");
const { emitAdminUpdate } = require("../socket");

/* ================= GET CHANNELS ================= */

exports.getChannels = async (req, res, next) => {
  try {
    const channels = await channelService.getChannels(req.user);
    res.status(200).json(channels);
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

    res.status(201).json(channel);
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

    res.status(200).json(channel);
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

    res.status(200).json(channel);
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

    res.status(200).json({
      message: "User promoted to Channel Admin"
    });
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

    res.status(200).json({
      message: "Member removed successfully"
    });
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

    res.status(200).json({ success: true, messageId: req.params.messageId });
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

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteChannel = async (req, res, next) => {
  try {
    await channelService.deleteChannel(req.user, req.params.id);

    res.status(200).json({
      success: true,
      message: "Channel deleted successfully"
    });

  } catch (err) {
    next(err);
  }
};

/* ================= ADMIN ================= */

exports.getAllChannelsAdmin = async (req, res, next) => {
  try {
    const channels = await channelService.getAllChannelsAdmin();
    res.status(200).json(channels);
  } catch (err) {
    next(err);
  }
};