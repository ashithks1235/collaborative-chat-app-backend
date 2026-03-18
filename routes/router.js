const express = require("express");

const authController = require("../controllers/auth.controller");
const channelController = require("../controllers/channel.controller");
const messageController = require("../controllers/message.controller");
const taskController = require("../controllers/task.controller");
const analyticsController = require("../controllers/analytics.controller");
const adminController = require("../controllers/admin.controller");
const userController = require("../controllers/user.controller");
const projectController = require("../controllers/project.controller")
const dashboardController = require("../controllers/dashboard.controller");
const notificationController = require("../controllers/notification.controller");
const reminderController = require('../controllers/reminder.controller')
const libraryController = require("../controllers/library.controller");
const noteController = require("../controllers/note.controller");
const focusController = require("../controllers/focus.controller");
const upload = require("../middleware/upload.middleware");
const activityController = require("../controllers/activity.controller");
const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");
const { validateLogin } = require("../middleware/validate.middleware");
const taskCommentController = require("../controllers/taskComment.controller");
const router = new express.Router();
/* ===========================
   AUTH (Public)
=========================== */

router.post("/auth/register", authController.register);
router.post("/auth/login", validateLogin ,authController.login);
router.post("/auth/forgot-password", authController.forgotPassword);

/* ===========================
   USERS (Authenticated – Members Panel)
=========================== */

router.get("/users", authMiddleware, userController.getAllUsers);
router.post(
  "/users/request-delete",
  authMiddleware,
  userController.requestDeleteOtp
);
router.post(
  "/users/confirm-delete",
  authMiddleware,
  userController.confirmDeleteAccount
);
/* ===========================
   CURRENT USER (SESSION RESTORE)
=========================== */

router.get("/users/me", authMiddleware, userController.getMe);
router.put(
  "/users/me",
  authMiddleware,
  upload.single("avatar"),
  userController.updateMe
);
router.put("/users/change-password", authMiddleware, userController.changePassword);

/* ===========================
   DASHBOARD
=========================== */

router.get("/dashboard", authMiddleware, dashboardController.getDashboard);

/* ===========================
   Todays focus
=========================== */

router.get("/focus/today", authMiddleware, focusController.getTodayFocus);

/* ===========================
   LIBRARY
=========================== */

router.get("/library", authMiddleware, libraryController.getFiles);
router.delete(
  "/library/:id",
  authMiddleware,
  libraryController.deleteFromLibrary
);
router.post(
  "/library/delete-many",
  authMiddleware,
  libraryController.deleteMany
);

/* ===========================
   CHANNELS
=========================== */

router.get("/channels", authMiddleware, channelController.getChannels);
router.post("/channels", authMiddleware,roleMiddleware(["Admin", "Moderator"]), channelController.createChannel);
router.get("/channels/:id", authMiddleware, channelController.getChannelById);

router.post(
  "/channels/:id/members",
  authMiddleware,
  roleMiddleware(["Moderator"]),
  channelController.addMemberToChannel
);

router.get(
  "/channels/:channelId/activity",
  authMiddleware,
  activityController.getChannelActivity
);

router.patch(
  "/channels/:id/promote/:userId",
  authMiddleware,
  channelController.promoteToAdmin
);

router.delete(
  "/channels/:id/members/:userId",
  authMiddleware,
  channelController.removeMember
);

router.post(
  "/channels/:channelId/pin/:messageId",
  authMiddleware,
  roleMiddleware(["Moderator"]),
  channelController.pinMessage
);

router.delete(
  "/channels/:channelId/unpin",
  authMiddleware,
  roleMiddleware(["Moderator"]),
  channelController.unpinMessage
);

/* ===========================
   MESSAGES
=========================== */

router.get(
  "/messages/search",
  authMiddleware,
  messageController.searchMessages
);

// Get paginated messages
router.get(
  "/messages/:channelId",
  authMiddleware,
  messageController.getMessages
);

// Send message (with attachments)
router.post(
  "/messages",
  authMiddleware,
  upload.array("files"),
  messageController.sendMessage
);

// Toggle reaction
router.post(
  "/messages/:messageId/react",
  authMiddleware,
  messageController.toggleReaction
);

// Edit message
router.put(
  "/messages/:messageId",
  authMiddleware,
  messageController.editMessage
);

// Soft delete message
router.delete(
  "/messages/:messageId",
  authMiddleware,
  messageController.deleteMessage
);

router.put(
  "/messages/:messageId/pin",
  authMiddleware,
  messageController.togglePin
);

/* ===========================
   THREADS
=========================== */

router.post(
  "/messages/:messageId/reply",
  authMiddleware,
  messageController.addThreadReply
);

router.get(
  "/messages/:messageId/replies",
  authMiddleware,
  messageController.getThreadReplies
);

router.put(
  "/messages/:messageId/mark-thread-read",
  authMiddleware,
  messageController.markThreadRead
);

/* ===========================
   TASKS (KANBAN VERSION)
=========================== */

// Get Kanban board (columns + tasks) for project
router.get(
  "/projects/:projectId/tasks",
  authMiddleware,
  taskController.getTasks
);

// Create task (goes to ToDo column)
router.post(
  "/projects/:projectId/tasks",
  authMiddleware,
  roleMiddleware(["Moderator"]),
  taskController.createTask
);

// Move task (drag & drop between columns)
router.put(
  "/tasks/:taskId/move",
  authMiddleware,
  taskController.moveTask
);

// Delete task (soft delete)
router.delete(
  "/tasks/:taskId",
  authMiddleware,
  taskController.deleteTask
);

// Get tasks assigned to current user
router.get(
  "/tasks/my",
  authMiddleware,
  taskController.getMyTasks
);

// Convert message to task (goes to ToDo)
router.post(
  "/messages/:messageId/convert-to-task",
  authMiddleware,
  roleMiddleware(["Moderator"]),
  taskController.convertMessageToTask
);

router.get(
  "/tasks/:taskId/comments",
  authMiddleware,
  taskCommentController.getTaskComments
);

router.post(
  "/tasks/:taskId/comments",
  authMiddleware,
  taskCommentController.addTaskComment
);

router.post(
  "/comments/:commentId/convert-to-task",
  authMiddleware,
  taskCommentController.convertCommentToTask
);

router.patch(
  "/subtasks/:taskId/toggle",
  authMiddleware,
  taskController.toggleSubtask
);

router.get(
  "/tasks/:taskId/subtasks",
  authMiddleware,
  taskController.getSubtasks
);

router.put("/tasks/:taskId", authMiddleware, taskController.updateTask);

/* ===========================
   ANALYTICS
=========================== */

router.get(
  "/analytics",
  authMiddleware,
  analyticsController.getAnalytics
);

/* ===========================
   NOTIFICATION
=========================== */

router.get(
  "/notifications",
  authMiddleware,
  notificationController.getNotifications
);

router.get(
  "/notifications/unread-count",
  authMiddleware,
  notificationController.getUnreadCount
);

router.put(
  "/notifications/:id/read",
  authMiddleware,
  notificationController.markAsRead
);

router.put(
  "/notifications/read-all",
  authMiddleware,
  notificationController.markAllAsRead
);

router.delete(
  "/notifications/:id",
  authMiddleware,
  notificationController.deleteNotification
);

/* ===========================
   REMINDERS
=========================== */

router.get("/reminders", authMiddleware, reminderController.getReminders);

router.post("/reminders", authMiddleware, reminderController.createReminder);


/* ===========================
   PROJECT
=========================== */

router.post("/projects", authMiddleware, roleMiddleware(["Admin", "Moderator"]), projectController.createProject);
router.get("/projects", authMiddleware, projectController.getProjects);
router.get(
  "/projects/overview",
  authMiddleware,
  projectController.getProjectOverview
);
router.get("/projects/:id", authMiddleware, projectController.getProjectById);

/* ===========================
   NOTES (Personal)
=========================== */

router.get("/notes", authMiddleware, noteController.getMyNotes);
router.post("/notes", authMiddleware, noteController.createNote);
router.get("/notes/:id", authMiddleware, noteController.getNoteById);
router.put("/notes/:id", authMiddleware, noteController.updateNote);
router.delete("/notes/:id", authMiddleware, noteController.deleteNote);

/* ===========================
   ADMIN (Role: Admin)
=========================== */

router.get(
  "/admin/users",
  authMiddleware,
  roleMiddleware(["Admin"]),
  adminController.getUsers
);

router.put(
  "/admin/users/:id/activate",
  authMiddleware,
  roleMiddleware(["Admin"]),
  adminController.activateUser
);

router.delete(
  "/admin/users/:id",
  authMiddleware,
  roleMiddleware(["Admin"]),
  adminController.deleteUser
);

router.put(
  "/admin/users/:id/deactivate",
  authMiddleware,
  roleMiddleware(["Admin"]),
  adminController.deactivateUser
);

router.put(
  "/admin/users/:id/role",
  authMiddleware,
  roleMiddleware(["Admin"]),
  adminController.changeUserRole
);

router.get(
  "/admin/overview",
  authMiddleware,
  roleMiddleware(["Admin"]),
  adminController.getAdminOverview
);

router.get(
  "/admin/channels",
  authMiddleware,
  roleMiddleware(["Admin"]),
  adminController.getAllChannelsAdmin
);


module.exports = router;
