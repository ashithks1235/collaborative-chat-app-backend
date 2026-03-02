const File = require("../models/fileModel");
const Channel = require("../models/channelModel");

exports.getFiles = async (req, res) => {
  try {
    const channels = await Channel.find({
      "members.user": req.user.id
    }).select("_id");

    const channelIds = channels.map(c => c._id);

    const files = await File.find({
      channel: { $in: channelIds },
      hiddenFor: { $ne: req.user.id }
    }).sort({ createdAt: -1 });

    res.json(files);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteFromLibrary = async (req, res) => {
  const { id } = req.params;

  await File.findByIdAndUpdate(id, {
    $addToSet: { hiddenFor: req.user.id }
  });

  res.json({ success: true });
};
