const File = require("../models/fileModel");
const Channel = require("../models/channelModel");

/* ================= GET FILES ================= */

exports.getFiles = async (userId) => {
  // Get user channels
  const channels = await Channel.find({
    "members.user": userId
  }).select("_id");

  const channelIds = channels.map(c => c._id);

  const files = await File.find({
    channel: { $in: channelIds },
    hiddenFor: { $ne: userId }
  })
    .populate("uploadedBy", "name avatar")
    .sort({ createdAt: -1 });

  return files;
};

/* ================= DELETE ONE ================= */

exports.deleteFromLibrary = async (fileId, userId) => {
  await File.findByIdAndUpdate(fileId, {
    $addToSet: { hiddenFor: userId }
  });

  return true;
};

/* ================= DELETE MANY ================= */

exports.deleteMany = async (ids, userId) => {
  await File.updateMany(
    { _id: { $in: ids } },
    {
      $addToSet: { hiddenFor: userId }
    }
  );

  return true;
};