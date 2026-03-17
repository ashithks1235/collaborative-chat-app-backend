const multer = require("multer");
const path = require("path");
const fs = require("fs");

/* ==============================
   ENSURE UPLOAD DIRECTORY EXISTS
============================== */
const uploadPath = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

/* ==============================
   STORAGE CONFIG
============================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  }
});

/* ==============================
   FILE FILTER
============================== */
const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  "video/mp4",
  "video/webm",
  "video/ogg",

  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  "text/plain"
];

const allowedExtensions = [
  ".jpg",".jpeg",".png",".webp",".gif",
  ".mp4",".webm",".ogg",
  ".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",".txt"
];

/* ==============================
   MULTER INSTANCE
============================== */
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {

    const ext = path.extname(file.originalname).toLowerCase();

    if (
        allowedTypes.includes(file.mimetype) &&
        allowedExtensions.includes(ext)
        ) {
        cb(null, true);
        } else {
        cb(new Error("Unsupported file type"), false);
        }
  }
});

module.exports = upload;