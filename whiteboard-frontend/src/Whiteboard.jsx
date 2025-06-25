import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import './WhiteboardApp.css';

const WhiteboardApp = () => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const socketRef = useRef(null);
  const nextIdRef = useRef(1);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef(null);

  // User and room states
  const [username, setUsername] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [userPermission, setUserPermission] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // Room management states
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);

  // Export states
  const [showExportModal, setShowExportModal] = useState(false);

  // Form states with empty initial values
  const [roomForm, setRoomForm] = useState({
    roomName: '',
    isPrivate: false,
    password: '',
    defaultPermission: 'edit'
  });

  // Join room states
  const [joinRoomData, setJoinRoomData] = useState({
    roomId: '',
    password: ''
  });

  // Focus states for input fields
  const [focusStates, setFocusStates] = useState({
    username: false,
    roomName: false,
    password: false,
    joinPassword: false
  });

  // Drawing states
  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState('#ffffff');

  // Focus and Blur handlers
  const handleFocus = (fieldName) => {
    setFocusStates(prev => ({
      ...prev,
      [fieldName]: true
    }));
  };

  const handleBlur = (fieldName) => {
    setFocusStates(prev => ({
      ...prev,
      [fieldName]: false
    }));
  };

  // Socket initialization and event handlers
  useEffect(() => {
    socketRef.current = io('http://localhost:10000', {
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('registration-success', (data) => {
      setIsRegistered(true);
      console.log('Registration successful:', data.username);
    });

    socket.on('rooms-list', (rooms) => {
      setAvailableRooms(rooms);
    });

    socket.on('room-created', (data) => {
      setCurrentRoom(data);
      setUserPermission(data.permission);
      setIsOwner(data.isOwner);
      setShowCreateRoom(false);
      setShowRoomModal(false);
    });

    socket.on('room-joined', (data) => {
      setCurrentRoom(data);
      setUserPermission(data.permission);
      setIsOwner(data.isOwner);
      setShowRoomModal(false);
    });

    socket.on('user-joined', (data) => {
      console.log(`${data.username} joined the room`);
    });

    socket.on('user-left', (data) => {
      console.log(`${data.username} left the room`);
    });

    socket.on('permission-changed', (data) => {
      setUserPermission(data.newPermission);
      alert(`Your permission has been changed to ${data.newPermission} by ${data.changedBy}`);
    });

    socket.on('room-users', (users) => {
      setRoomUsers(users);
    });

    socket.on('error', (error) => {
      alert(error.message);
    });

    // Canvas event listeners
    socket.on('add-object', (data) => {
      // Handle canvas object addition
      console.log('Object added:', data);
    });

    socket.on('modify-object', (data) => {
      // Handle canvas object modification
      console.log('Object modified:', data);
    });

    socket.on('remove-object', (data) => {
      // Handle canvas object removal
      console.log('Object removed:', data);
    });

    socket.on('drawing-start', (data) => {
      // Handle drawing start
      console.log('Drawing started:', data);
    });

    socket.on('drawing-path', (data) => {
      // Handle drawing path
      console.log('Drawing path:', data);
    });

    socket.on('drawing-end', (data) => {
      // Handle drawing end
      console.log('Drawing ended:', data);
    });

    socket.on('clear-canvas', () => {
      // Handle canvas clear
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Canvas setup
  useEffect(() => {
    if (canvasRef.current && currentRoom) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Store canvas reference for fabric.js compatibility
      fabricCanvasRef.current = {
        toDataURL: (options = {}) => {
          return canvas.toDataURL(`image/${options.format || 'png'}`, options.quality || 1.0);
        }
      };
    }
  }, [currentRoom]);

  // User registration
  const registerUser = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    socketRef.current.emit('register-user', { username: username.trim() });
  };

  // Room management functions
  const createRoom = () => {
    if (!roomForm.roomName.trim()) {
      alert('Please enter a room name');
      return;
    }
    socketRef.current.emit('create-room', roomForm);
  };

  const joinRoom = (roomId, password = '') => {
    socketRef.current.emit('join-room', { roomId, password });
  };

  const getRooms = () => {
    socketRef.current.emit('get-rooms');
  };

  const getRoomUsers = () => {
    if (isOwner) {
      socketRef.current.emit('get-room-users');
    }
  };

  const changeUserPermission = (targetUserId, newPermission) => {
    if (isOwner) {
      socketRef.current.emit('change-permission', { targetUserId, newPermission });
    }
  };

  // Canvas functions
  const clearCanvas = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    socketRef.current.emit('clear-canvas');
  };

  // Dummy undo/redo functions
  const performUndo = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    clearCanvas();
  };

  const performRedo = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    console.log('Redo clicked (dummy function)');
  };

  // Export functions
  const exportAsImage = (format = 'png') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      alert('No canvas to export');
      return;
    }
    try {
      const dataURL = canvas.toDataURL({
        format: format,
        quality: 1.0,
        multiplier: 2
      });
      const link = document.createElement('a');
      link.download = `whiteboard-${currentRoom?.roomName || 'canvas'}-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowExportModal(false);
      alert(`Canvas exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const exportAsPDF = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      alert('No canvas to export');
      return;
    }
    try {
      const printWindow = window.open('', '_blank');
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 1.0,
        multiplier: 2
      });
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Whiteboard Export</title>
          <style>
            body { margin: 0; padding: 20px; text-align: center; }
            img { max-width: 100%; height: auto; }
            .header { margin-bottom: 20px; font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Collaborative Whiteboard</h2>
            <p>Created by: ${username} | Date: ${new Date().toLocaleDateString()}</p>
          </div>
          <img src="${dataURL}" alt="Whiteboard Canvas" />
        </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
      setShowExportModal(false);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF export failed. Please try again.');
    }
  };

  // Drawing functions
  const startDrawing = (e) => {
    if (userPermission !== 'edit') return;
    
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
<<<<<<< HEAD
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
=======
    input.click();
  };

  // Initialize socket
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL, {
  transports: ['websocket', 'polling']
});
    socketRef.current = socket;

    socket.on('registration-success', (data) => {
      setIsRegistered(true);
      setUsername(data.username);
    });

    socket.on('rooms-list', (rooms) => {
      setAvailableRooms(rooms);
    });

    socket.on('room-created', (data) => {
      setCurrentRoom(data);
      setUserPermission(data.permission);
      setIsOwner(data.isOwner);
      setShowRoomModal(false);
      setShowCreateRoom(false);
    });

    socket.on('room-joined', (data) => {
      setCurrentRoom(data);
      setUserPermission(data.permission);
      setIsOwner(data.isOwner);
      setShowRoomModal(false);
    });

    socket.on('permission-changed', (data) => {
      setUserPermission(data.newPermission);
      alert(`Your permission changed to: ${data.newPermission} by ${data.changedBy}`);
    });

    socket.on('room-users', (users) => {
      setRoomUsers(users);
    });

    socket.on('error', (data) => {
      alert(data.message);
    });

    socket.on('add-object', (data) => {
      addObjectFromData(data, true);
    });

    socket.on('modify-object', (data) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      
      const obj = canvas.getObjects().find(o => o.id === data.id);
      if (obj) {
        obj.noEmit = true;
        obj.set(data.obj);
        obj.setCoords();
        canvas.renderAll();
        obj.noEmit = false;
      }
    });

    socket.on('remove-object', (data) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      
      const obj = canvas.getObjects().find(o => o.id === data.id);
      if (obj) {
        obj.noEmit = true;
        canvas.remove(obj);
        obj.noEmit = false;
      }
    });

    socket.on('drawing-start', (data) => {
      startRemoteDrawing(data);
    });

    socket.on('drawing-path', (data) => {
      updateRemoteDrawing(data);
    });

    socket.on('drawing-end', (data) => {
      endRemoteDrawing(data);
    });

    socket.on('clear-canvas', () => {
      const canvas = fabricCanvasRef.current;
      if (canvas) {
        canvas.clear();
        canvas.backgroundColor = 'white';
        canvas.renderAll();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Initialize canvas when room is available
  useEffect(() => {
    if (!currentRoom || typeof window.fabric === 'undefined') {
      return;
    }

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    const timer = setTimeout(() => {
      if (canvasRef.current) {
        const canvas = new window.fabric.Canvas(canvasRef.current, {
          width: 800,
          height: 600,
          backgroundColor: 'white'
        });
        
        fabricCanvasRef.current = canvas;
        setupCanvasEvents(canvas);
        
        if (currentRoom.canvasState && currentRoom.canvasState.length > 0) {
          currentRoom.canvasState.forEach(objData => {
            addObjectFromData(objData, true);
          });
        }
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [currentRoom]);

  const setupCanvasEvents = (canvas) => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleAdd = (e) => {
      if (!e.target || e.target.noEmit || userPermission !== 'edit') return;
      e.target.id = `${socket.id}_obj_${nextIdRef.current++}`;
      const payload = {
        id: e.target.id,
        obj: e.target.toObject([
          'left', 'top', 'width', 'height',
          'radius', 'fill', 'stroke', 'strokeWidth', 'text',
          'scaleX', 'scaleY', 'angle', 'rx', 'ry'
        ])
      };
      socket.emit('add-object', payload);
    };

    const handleModify = (e) => {
      if (!e.target || e.target.noEmit || userPermission !== 'edit') return;
      socket.emit('modify-object', {
        id: e.target.id,
        obj: e.target.toObject([
          'left', 'top', 'width', 'height',
          'radius', 'fill', 'stroke', 'strokeWidth', 'text',
          'scaleX', 'scaleY', 'angle', 'rx', 'ry'
        ])
      });
    };

    const handleRemove = (e) => {
      if (!e.target || e.target.noEmit || userPermission !== 'edit') return;
      socket.emit('remove-object', { id: e.target.id });
    };

    const handleTextChanged = (e) => {
      if (!e.target || e.target.noEmit || userPermission !== 'edit') return;
      socket.emit('modify-object', {
        id: e.target.id,
        obj: e.target.toObject([
          'left', 'top', 'width', 'height',
          'radius', 'fill', 'stroke', 'strokeWidth', 'text',
          'scaleX', 'scaleY', 'angle', 'rx', 'ry'
        ])
      });
    };

    canvas.on('object:added', handleAdd);
    canvas.on('object:modified', handleModify);
    canvas.on('object:removed', handleRemove);
    canvas.on('text:changed', handleTextChanged);
    canvas.on('text:editing:exited', handleTextChanged);
  };

  // Set up drawing mode
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const socket = socketRef.current;
>>>>>>> parent of 466632e (firse koshish)
    
    socketRef.current.emit('drawing-start', { x, y, tool: selectedTool, color: strokeColor, width: strokeWidth });
  };

  const draw = (e) => {
    if (!isDrawingRef.current || userPermission !== 'edit') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = selectedTool === 'eraser' ? '#ffffff' : strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    socketRef.current.emit('drawing-path', { x, y });
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    
    isDrawingRef.current = false;
    socketRef.current.emit('drawing-end', {});
  };

  return (
    <div className="whiteboard-app">
      {/* User Registration */}
      {!isRegistered && (
        <div className="registration-modal">
          <div className="modal-content">
            <h2>Welcome to Collaborative Whiteboard</h2>
            <div className="input-group">
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => handleFocus('username')}
                onBlur={() => handleBlur('username')}
                className={`form-input ${focusStates.username ? 'focused' : ''}`}
                onKeyPress={(e) => e.key === 'Enter' && registerUser()}
              />
              {focusStates.username && (
                <div className="input-hint">Choose a unique username for collaboration</div>
              )}
            </div>
            <button onClick={registerUser} className="btn btn-primary">
              Join Whiteboard
            </button>
          </div>
        </div>
      )}

      {/* Room Selection Modal */}
      {isRegistered && !currentRoom && showRoomModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Join or Create Room</h2>
            
            {/* Available Rooms */}
            <div className="rooms-section">
              <h3>Available Rooms</h3>
              <button onClick={getRooms} className="btn btn-secondary">
                Refresh Rooms
              </button>
              <div className="rooms-list">
                {availableRooms.map(room => (
                  <div key={room.id} className="room-item">
                    <div className="room-info">
                      <strong>{room.name}</strong>
                      <span>({room.userCount} users)</span>
                      {room.hasPassword && <span className="password-indicator">🔒</span>}
                    </div>
                    {room.hasPassword ? (
                      <div className="password-join">
                        <input
                          type="password"
                          placeholder="Enter room password"
                          value={joinRoomData.password}
                          onChange={(e) => setJoinRoomData({...joinRoomData, password: e.target.value})}
                          onFocus={() => handleFocus('joinPassword')}
                          onBlur={() => handleBlur('joinPassword')}
                          className={`form-input ${focusStates.joinPassword ? 'focused' : ''}`}
                        />
                        <button 
                          onClick={() => joinRoom(room.id, joinRoomData.password)}
                          className="btn btn-primary"
                        >
                          Join
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => joinRoom(room.id)}
                        className="btn btn-primary"
                      >
                        Join
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Room */}
            <div className="create-room-section">
              <button 
                onClick={() => setShowCreateRoom(!showCreateRoom)}
                className="btn btn-secondary"
              >
                {showCreateRoom ? 'Cancel' : 'Create New Room'}
              </button>
              
              {showCreateRoom && (
                <div className="create-room-form">
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="Enter room name"
                      value={roomForm.roomName}
                      onChange={(e) => setRoomForm({...roomForm, roomName: e.target.value})}
                      onFocus={() => handleFocus('roomName')}
                      onBlur={() => handleBlur('roomName')}
                      className={`form-input ${focusStates.roomName ? 'focused' : ''}`}
                    />
                    {focusStates.roomName && (
                      <div className="input-hint">Choose a descriptive name for your room</div>
                    )}
                  </div>

                  <div className="checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={roomForm.isPrivate}
                        onChange={(e) => setRoomForm({...roomForm, isPrivate: e.target.checked})}
                      />
                      Private Room
                    </label>
                  </div>

                  <div className="input-group">
                    <input
                      type="password"
                      placeholder="Password (optional)"
                      value={roomForm.password}
                      onChange={(e) => setRoomForm({...roomForm, password: e.target.value})}
                      onFocus={() => handleFocus('password')}
                      onBlur={() => handleBlur('password')}
                      className={`form-input ${focusStates.password ? 'focused' : ''}`}
                    />
                    {focusStates.password && (
                      <div className="input-hint">Leave empty for no password protection</div>
                    )}
                  </div>

                  <select
                    value={roomForm.defaultPermission}
                    onChange={(e) => setRoomForm({...roomForm, defaultPermission: e.target.value})}
                    className="form-select"
                  >
                    <option value="edit">Edit Permission</option>
                    <option value="view">View Only</option>
                  </select>

                  <button onClick={createRoom} className="btn btn-primary">
                    Create Room
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowRoomModal(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Whiteboard Interface */}
      {isRegistered && (
        <div className="whiteboard-container">
          {/* Header */}
          <div className="header">
            <div className="user-info">
              <span>Welcome, {username}</span>
              {currentRoom && (
                <span> | Room: {currentRoom.roomName} | Permission: {userPermission}</span>
              )}
            </div>
            
            <div className="header-actions">
              {!currentRoom ? (
                <button 
                  onClick={() => setShowRoomModal(true)}
                  className="btn btn-primary"
                >
                  Join/Create Room
                </button>
              ) : (
                <>
                  {isOwner && (
                    <button 
                      onClick={getRoomUsers}
                      className="btn btn-secondary"
                    >
                      Manage Users
                    </button>
                  )}
                  <button 
                    onClick={() => setShowExportModal(true)}
                    className="btn btn-secondary"
                  >
                    Export
                  </button>
                  <button 
                    onClick={() => {
                      setCurrentRoom(null);
                      setUserPermission(null);
                      setIsOwner(false);
                    }}
                    className="btn btn-danger"
                  >
                    Leave Room
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Toolbar */}
          {currentRoom && userPermission === 'edit' && (
            <div className="toolbar">
              <div className="tool-group">
                <button 
                  className={`tool-btn ${selectedTool === 'pen' ? 'active' : ''}`}
                  onClick={() => setSelectedTool('pen')}
                >
                  Pen
                </button>
                <button 
                  className={`tool-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
                  onClick={() => setSelectedTool('eraser')}
                >
                  Eraser
                </button>
              </div>

              <div className="tool-group">
                <label>Color:</label>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                />
              </div>

              <div className="tool-group">
                <label>Width:</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                />
                <span>{strokeWidth}px</span>
              </div>

              <div className="tool-group">
                <button onClick={performUndo} className="btn btn-secondary">
                  Undo
                </button>
                <button onClick={performRedo} className="btn btn-secondary">
                  Redo
                </button>
                <button onClick={clearCanvas} className="btn btn-danger">
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="canvas-container">
            {currentRoom ? (
              <canvas
                ref={canvasRef}
                className="whiteboard-canvas"
                width={1200}
                height={600}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            ) : (
              <div className="no-room-message">
                <h3>No Room Selected</h3>
                <p>Join or create a room to start collaborating</p>
                <button 
                  onClick={() => setShowRoomModal(true)}
                  className="btn btn-primary"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>

          {/* Room Users Management (Owner Only) */}
          {isOwner && roomUsers.length > 0 && (
            <div className="users-panel">
              <h3>Room Users</h3>
              {roomUsers.map(user => (
                <div key={user.socketId} className="user-item">
                  <span>{user.username}</span>
                  <span className={`permission ${user.permission}`}>
                    {user.permission}
                  </span>
                  {!user.isOwner && (
                    <select
                      value={user.permission}
                      onChange={(e) => changeUserPermission(user.socketId, e.target.value)}
                      className="permission-select"
                    >
                      <option value="edit">Edit</option>
                      <option value="view">View</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Export Whiteboard</h2>
            <div className="export-options">
              <button 
                onClick={() => exportAsImage('png')}
                className="btn btn-primary"
              >
                Export as PNG
              </button>
              <button 
                onClick={() => exportAsImage('jpeg')}
                className="btn btn-primary"
              >
                Export as JPEG
              </button>
              <button 
                onClick={exportAsPDF}
                className="btn btn-primary"
              >
                Export as PDF
              </button>
            </div>
            <button 
              onClick={() => setShowExportModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhiteboardApp;
