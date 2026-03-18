const analyticsService = require("../services/analytics.service");

exports.getAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getAnalytics(req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
};