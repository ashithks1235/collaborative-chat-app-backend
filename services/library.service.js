const path = require("path");
const File = require("../models/fileModel");
const Channel = require("../models/channelModel");

const getLibraryType = (file) => {
  const rawType = String(file.type || "").toLowerCase();
  const ext = path.extname(file.name || "").toLowerCase();

  if (rawType === "image" || rawType.startsWith("image/")) return "image";
  if (rawType === "video" || rawType.startsWith("video/")) return "video";

  if (
    rawType === "document" ||
    [
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
      ".txt", ".csv", ".json", ".zip", ".rar"
    ].includes(ext)
  ) {
    return "document";
  }

  return "document";
};

/* ================= GET FILES ================= */

exports.getFiles = async (userId) => {
  const channels = await Channel.find({
    "members.user": userId
  }).select("_id");

  const channelIds = channels.map((c) => c._id);

  const files = await File.find({
    channel: { $in: channelIds },
    hiddenFor: { $ne: userId }
  })
    .populate("uploadedBy", "name avatar")
    .populate("channel", "name")
    .sort({ createdAt: -1 })
    .lean();

  return files.map((file) => ({
    ...file,
    type: getLibraryType(file)
  }));
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
