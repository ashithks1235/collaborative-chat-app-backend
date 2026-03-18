const Project = require("../models/projectModel");
const Board = require("../models/boardModel");
const Column = require("../models/columnModel");
const Task = require("../models/taskModel");
const Channel = require("../models/channelModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");
const sanitizeHtml = require("sanitize-html");
const useAccessProject = require("../utils/canAccessProject");

/* ================= CREATE PROJECT ================= */

exports.createProject = async (data, user) => {
  const { name, description = "", channelId } = data;

  if (!name || name.trim().length < 3) {
    throw new AppError("Project name must be at least 3 characters", 400);
  }

  validateObjectId(channelId, "Channel ID");

  const channel = await Channel.findById(channelId);
  if (!channel) throw new AppError("Channel not found", 404);

  const isMember = channel.members.some(
    m => m.user.toString() === user.id
  );

  if (!isMember && user.role !== "Admin") {
    throw new AppError("Access denied", 403);
  }

  const project = await Project.create({
    name: sanitizeHtml(name.trim(), { allowedTags: [] }),
    description: sanitizeHtml(description.trim(), { allowedTags: [] }),
    channel: channelId,
    createdBy: user.id,
    members: channel.members.map(m => m.user)
  });

  const board = await Board.create({
    project: project._id,
    createdBy: user.id
  });

  await Column.insertMany([
    { board: board._id, title: "ToDo", order: 0 },
    { board: board._id, title: "In Progress", order: 1 },
    { board: board._id, title: "Completed", order: 2 }
  ]);

  return project;
};

/* ================= GET PROJECTS ================= */

exports.getProjects = async (user) => {
  const projects = await Project.find({ isArchived: false })
    .populate("channel")
    .populate("createdBy", "name avatar role")
    .populate("members", "name avatar role")
    .lean();

  const filtered = [];

  for (const project of projects) {
    if (await useAccessProject(project, user)) {
      filtered.push(project);
    }
  }

  const projectIds = filtered.map(p => p._id);

  const tasks = await Task.find({
    project: { $in: projectIds },
    isDeleted: false
  })
    .populate("column", "title")
    .lean();

  return filtered.map(project => {
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
};

/* ================= GET PROJECT BY ID ================= */

exports.getProjectById = async (projectId, user) => {
  validateObjectId(projectId, "Project ID");

  const project = await Project.findById(projectId)
    .populate("channel", "name")
    .populate("createdBy", "name email avatar role")
    .populate("members", "name avatar role");

  if (!project) throw new AppError("Project not found", 404);

  if (!(await useAccessProject(project, user))) {
    throw new AppError("Access denied", 403);
  }

  const board = await Board.findOne({ project: projectId });

  return { project, board };
};

/* ================= ARCHIVE ================= */

exports.archiveProject = async (projectId, user) => {
  validateObjectId(projectId);

  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);

  if (
    project.createdBy.toString() !== user.id &&
    user.role !== "Admin"
  ) {
    throw new AppError("Only project owner can archive", 403);
  }

  project.isArchived = true;
  await project.save();

  return true;
};

/* ================= OVERVIEW ================= */

exports.getProjectOverview = async (user) => {
  const projects = await Project.find({
    members: user.id,
    isArchived: { $ne: true }
  }).lean();

  const tasks = await Task.find({
    assignees: user.id,
    isDeleted: { $ne: true }
  }).lean();

  return {
    totalProjects: projects.length,
    totalTasks: tasks.length,
    recentProjects: projects
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
  };
};