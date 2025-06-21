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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Object synchronization handlers
  socket.on('add-object', (data) => {
    socket.broadcast.emit('add-object', data);
  });

  socket.on('modify-object', (data) => {
    socket.broadcast.emit('modify-object', data);
  });

  socket.on('remove-object', (data) => {
    socket.broadcast.emit('remove-object', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(4000, () => {
  console.log('Server running on port 4000');
});
