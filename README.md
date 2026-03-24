<h1 align="center">CodeTalk Backend 🚀 </h1>

<p align="center">
  CodeTalk Backend is the server-side application powering the real-time collaboration platform. It handles authentication, messaging, project and task management, file handling, and real-time communication using WebSockets.

The backend is designed as a scalable, service-oriented system that connects communication workflows (chat, threads) with execution workflows (tasks, Kanban boards, projects).
</p>

---

## 💻 Technologies
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-222222?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-0C2D1F?style=for-the-badge&logo=mongodb&logoColor=47A248)
![Mongoose](https://img.shields.io/badge/Mongoose-880000?style=for-the-badge&logo=mongoose&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=jsonwebtokens)
![Multer](https://img.shields.io/badge/Multer-FFB703?style=for-the-badge)

---

## ⚙️ Core Responsibilities
- API layer for all frontend interactions
- Real-time communication using Socket.IO
- Business logic for messaging, projects, and tasks
- Authentication and authorization handling
- Database operations and schema management
- File upload handling and media serving

---

## 🏗️ Architecture

- The backend follows a service-oriented architecture:
- Controllers → Handle request/response
- Services → Business logic layer
- Models → Mongoose schemas
- Middleware → Auth, error handling, validation
- Sockets → Real-time events (chat, tasks, notifications)
  
---

## 🔌 Real-time System

- Channel-based messaging rooms
- Project-based task update rooms
- Event-driven updates (message, task, notification)
- Live sync between multiple clients

---

## 📁 Key Modules

- Auth & Access Control
- Channels & Messaging
- Projects & Kanban Tasks
- Notifications
- File Uploads
- Admin & Analytics

---
## 📦 Setup
To run this project in your local enviornment, follow these steps:

1. Clone the repository to your local machine.
2. Run `npm install` in the project directory to install the required dependencies.
3. Run `node index.js` to get the project started.
4. Open `http://localhost:3000` in your web browser to view the app.
