const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Store canvas state for new connections
let canvasState = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current canvas state to newly connected user
  socket.emit('canvas-state', canvasState);

  // Object synchronization handlers
  socket.on('add-object', (data) => {
    canvasState.push(data);
    socket.broadcast.emit('add-object', data);
  });

  socket.on('modify-object', (data) => {
    const index = canvasState.findIndex(obj => obj.id === data.id);
    if (index !== -1) {
      canvasState[index] = data;
    }
    socket.broadcast.emit('modify-object', data);
  });

  socket.on('remove-object', (data) => {
    canvasState = canvasState.filter(obj => obj.id !== data.id);
    socket.broadcast.emit('remove-object', data);
  });

  // Drawing path handlers (works for both pen and eraser)
  socket.on('drawing-start', (data) => {
    socket.broadcast.emit('drawing-start', data);
  });

  socket.on('drawing-path', (data) => {
    socket.broadcast.emit('drawing-path', data);
  });

  socket.on('drawing-end', (data) => {
    socket.broadcast.emit('drawing-end', data);
  });

  // Clear canvas
  socket.on('clear-canvas', () => {
    canvasState = [];
    socket.broadcast.emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(4000, () => {
  console.log('Server running on port 4000');
});
