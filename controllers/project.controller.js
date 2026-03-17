const Project = require("../models/projectModel");
const Board = require("../models/boardModel");
const Column = require("../models/columnModel");
const Task = require("../models/taskModel");
const Channel = require("../models/channelModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");
const sanitizeHtml = require("sanitize-html");
const useAccessProject = require("../utils/canAccessProject");

/* =====================================================
   CREATE PROJECT
===================================================== */
exports.createProject = async (req, res, next) => {
  try {
    const { name, description = "", channelId } = req.body;

    if (!name || name.trim().length < 3) {
      throw new AppError("Project name must be at least 3 characters", 400);
    }

    validateObjectId(channelId, "Channel ID");

    const channel = await Channel.findById(channelId);
    if (!channel) throw new AppError("Channel not found", 404);

    const isMember = channel.members.some(
      m => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    const project = await Project.create({
      name: sanitizeHtml(name.trim(), { allowedTags: [] }),
      description: sanitizeHtml(description.trim(), { allowedTags: [] }),
      channel: channelId,
      createdBy: req.user.id,
      members: channel.members.map(m => m.user)
    });

    const board = await Board.create({
      project: project._id,
      createdBy: req.user.id
    });

    await Column.insertMany([
      { board: board._id, title: "ToDo", order: 0 },
      { board: board._id, title: "In Progress", order: 1 },
      { board: board._id, title: "Completed", order: 2 }
    ]);

    res.status(201).json({ success: true, data: project });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   GET PROJECTS (WITH REAL STATS)
===================================================== */
exports.getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      isArchived: false
    })
      .populate("channel")
      .populate("createdBy", "name avatar role")
      .populate("members", "name avatar role")
      .lean();

      const filteredProjects = [];

      for (const project of projects) {
        if (await useAccessProject(project, req.user)) {
          filteredProjects.push(project);
        }
      }

    const projectIds = filteredProjects.map(p => p._id);

    const tasks = await Task.find({
      project: { $in: projectIds },
      isDeleted: false
    })
      .populate("column", "title")
      .lean();

    const enriched = filteredProjects.map(project => {
      const projectTasks = tasks.filter(
        t => t.project.toString() === project._id.toString()
      );

      const totalTasks = projectTasks.length;

      const completedTasks = projectTasks.filter(
        t => t.column?.title === "Completed"
      ).length;

      return {
        ...project,
        stats: {
          totalTasks,
          completedTasks,
          completionPercentage:
            totalTasks === 0
              ? 0
              : Math.round((completedTasks / totalTasks) * 100)
        }
      };
    });

    res.status(200).json({ success: true, data: enriched });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   GET PROJECT BY ID
===================================================== */
exports.getProjectById = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    validateObjectId(projectId, "Project ID");

    const project = await Project.findById(projectId)
      .populate("channel", "name")
      .populate("createdBy", "name email avatar role")
      .populate("members", "name avatar role");

    if (!project) throw new AppError("Project not found", 404);

    if (!(await useAccessProject(project, req.user))) {
      throw new AppError("Access denied", 403);
    }

    const board = await Board.findOne({ project: projectId });

    res.status(200).json({
      success: true,
      data: { project, board }
    });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   ARCHIVE PROJECT
===================================================== */
exports.archiveProject = async (req, res, next) => {
  try {
    const projectId = req.params.id;

    validateObjectId(projectId, "Project ID");

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    if (project.createdBy.toString() !== req.user.id && req.user.role !== "Admin") {
      throw new AppError("Only project owner can archive", 403);
    }

    project.isArchived = true;
    await project.save();

    res.status(200).json({ success: true });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   PROJECT OVERVIEW DASHBOARD
===================================================== */
exports.getProjectOverview = async (req, res, next) => {
  try {
    const projects = await Project.find({
      members: req.user.id,
      isArchived: { $ne: true }
    }).lean();

    const tasks = await Task.find({
      assignees: req.user.id,
      isDeleted: { $ne: true }
    }).lean();

    res.status(200).json({
      totalProjects: projects.length,
      totalTasks: tasks.length,
      recentProjects: projects
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    });

  } catch (err) {
    next(err);
  }
};
