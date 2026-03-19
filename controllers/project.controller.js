const projectService = require("../services/project.service");
const { success } = require("../utils/response");

/* ================= CREATE ================= */

exports.createProject = async (req, res, next) => {
  try {
    const project = await projectService.createProject(
      req.body,
      req.user
    );

    res.status(201).json({
      success: true,
      data: project
    });
  } catch (err) {
    next(err);
  }
};

/* ================= GET ALL ================= */

exports.getProjects = async (req, res, next) => {
  try {
    const projects = await projectService.getProjects(req.user);

    res.status(200).json({
      success: true,
      data: projects
    });
  } catch (err) {
    next(err);
  }
};

/* ================= GET ONE ================= */

exports.getProjectById = async (req, res, next) => {
  try {
    const data = await projectService.getProjectById(
      req.params.id,
      req.user
    );

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

/* ================= ARCHIVE ================= */

exports.archiveProject = async (req, res, next) => {
  try {
    await projectService.archiveProject(
      req.params.id,
      req.user
    );

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ================= OVERVIEW ================= */

exports.getProjectOverview = async (req, res, next) => {
  try {
    const data = await projectService.getProjectOverview(req.user);

    return success(res, data);
  } catch (err) {
    next(err);
  }
};
