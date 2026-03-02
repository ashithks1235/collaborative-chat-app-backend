const Note = require("../models/noteModel");

exports.getMyNotes = async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user.id })
      .sort({ pinned: -1, updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getNoteById = async (req, res) => {
  const note = await Note.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!note) return res.status(404).json({ message: "Note not found" });

  res.json(note);
};

exports.createNote = async (req, res) => {
  try {
    const note = await Note.create({
      user: req.user.id,
      title: req.body.title,
      content: req.body.content,
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteNote = async (req, res) => {
  await Note.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  res.json({ message: "Note deleted" });
};
