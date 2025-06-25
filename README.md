#  Collaborative Whiteboard

A real-time collaborative whiteboard application that allows multiple users to draw, create shapes, and collaborate on a shared canvas in real-time. Built with **React**, **Socket.IO**, and **Fabric.js** for seamless multi-user drawing experiences.

---

##  Project Description

The Collaborative Whiteboard is a web-based platform designed for teams to work together on a shared digital canvas.

Users can:
- Create or join rooms
- Draw using multiple tools
- Add shapes and text
- See changes from other users in real-time

It features **user permission management**, allowing room owners to control who can edit or view the canvas.

---

##  Key Features

###  User Management
- Custom usernames and registration
- Create rooms with public/private settings
- Password-protected rooms
- Permission-based access control (edit/view-only)
- Real-time user presence indicators

###  Drawing Tools
- Freehand pen tool (custom color & stroke width)
- Eraser
- Rectangle and circle tools
- Editable text elements
- Selection and object manipulation

###  Collaboration Features
- Real-time canvas sync across all users
- Live path drawing & object updates
- Synchronized canvas clearing
- User join/leave notifications

###  Export & Save Options
- Export as PNG and JPEG images
- Export as PDF with metadata
- Export/import canvas data as JSON

###  Room Management
- Public & private room creation
- Password protection
- Room owner controls (edit/view permissions)
- Default permissions for new users

---

##  Tech Stack

###  Frontend
- **React** (with Hooks)
- **Fabric.js** – Canvas manipulation
- **Socket.IO Client** – Real-time communication
- **CSS3** – Responsive styling
- **Vite** – Fast build & dev server

###  Backend
- **Node.js**
- **Express.js**
- **Socket.IO**
- **CORS**

---

##  Setup Instructions (Local Development)

###  Prerequisites
- Node.js (v14+)
- npm or yarn
- Modern browser (with WebSocket support)

---

###  Backend Setup

bash
```cd backend``` <br>
```npm install``` <br>
```npm install express socket.io cors``` <br>
```node server.js```

Runs on: http://localhost:10000

bash
```cd frontend``` <br>
```npm install``` <br>
```npm install react react-dom socket.io-client``` <br>
```npm install -D vite @vitejs/plugin-react``` <br>
```npm run dev```

Update Socket.IO connection URL in WhiteboardApp.jsx if necessary:

```const socket = io('http://localhost:10000', {``` <br>
  ```transports: ['websocket'],``` <br>
 ``` withCredentials: true``` <br>
```});```

# Running the Full Application
## Terminal 1: Backend
bash
```cd backend``` <br>
```node index.js```

##Terminal 2: Frontend
bash
```cd frontend``` <br>
```npm run dev```

Open your browser at: http://localhost:5173

