const Channel = require("../models/channelModel");

exports.getChannelWithPermissionCheck = async (
  channelId,
  userId
) => {
  const channel = await Channel.findById(channelId);

  if (!channel) {
    return { error: "Channel not found" };
  }

  const member = channel.members.find(
    (m) => m.user.toString() === userId.toString()
  );

  if (!member) {
    return { error: "You are not a member of this channel" };
  }

  return { channel, member };
};

exports.isChannelAdmin = (member) => {
  return member.role === "admin";
};
