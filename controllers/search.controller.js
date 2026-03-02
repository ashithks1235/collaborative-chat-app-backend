const Channel = require("../models/channelModel");
const Message = require("../models/messageModel");
const User = require("../models/userModel");

exports.globalSearch = async (req, res) => {
  const { q } = req.query;

  try {
    const channels = await Channel.find({
      name: { $regex: q, $options: "i" },
      members: req.user.id,
    }).lean();

    const messages = await Message.find({
      text: { $regex: q, $options: "i" },
    }).populate("channel", "name").lean();

    const users = await User.find({
      username: { $regex: q, $options: "i" },
    }).select("username email").lean();

    res.json({ channels, messages, users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
