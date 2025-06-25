const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

// Add CORS configuration
app.use(cors({
  origin: [
    'https://collaborative-whiteboard-murex.vercel.app', // No trailing slash
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'https://collaborative-whiteboard-murex.vercel.app', // No trailing slash
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    methods: ['GET', 'POST']
  }
});

// Store rooms and their data
const rooms = new Map();
const userSessions = new Map(); // Track user sessions

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User registration
  socket.on('register-user', (data) => {
    const { username } = data;
    userSessions.set(socket.id, { username, currentRoom: null });
    socket.emit('registration-success', { username });
    console.log(`User registered: ${username} (${socket.id})`);
  });

  // Get public rooms list
  socket.on('get-rooms', () => {
    const publicRooms = Array.from(rooms.values())
      .filter(room => !room.isPrivate)
      .map(room => ({
        id: room.id,
        name: room.name,
        userCount: room.users.size,
        hasPassword: !!room.password
      }));
    
    socket.emit('rooms-list', publicRooms);
    console.log(`Sent rooms list to ${socket.id}:`, publicRooms.length, 'rooms');
  });

  // Create room
  socket.on('create-room', (data) => {
    const { roomName, isPrivate, password, defaultPermission } = data;
    const user = userSessions.get(socket.id);
    
    if (!user) {
      socket.emit('error', { message: 'Please register first' });
      return;
    }

    const roomId = generateRoomId();
    const room = {
      id: roomId,
      name: roomName,
      isPrivate: isPrivate || false,
      password: password || null,
      owner: socket.id,
      canvasState: [],
      users: new Map(),
      defaultPermission: defaultPermission || 'edit'
    };

    // Add creator as owner with edit permission
    room.users.set(socket.id, {
      username: user.username,
      permission: 'edit',
      isOwner: true
    });

    rooms.set(roomId, room);
    socket.join(roomId);
    user.currentRoom = roomId;

    socket.emit('room-created', {
      roomId,
      roomName,
      permission: 'edit',
      isOwner: true
    });

    console.log(`Room created: ${roomName} (${roomId}) by ${user.username}`);
  });

  // Join room
  socket.on('join-room', (data) => {
    const { roomId, password } = data;
    const user = userSessions.get(socket.id);
    
    if (!user) {
      socket.emit('error', { message: 'Please register first' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Check password if required
    if (room.password && room.password !== password) {
      socket.emit('error', { message: 'Incorrect password' });
      return;
    }

    // Leave current room if in one
    if (user.currentRoom) {
      socket.leave(user.currentRoom);
      const currentRoom = rooms.get(user.currentRoom);
      if (currentRoom) {
        currentRoom.users.delete(socket.id);
        socket.to(user.currentRoom).emit('user-left', {
          username: user.username,
          userCount: currentRoom.users.size
        });
      }
    }

    // Join new room
    room.users.set(socket.id, {
      username: user.username,
      permission: room.defaultPermission,
      isOwner: false
    });

    socket.join(roomId);
    user.currentRoom = roomId;

    // Send room data to user
    socket.emit('room-joined', {
      roomId,
      roomName: room.name,
      permission: room.defaultPermission,
      isOwner: false,
      canvasState: room.canvasState
    });

    // Notify others in room
    socket.to(roomId).emit('user-joined', {
      username: user.username,
      userCount: room.users.size
    });

    console.log(`${user.username} joined room: ${room.name}`);
  });

  // Canvas operations with permission checks
  socket.on('add-object', (data) => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;
    const userInRoom = room ? room.users.get(socket.id) : null;

    if (!userInRoom || userInRoom.permission !== 'edit') {
      socket.emit('error', { message: 'No edit permission' });
      return;
    }

    room.canvasState.push(data);
    socket.to(user.currentRoom).emit('add-object', data);
  });

  socket.on('modify-object', (data) => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;
    const userInRoom = room ? room.users.get(socket.id) : null;

    if (!userInRoom || userInRoom.permission !== 'edit') {
      socket.emit('error', { message: 'No edit permission' });
      return;
    }

    const index = room.canvasState.findIndex(obj => obj.id === data.id);
    if (index !== -1) {
      room.canvasState[index] = data;
    }
    socket.to(user.currentRoom).emit('modify-object', data);
  });

  socket.on('remove-object', (data) => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;
    const userInRoom = room ? room.users.get(socket.id) : null;

    if (!userInRoom || userInRoom.permission !== 'edit') {
      socket.emit('error', { message: 'No edit permission' });
      return;
    }

    room.canvasState = room.canvasState.filter(obj => obj.id !== data.id);
    socket.to(user.currentRoom).emit('remove-object', data);
  });

  // Drawing events with permission checks
  socket.on('drawing-start', (data) => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;
    const userInRoom = room ? room.users.get(socket.id) : null;

    if (!userInRoom || userInRoom.permission !== 'edit') {
      return;
    }

    socket.to(user.currentRoom).emit('drawing-start', data);
  });

  socket.on('drawing-path', (data) => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;
    const userInRoom = room ? room.users.get(socket.id) : null;

    if (!userInRoom || userInRoom.permission !== 'edit') {
      return;
    }

    socket.to(user.currentRoom).emit('drawing-path', data);
  });

  socket.on('drawing-end', (data) => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;
    const userInRoom = room ? room.users.get(socket.id) : null;

    if (!userInRoom || userInRoom.permission !== 'edit') {
      return;
    }

    socket.to(user.currentRoom).emit('drawing-end', data);
  });

  socket.on('clear-canvas', () => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;
    const userInRoom = room ? room.users.get(socket.id) : null;

    if (!userInRoom || userInRoom.permission !== 'edit') {
      socket.emit('error', { message: 'No edit permission' });
      return;
    }

    room.canvasState = [];
    socket.to(user.currentRoom).emit('clear-canvas');
  });

  socket.on('disconnect', () => {
    const user = userSessions.get(socket.id);
    if (user && user.currentRoom) {
      const room = rooms.get(user.currentRoom);
      if (room) {
        room.users.delete(socket.id);
        socket.to(user.currentRoom).emit('user-left', {
          username: user.username,
          userCount: room.users.size
        });

        // Delete room if empty and owner left
        if (room.users.size === 0) {
          rooms.delete(user.currentRoom);
          console.log(`Room deleted: ${room.name}`);
        }
      }
    }
    userSessions.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

function generateRoomId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
