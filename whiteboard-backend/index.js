const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();

// CORS configuration for frontend domains
app.use(cors({
  origin: [
    'https://collaborative-whiteboard-murex.vercel.app',
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
      'https://collaborative-whiteboard-murex.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    methods: ['GET', 'POST']
  }
});

// In-memory storage for rooms and user sessions
const rooms = new Map();
const userSessions = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Register new user with username
  socket.on('register-user', (data) => {
    const { username } = data;
    userSessions.set(socket.id, { username, currentRoom: null });
    socket.emit('registration-success', { username });
  });

  // Send list of public rooms
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
  });

  // Create new room with specified settings
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

    // Set creator as owner with full permissions
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

  // Join existing room with password validation
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

    // Validate password for protected rooms
    if (room.password && room.password !== password) {
      socket.emit('error', { message: 'Incorrect password' });
      return;
    }

    // Leave current room if user is already in one
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

    // Add user to new room
    room.users.set(socket.id, {
      username: user.username,
      permission: room.defaultPermission,
      isOwner: false
    });

    socket.join(roomId);
    user.currentRoom = roomId;

    // Send room data including canvas state
    socket.emit('room-joined', {
      roomId,
      roomName: room.name,
      permission: room.defaultPermission,
      isOwner: false,
      canvasState: room.canvasState
    });

    // Notify other users in room
    socket.to(roomId).emit('user-joined', {
      username: user.username,
      userCount: room.users.size
    });

    console.log(`${user.username} joined room: ${room.name}`);
  });

  // Change user permissions (owner only)
  socket.on('change-permission', (data) => {
    const { targetUserId, newPermission } = data;
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;

    if (!room || room.owner !== socket.id) {
      socket.emit('error', { message: 'Only room owner can change permissions' });
      return;
    }

    const targetUser = room.users.get(targetUserId);
    if (!targetUser) {
      socket.emit('error', { message: 'User not found in room' });
      return;
    }

    targetUser.permission = newPermission;
    
    // Notify target user of permission change
    io.to(targetUserId).emit('permission-changed', {
      newPermission,
      changedBy: user.username
    });

    socket.emit('permission-change-success', {
      targetUsername: targetUser.username,
      newPermission
    });
  });

  // Canvas object operations with permission validation
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

    // Update object in canvas state
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

  // Real-time drawing synchronization with permission checks
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

  // Clear entire canvas
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

  // Get room users for permission management (owner only)
  socket.on('get-room-users', () => {
    const user = userSessions.get(socket.id);
    const room = user ? rooms.get(user.currentRoom) : null;

    if (!room || room.owner !== socket.id) {
      socket.emit('error', { message: 'Only room owner can view user list' });
      return;
    }

    const users = Array.from(room.users.entries()).map(([socketId, userData]) => ({
      socketId,
      username: userData.username,
      permission: userData.permission,
      isOwner: userData.isOwner
    }));

    socket.emit('room-users', users);
  });

  // Handle user disconnection and cleanup
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

        // Clean up empty rooms
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

// Generate unique room identifier
function generateRoomId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
