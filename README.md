# Collaborative Whiteboard Application

A real-time collaborative whiteboard application built with React, Node.js, Socket.io, and Fabric.js. Multiple users can draw and collaborate on a shared canvas in real-time.

## Features

- **Real-time Collaboration**: Multiple users can draw simultaneously
- **Room Management**: Create and join rooms with password protection
- **Drawing Tools**: Pen, eraser, shapes (rectangle, circle), and text
- **User Permissions**: Edit and view-only access control
- **Export Options**: Save as PNG, JPEG, PDF, or JSON
- **Undo/Redo**: Basic undo functionality

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation & Setup

### Backend Setup
1. Navigate to the backend directory
2. Install dependencies:

```npm install express socket.io cors```

3. Start the server: `node index`

The backend will run on `http://localhost:4000`

### Frontend Setup
1. Navigate to the frontend directory
2. Install dependencies:

```npm install react react-dom socket.io-client fabric```
```npm install -D vite @vitejs/plugin-react```

3. Start the development server: `npm run dev`

The frontend will run on `http://localhost:5173`

## Required Dependencies

### Backend
- `express` - Web application framework
- `socket.io` - Real-time communication server
- `cors` - Cross-origin resource sharing

### Frontend
- `react` - UI framework
- `react-dom` - React DOM rendering
- `socket.io-client` - Socket.io client library
- `fabric` - Canvas manipulation library
- `vite` - Build tool (dev dependency)
- `@vitejs/plugin-react` - Vite React plugin (dev dependency)

## Usage

1. Open `http://localhost:5173` in your browser
2. Enter a username to register
3. Create a new room or join an existing one
4. Start drawing and collaborating in real-time!
