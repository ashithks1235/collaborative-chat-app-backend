const Channel = require("../models/channelModel");

async function useAccessProject(project, user) {
  const channel = await Channel.findById(project.channel);

  const isProjectMember = project.members?.some(
    m => m.toString() === user.id || m._id?.toString() === user.id
  );

  const isChannelMember = channel?.members?.some(
    m => m.user.toString() === user.id
  );

  return isProjectMember || isChannelMember || user.role === "Admin";
}

module.exports = useAccessProject;