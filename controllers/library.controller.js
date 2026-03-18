const libraryService = require("../services/library.service");

/* ================= GET FILES ================= */

exports.getFiles = async (req, res, next) => {
  try {
    const files = await libraryService.getFiles(req.user.id);
    res.json(files);
  } catch (err) {
    next(err);
  }
};

/* ================= DELETE ONE ================= */

exports.deleteFromLibrary = async (req, res, next) => {
  try {
    await libraryService.deleteFromLibrary(
      req.params.id,
      req.user.id
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ================= DELETE MANY ================= */

exports.deleteMany = async (req, res, next) => {
  try {
    await libraryService.deleteMany(
      req.body.ids,
      req.user.id
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};