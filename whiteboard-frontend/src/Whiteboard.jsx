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

  // Focus states for input fields
  const [focusStates, setFocusStates] = useState({
    username: false,
    roomName: false,
    password: false,
    joinPassword: false
  });

  // Join room states
  const [joinRoomData, setJoinRoomData] = useState({
    roomId: '',
    password: ''
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

    socket.on('error', (error) => {
      alert(error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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

  // Canvas functions
  const clearCanvas = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    socketRef.current.emit('clear-canvas');
  };

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
