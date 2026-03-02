const Message = require("../models/messageModel");

exports.getAnalytics = async (req, res) => {
  const count = await Message.countDocuments();
  res.json({
  messagesToday: count,
  activeUsers: 0,
  topChannel: "-"
});
};
