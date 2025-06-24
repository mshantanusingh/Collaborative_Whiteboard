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

  // Form states
  const [roomForm, setRoomForm] = useState({
    roomName: '',
    isPrivate: false,
    password: '',
    defaultPermission: 'edit'
  });

  // Drawing states
  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState('#ffffff');

  // Dummy undo/redo functions
  const performUndo = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    // Dummy undo: just clear the canvas
    clearCanvas();
  };

  const performRedo = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    // Dummy redo: do nothing for now
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
          <title>Whiteboard - ${currentRoom?.roomName || 'Canvas'}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .header { text-align: center; margin-bottom: 20px; }
            .canvas-image { max-width: 100%; height: auto; border: 1px solid #ddd; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .footer { margin-top: 20px; text-align: center; font-size: 12px; color: #666; }
            @media print { body { margin: 0; padding: 10px; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Collaborative Whiteboard</h1>
            <h2>${currentRoom?.roomName || 'Canvas'}</h2>
            <p>Created by: ${username} | Date: ${new Date().toLocaleDateString()}</p>
          </div>
          <div style="text-align: center;">
            <img src="${dataURL}" alt="Whiteboard Canvas" class="canvas-image" />
          </div>
          <div class="footer">
            <p>Generated from Collaborative Whiteboard App</p>
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Print/Save as PDF</button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Close</button>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      setShowExportModal(false);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF export failed. Please try again.');
    }
  };

  const saveCanvasData = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      alert('No canvas to save');
      return;
    }

    try {
      const canvasData = {
        version: '1.0',
        roomName: currentRoom?.roomName || 'Untitled',
        createdBy: username,
        createdAt: new Date().toISOString(),
        canvasData: canvas.toJSON()
      };

      const jsonString = JSON.stringify(canvasData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = `whiteboard-${currentRoom?.roomName || 'canvas'}-${new Date().toISOString().slice(0, 10)}.json`;
      link.href = url;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      alert('Canvas data saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Save failed. Please try again.');
    }
  };

  const loadCanvasData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          if (data.canvasData) {
            const canvas = fabricCanvasRef.current;
            if (canvas) {
              canvas.loadFromJSON(data.canvasData, () => {
                canvas.renderAll();
                alert(`Canvas loaded: ${data.roomName || 'Untitled'}`);
              });
            }
          } else {
            alert('Invalid canvas file format');
          }
        } catch (error) {
          console.error('Load failed:', error);
          alert('Failed to load canvas file');
        }
      };
      
      reader.readAsText(file);
    };
    
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
    
    if (!canvas || !socket) {
      return;
    }

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('path:created');

    if (userPermission !== 'edit') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      return;
    }

    if (selectedTool === 'pen') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = strokeWidth;
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.selection = false;
      
      const handleDrawingStart = (e) => {
        isDrawingRef.current = true;
        socket.emit('drawing-start', {
          pointer: canvas.getPointer(e.e),
          color: strokeColor,
          width: strokeWidth
        });
      };

      const handleDrawingPath = (e) => {
        if (!isDrawingRef.current) return;
        socket.emit('drawing-path', {
          pointer: canvas.getPointer(e.e)
        });
      };

      const handleDrawingEnd = () => {
        isDrawingRef.current = false;
        socket.emit('drawing-end', {});
      };

      canvas.on('path:created', handleDrawingEnd);
      canvas.on('mouse:down', handleDrawingStart);
      canvas.on('mouse:move', handleDrawingPath);

    } else if (selectedTool === 'eraser') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = strokeWidth * 3;
      canvas.freeDrawingBrush.color = 'white';
      canvas.selection = false;
      
      const handleEraserStart = (e) => {
        isDrawingRef.current = true;
        socket.emit('drawing-start', {
          pointer: canvas.getPointer(e.e),
          color: 'white',
          width: strokeWidth * 3
        });
      };

      const handleEraserPath = (e) => {
        if (!isDrawingRef.current) return;
        socket.emit('drawing-path', {
          pointer: canvas.getPointer(e.e)
        });
      };

      const handleEraserEnd = () => {
        isDrawingRef.current = false;
        socket.emit('drawing-end', {});
      };

      canvas.on('path:created', handleEraserEnd);
      canvas.on('mouse:down', handleEraserStart);
      canvas.on('mouse:move', handleEraserPath);

    } else {
      canvas.isDrawingMode = false;
      canvas.selection = true;
    }

    return () => {
      if (canvas) {
        canvas.off('mouse:down');
        canvas.off('mouse:move');
        canvas.off('path:created');
      }
    };
  }, [selectedTool, strokeColor, strokeWidth, userPermission, currentRoom]);

  // Helper functions
  const addObjectFromData = (data, isRemote = false) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    window.fabric.util.enlivenObjects([data.obj], (objects) => {
      const obj = objects[0];
      obj.id = data.id;
      if (isRemote) obj.noEmit = true;
      canvas.add(obj);
      if (isRemote) obj.noEmit = false;
    });
  };

  const startRemoteDrawing = (data) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const path = new window.fabric.Path(`M ${data.pointer.x} ${data.pointer.y}`, {
      stroke: data.color,
      strokeWidth: data.width,
      fill: '',
      selectable: false
    });
    path.noEmit = true;
    currentPathRef.current = path;
    canvas.add(path);
  };

  const updateRemoteDrawing = (data) => {
    const path = currentPathRef.current;
    if (!path) return;

    const pathData = path.path;
    pathData.push(['L', data.pointer.x, data.pointer.y]);
    path.path = pathData;
    path._setPath(path.path);
    fabricCanvasRef.current.renderAll();
  };

  const endRemoteDrawing = () => {
    if (currentPathRef.current) {
      currentPathRef.current.noEmit = false;
      currentPathRef.current = null;
    }
  };

  // User registration
  const handleRegister = (e) => {
    e.preventDefault();
    if (username.trim()) {
      socketRef.current.emit('register-user', { username: username.trim() });
    }
  };

  // Room management
  const handleCreateRoom = (e) => {
    e.preventDefault();
    socketRef.current.emit('create-room', roomForm);
  };

  const handleJoinRoom = (roomId, hasPassword) => {
    if (hasPassword) {
      const password = prompt('Enter room password:');
      if (!password) return;
      socketRef.current.emit('join-room', { roomId, password });
    } else {
      socketRef.current.emit('join-room', { roomId });
    }
  };

  const loadRooms = () => {
    socketRef.current.emit('get-rooms');
    setShowRoomModal(true);
  };

  const loadRoomUsers = () => {
    if (isOwner) {
      socketRef.current.emit('get-room-users');
    }
  };

  const changeUserPermission = (targetUserId, newPermission) => {
    socketRef.current.emit('change-permission', { targetUserId, newPermission });
  };

  // Tool functions
  const addRectangle = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const rect = new window.fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    });
    canvas.add(rect);
  };

  const addCircle = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const circle = new window.fabric.Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth
    });
    canvas.add(circle);
  };

  const addText = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const text = new window.fabric.IText('Click to edit', {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: strokeColor
    });
    canvas.add(text);
  };

  const deleteSelected = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => {
      canvas.remove(obj);
    });
    canvas.discardActiveObject();
  };

  const clearCanvas = () => {
    if (userPermission !== 'edit') {
      alert('You only have view permission');
      return;
    }
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    canvas.clear();
    canvas.backgroundColor = 'white';
    canvas.renderAll();
    socketRef.current.emit('clear-canvas');
  };

  // Registration screen
  if (!isRegistered) {
    return (
      <div className="registration-screen">
        <div className="registration-form">
          <h2>Welcome to Collaborative Whiteboard</h2>
          <form onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
    );
  }

  // Room selection screen
  if (!currentRoom) {
    return (
      <div className="room-selection">
        <div className="room-header">
          <h2>Hello, {username}!</h2>
          <div className="room-actions">
            <button onClick={loadRooms}>Join Room</button>
            <button onClick={() => setShowCreateRoom(true)}>Create Room</button>
          </div>
        </div>

        {showRoomModal && (
          <div className="modal">
            <div className="modal-content">
              <h3>Available Rooms</h3>
              <div className="rooms-list">
                {availableRooms.map(room => (
                  <div key={room.id} className="room-item">
                    <div className="room-info">
                      <strong>{room.name}</strong>
                      <span>{room.userCount} users</span>
                      {room.hasPassword && <span>🔒</span>}
                    </div>
                    <button onClick={() => handleJoinRoom(room.id, room.hasPassword)}>
                      Join
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowRoomModal(false)}>Close</button>
            </div>
          </div>
        )}

        {showCreateRoom && (
          <div className="modal">
            <div className="modal-content">
              <h3>Create New Room</h3>
              <form onSubmit={handleCreateRoom}>
                <input
                  type="text"
                  placeholder="Room name"
                  value={roomForm.roomName}
                  onChange={(e) => setRoomForm({...roomForm, roomName: e.target.value})}
                  required
                />
                
                <label>
                  <input
                    type="checkbox"
                    checked={roomForm.isPrivate}
                    onChange={(e) => setRoomForm({...roomForm, isPrivate: e.target.checked})}
                  />
                  Private room
                </label>

                <input
                  type="password"
                  placeholder="Password (optional)"
                  value={roomForm.password}
                  onChange={(e) => setRoomForm({...roomForm, password: e.target.value})}
                />

                <select
                  value={roomForm.defaultPermission}
                  onChange={(e) => setRoomForm({...roomForm, defaultPermission: e.target.value})}
                >
                  <option value="edit">Edit Permission</option>
                  <option value="view">View Only</option>
                </select>

                <div className="modal-actions">
                  <button type="submit">Create</button>
                  <button type="button" onClick={() => setShowCreateRoom(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main whiteboard interface
  return (
    <div className="whiteboard-container">
      <div className="room-info">
        <div className="room-details">
          <strong>{currentRoom.roomName}</strong>
          <span>Permission: {userPermission}</span>
          {isOwner && <span className="owner-badge">Owner</span>}
        </div>
        
        <h1 className="room-title">Collaborative Whiteboard</h1>
        
        <div className="room-controls">
          {isOwner && (
            <button onClick={loadRoomUsers}>Manage Users</button>
          )}
          <button onClick={() => setShowExportModal(true)}>Save/Export</button>
          <button onClick={() => window.location.reload()}>Leave Room</button>
        </div>
      </div>

      <div className="toolbar">
        <button 
          className={selectedTool === 'select' ? 'active' : ''}
          onClick={() => setSelectedTool('select')}
          disabled={userPermission !== 'edit'}
        >
          Select
        </button>
        <button 
          className={selectedTool === 'pen' ? 'active' : ''}
          onClick={() => setSelectedTool('pen')}
          disabled={userPermission !== 'edit'}
        >
          Pen
        </button>
        <button 
          className={selectedTool === 'eraser' ? 'active' : ''}
          onClick={() => setSelectedTool('eraser')}
          disabled={userPermission !== 'edit'}
        >
          Eraser
        </button>
        
        <div className="separator"></div>
        
        <button onClick={addRectangle} disabled={userPermission !== 'edit'}>Rectangle</button>
        <button onClick={addCircle} disabled={userPermission !== 'edit'}>Circle</button>
        <button onClick={addText} disabled={userPermission !== 'edit'}>Text</button>
        
        <div className="separator"></div>
        
        <button 
          onClick={performUndo} 
          disabled={userPermission !== 'edit'}
          title="Undo (clears canvas)"
          className="undo-redo-btn"
        >
          ↶ Undo
        </button>
        <button 
          onClick={performRedo} 
          disabled={userPermission !== 'edit'}
          title="Redo (dummy)"
          className="undo-redo-btn"
        >
          ↷ Redo
        </button>
        
        <div className="separator"></div>
        
        <label>
          Stroke:
          <input 
            type="color" 
            value={strokeColor} 
            onChange={(e) => setStrokeColor(e.target.value)}
            disabled={userPermission !== 'edit'}
          />
        </label>
        
        <label>
          Fill:
          <input 
            type="color" 
            value={fillColor} 
            onChange={(e) => setFillColor(e.target.value)}
            disabled={userPermission !== 'edit'}
          />
        </label>
        
        <label>
          Width:
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            disabled={userPermission !== 'edit'}
          />
          <span>{strokeWidth}</span>
        </label>
        
        <div className="separator"></div>
        
        <button onClick={deleteSelected} disabled={userPermission !== 'edit'}>Delete</button>
        <button onClick={clearCanvas} disabled={userPermission !== 'edit'}>Clear</button>
        
        {userPermission === 'view' && (
          <span className="view-only-notice">VIEW ONLY MODE</span>
        )}
      </div>
      
      <div className="canvas-container">
        <canvas ref={canvasRef}></canvas>
      </div>

      {showExportModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>💾 Save & Export Options</h3>
            
            <div className="export-section">
              <h4>Export as Image</h4>
              <div className="export-buttons">
                <button onClick={() => exportAsImage('png')} className="export-btn">
                  📷 Export as PNG
                </button>
                <button onClick={() => exportAsImage('jpeg')} className="export-btn">
                  🖼️ Export as JPEG
                </button>
              </div>
            </div>

            <div className="export-section">
              <h4>Export as PDF</h4>
              <div className="export-buttons">
                <button onClick={exportAsPDF} className="export-btn">
                  📄 Export as PDF
                </button>
              </div>
            </div>

            <div className="export-section">
              <h4>Save/Load Canvas Data</h4>
              <div className="export-buttons">
                <button onClick={saveCanvasData} className="export-btn">
                  💾 Save Canvas Data
                </button>
                <button onClick={loadCanvasData} className="export-btn">
                  📂 Load Canvas Data
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowExportModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {roomUsers.length > 0 && (
        <div className="modal">
          <div className="modal-content">
            <h3>Room Users</h3>
            <div className="users-list">
              {roomUsers.map(user => (
                <div key={user.socketId} className="user-item">
                  <span>{user.username} {user.isOwner && '(Owner)'}</span>
                  <span>Permission: {user.permission}</span>
                  {!user.isOwner && (
                    <div className="permission-controls">
                      <button 
                        onClick={() => changeUserPermission(user.socketId, 'edit')}
                        disabled={user.permission === 'edit'}
                      >
                        Grant Edit
                      </button>
                      <button 
                        onClick={() => changeUserPermission(user.socketId, 'view')}
                        disabled={user.permission === 'view'}
                      >
                        View Only
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setRoomUsers([])}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhiteboardApp;
