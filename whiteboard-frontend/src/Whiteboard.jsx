import React, { useState, useRef, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';

function WhiteboardApp() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [username, setUsername] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [permission, setPermission] = useState('view');
  const [isOwner, setIsOwner] = useState(false);

  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Initialize socket with debug logging
  useEffect(() => {
    console.log('API URL:', process.env.NEXT_PUBLIC_API_URL); // Debug log
    
    const socket = io(process.env.NEXT_PUBLIC_API_URL, {
      transports: ['websocket', 'polling']
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected successfully!');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection failed:', error);
    });

    socket.on('registration-success', (data) => {
      setIsRegistered(true);
      setUsername(data.username);
    });

    socket.on('rooms-list', (roomsList) => {
      setRooms(roomsList);
    });

    socket.on('room-created', (data) => {
      setCurrentRoom({
        id: data.roomId,
        name: data.roomName,
        canvasState: []
      });
      setPermission(data.permission);
      setIsOwner(data.isOwner);
    });

    socket.on('room-joined', (data) => {
      setCurrentRoom({
        id: data.roomId,
        name: data.roomName,
        canvasState: data.canvasState || []
      });
      setPermission(data.permission);
      setIsOwner(data.isOwner);
    });

    socket.on('user-joined', (data) => {
      console.log(`${data.username} joined the room`);
    });

    socket.on('user-left', (data) => {
      console.log(`${data.username} left the room`);
    });

    socket.on('permission-changed', (data) => {
      setPermission(data.newPermission);
      alert(`Your permission has been changed to ${data.newPermission} by ${data.changedBy}`);
    });

    socket.on('add-object', (data) => {
      addObjectFromData(data, false);
    });

    socket.on('modify-object', (data) => {
      modifyObjectFromData(data);
    });

    socket.on('remove-object', (data) => {
      removeObjectFromData(data);
    });

    socket.on('drawing-start', (data) => {
      if (fabricCanvasRef.current) {
        const path = new fabric.Path(`M ${data.x} ${data.y}`, {
          stroke: data.color,
          strokeWidth: data.strokeWidth,
          fill: '',
          selectable: false,
          id: data.id
        });
        fabricCanvasRef.current.add(path);
      }
    });

    socket.on('drawing-path', (data) => {
      if (fabricCanvasRef.current) {
        const objects = fabricCanvasRef.current.getObjects();
        const pathObj = objects.find(obj => obj.id === data.id);
        if (pathObj) {
          pathObj.path.push(['L', data.x, data.y]);
          fabricCanvasRef.current.renderAll();
        }
      }
    });

    socket.on('drawing-end', (data) => {
      // Drawing completed
    });

    socket.on('clear-canvas', () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.clear();
        fabricCanvasRef.current.backgroundColor = 'white';
        fabricCanvasRef.current.renderAll();
      }
    });

    socket.on('error', (data) => {
      alert(`Error: ${data.message}`);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
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
        const canvas = new fabric.Canvas(canvasRef.current, {
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
    canvas.on('mouse:down', (e) => {
      if (permission !== 'edit') return;
      
      isDrawingRef.current = true;
      const pointer = canvas.getPointer(e.e);
      lastPosRef.current = { x: pointer.x, y: pointer.y };
      
      if (currentTool === 'pen') {
        const pathId = Date.now().toString();
        socketRef.current?.emit('drawing-start', {
          x: pointer.x,
          y: pointer.y,
          color: currentColor,
          strokeWidth: currentStrokeWidth,
          id: pathId
        });
      }
    });

    canvas.on('mouse:move', (e) => {
      if (!isDrawingRef.current || permission !== 'edit') return;
      
      const pointer = canvas.getPointer(e.e);
      
      if (currentTool === 'pen') {
        socketRef.current?.emit('drawing-path', {
          x: pointer.x,
          y: pointer.y
        });
      }
      
      lastPosRef.current = { x: pointer.x, y: pointer.y };
    });

    canvas.on('mouse:up', () => {
      if (permission !== 'edit') return;
      
      isDrawingRef.current = false;
      
      if (currentTool === 'pen') {
        socketRef.current?.emit('drawing-end', {});
      }
    });

    canvas.on('object:modified', (e) => {
      if (permission !== 'edit') return;
      
      const obj = e.target;
      socketRef.current?.emit('modify-object', {
        id: obj.id,
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle
      });
    });
  };

  const addObjectFromData = (data, isInitial = false) => {
    if (!fabricCanvasRef.current) return;
    
    let obj;
    switch (data.type) {
      case 'rect':
        obj = new fabric.Rect({
          left: data.left,
          top: data.top,
          width: data.width,
          height: data.height,
          fill: data.fill,
          stroke: data.stroke,
          strokeWidth: data.strokeWidth,
          id: data.id
        });
        break;
      case 'circle':
        obj = new fabric.Circle({
          left: data.left,
          top: data.top,
          radius: data.radius,
          fill: data.fill,
          stroke: data.stroke,
          strokeWidth: data.strokeWidth,
          id: data.id
        });
        break;
      case 'text':
        obj = new fabric.Text(data.text, {
          left: data.left,
          top: data.top,
          fontSize: data.fontSize,
          fill: data.fill,
          id: data.id
        });
        break;
    }
    
    if (obj) {
      fabricCanvasRef.current.add(obj);
      if (!isInitial) {
        fabricCanvasRef.current.renderAll();
      }
    }
  };

  const modifyObjectFromData = (data) => {
    if (!fabricCanvasRef.current) return;
    
    const objects = fabricCanvasRef.current.getObjects();
    const obj = objects.find(o => o.id === data.id);
    
    if (obj) {
      obj.set({
        left: data.left,
        top: data.top,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        angle: data.angle
      });
      fabricCanvasRef.current.renderAll();
    }
  };

  const removeObjectFromData = (data) => {
    if (!fabricCanvasRef.current) return;
    
    const objects = fabricCanvasRef.current.getObjects();
    const obj = objects.find(o => o.id === data.id);
    
    if (obj) {
      fabricCanvasRef.current.remove(obj);
      fabricCanvasRef.current.renderAll();
    }
  };

  const handleRegister = () => {
    const usernameInput = document.getElementById('username').value.trim();
    if (usernameInput && socketRef.current) {
      console.log('Registering user:', usernameInput); // Debug log
      socketRef.current.emit('register-user', { username: usernameInput });
    } else {
      alert('Please enter a username and ensure connection is established');
    }
  };

  const handleCreateRoom = () => {
    const roomName = document.getElementById('roomName').value.trim();
    const isPrivate = document.getElementById('isPrivate').checked;
    const password = document.getElementById('roomPassword').value;
    const defaultPermission = document.getElementById('defaultPermission').value;
    
    if (roomName && socketRef.current) {
      console.log('Creating room:', roomName); // Debug log
      socketRef.current.emit('create-room', {
        roomName,
        isPrivate,
        password: password || null,
        defaultPermission
      });
    } else {
      alert('Please enter a room name');
    }
  };

  const handleJoinRoom = (roomId, hasPassword) => {
    console.log('Attempting to join room:', roomId); // Debug log
    
    if (!socketRef.current) {
      alert('Socket not connected. Please refresh the page.');
      return;
    }
    
    if (!socketRef.current.connected) {
      alert('Socket not connected. Please wait and try again.');
      return;
    }
    
    if (hasPassword) {
      const password = prompt('Enter room password:');
      if (!password) return;
      socketRef.current.emit('join-room', { roomId, password });
    } else {
      socketRef.current.emit('join-room', { roomId });
    }
  };

  const handleGetRooms = () => {
    if (socketRef.current) {
      console.log('Fetching rooms list'); // Debug log
      socketRef.current.emit('get-rooms');
    }
  };

  const addShape = (shapeType) => {
    if (permission !== 'edit' || !fabricCanvasRef.current) return;
    
    const id = Date.now().toString();
    let shapeData;
    
    switch (shapeType) {
      case 'rect':
        shapeData = {
          type: 'rect',
          left: 100,
          top: 100,
          width: 100,
          height: 100,
          fill: currentColor,
          stroke: '#000',
          strokeWidth: 2,
          id
        };
        break;
      case 'circle':
        shapeData = {
          type: 'circle',
          left: 100,
          top: 100,
          radius: 50,
          fill: currentColor,
          stroke: '#000',
          strokeWidth: 2,
          id
        };
        break;
      case 'text':
        const text = prompt('Enter text:');
        if (!text) return;
        shapeData = {
          type: 'text',
          text,
          left: 100,
          top: 100,
          fontSize: 20,
          fill: currentColor,
          id
        };
        break;
    }
    
    if (shapeData && socketRef.current) {
      socketRef.current.emit('add-object', shapeData);
      addObjectFromData(shapeData);
    }
  };

  const clearCanvas = () => {
    if (permission !== 'edit') {
      alert('You do not have permission to clear the canvas');
      return;
    }
    
    if (socketRef.current) {
      socketRef.current.emit('clear-canvas');
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.clear();
        fabricCanvasRef.current.backgroundColor = 'white';
        fabricCanvasRef.current.renderAll();
      }
    }
  };

  const deleteSelected = () => {
    if (permission !== 'edit' || !fabricCanvasRef.current) return;
    
    const activeObject = fabricCanvasRef.current.getActiveObject();
    if (activeObject && socketRef.current) {
      socketRef.current.emit('remove-object', { id: activeObject.id });
      fabricCanvasRef.current.remove(activeObject);
    }
  };

  if (!isRegistered) {
    return (
      <div className="login-container">
        <h1>Collaborative Whiteboard</h1>
        <div className="login-form">
          <input
            type="text"
            id="username"
            placeholder="Enter your username"
            onKeyPress={(e) => e.key === 'Enter' && handleRegister()}
          />
          <button onClick={handleRegister}>Join</button>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="room-selection">
        <h1>Welcome, {username}!</h1>
        
        <div className="create-room">
          <h3>Create New Room</h3>
          <input type="text" id="roomName" placeholder="Room name" />
          <label>
            <input type="checkbox" id="isPrivate" />
            Private Room
          </label>
          <input type="password" id="roomPassword" placeholder="Password (optional)" />
          <select id="defaultPermission">
            <option value="edit">Edit Permission</option>
            <option value="view">View Only</option>
          </select>
          <button onClick={handleCreateRoom}>Create Room</button>
        </div>

        <div className="join-room">
          <h3>Available Rooms</h3>
          <button onClick={handleGetRooms}>Refresh Rooms</button>
          <div className="rooms-list">
            {rooms.map(room => (
              <div key={room.id} className="room-item">
                <span>{room.name} ({room.userCount} users)</span>
                <button onClick={() => handleJoinRoom(room.id, room.hasPassword)}>
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="whiteboard-container">
      <div className="header">
        <h2>Room: {currentRoom.name}</h2>
        <div className="user-info">
          <span>User: {username}</span>
          <span>Permission: {permission}</span>
          {isOwner && <span>(Owner)</span>}
        </div>
      </div>

      {permission === 'edit' && (
        <div className="toolbar">
          <div className="tool-group">
            <button
              className={currentTool === 'pen' ? 'active' : ''}
              onClick={() => setCurrentTool('pen')}
            >
              Pen
            </button>
            <button
              className={currentTool === 'select' ? 'active' : ''}
              onClick={() => setCurrentTool('select')}
            >
              Select
            </button>
          </div>

          <div className="tool-group">
            <button onClick={() => addShape('rect')}>Rectangle</button>
            <button onClick={() => addShape('circle')}>Circle</button>
            <button onClick={() => addShape('text')}>Text</button>
          </div>

          <div className="tool-group">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
            />
            <input
              type="range"
              min="1"
              max="20"
              value={currentStrokeWidth}
              onChange={(e) => setCurrentStrokeWidth(parseInt(e.target.value))}
            />
          </div>

          <div className="tool-group">
            <button onClick={deleteSelected}>Delete Selected</button>
            <button onClick={clearCanvas}>Clear Canvas</button>
          </div>
        </div>
      )}

      <div className="canvas-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export default WhiteboardApp;
