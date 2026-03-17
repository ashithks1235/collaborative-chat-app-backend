const File = require("../models/fileModel");
const Channel = require("../models/channelModel");

/* =========================================
   GET LIBRARY FILES (VISIBLE TO USER)
========================================= */
exports.getFiles = async (req, res) => {
  try {
    const userId = req.user.id;

    // find channels where user is member
    const channels = await Channel.find({
      "members.user": userId
    }).select("_id");

    const channelIds = channels.map(c => c._id);

    const files = await File.find({
      channel: { $in: channelIds },
      hiddenFor: { $ne: userId }   // hide files deleted by this user
    })
      .populate("uploadedBy", "name avatar")
      .sort({ createdAt: -1 });

    res.json(files);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================================
   DELETE SINGLE FILE FROM LIBRARY
   (HIDE FOR CURRENT USER ONLY)
========================================= */
exports.deleteFromLibrary = async (req, res) => {
  try {
    const { id } = req.params;

    await File.findByIdAndUpdate(id, {
      $addToSet: { hiddenFor: req.user.id }
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* =========================================
   BULK DELETE FILES FROM LIBRARY
========================================= */
exports.deleteMany = async (req, res) => {
  try {
    const { ids } = req.body;

    await File.updateMany(
      { _id: { $in: ids } },
      {
        $addToSet: { hiddenFor: req.user.id }
      }
    );

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};