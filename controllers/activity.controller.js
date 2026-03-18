const activityService = require("../services/activity.service");

/* ================= GET CHANNEL ACTIVITY ================= */

exports.getChannelActivity = async (req, res, next) => {
  try {
    const data = await activityService.getChannelActivity(
      req.params.channelId,
      req.user,
      req.query
    );

    res.status(200).json(data);

  } catch (err) {
    next(err);
  }
};