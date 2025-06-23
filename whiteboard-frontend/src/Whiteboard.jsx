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

  const [selectedTool, setSelectedTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState('#ffffff');

  // Initialize canvas and socket
  useEffect(() => {
    // Wait for fabric to be available globally
    if (typeof window.fabric === 'undefined') {
      console.error('Fabric.js not loaded');
      return;
    }

    // Initialize Fabric canvas using global fabric object
    const canvas = new window.fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: 'white'
    });
    fabricCanvasRef.current = canvas;

    // Initialize socket connection
    const socket = io('http://localhost:4000');
    socketRef.current = socket;

    // Socket event handlers
    socket.on('canvas-state', (state) => {
      state.forEach(objData => {
        addObjectFromData(objData, true);
      });
    });

    socket.on('add-object', (data) => {
      addObjectFromData(data, true);
    });

    socket.on('modify-object', (data) => {
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
      canvas.clear();
      canvas.backgroundColor = 'white';
      canvas.renderAll();
    });

    return () => {
      canvas.dispose();
      socket.disconnect();
    };
  }, []);

  // Set up canvas event handlers
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const socket = socketRef.current;
    if (!canvas || !socket) return;

    const handleAdd = (e) => {
      if (!e.target || e.target.noEmit) return;
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
      if (!e.target || e.target.noEmit) return;
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
      if (!e.target || e.target.noEmit) return;
      socket.emit('remove-object', { id: e.target.id });
    };

    const handleTextChanged = (e) => {
      if (!e.target || e.target.noEmit) return;
      socket.emit('modify-object', {
        id: e.target.id,
        obj: e.target.toObject([
          'left', 'top', 'width', 'height',
          'radius', 'fill', 'stroke', 'strokeWidth', 'text',
          'scaleX', 'scaleY', 'angle', 'rx', 'ry'
        ])
      });
    };

    // Register event handlers
    canvas.on('object:added', handleAdd);
    canvas.on('object:modified', handleModify);
    canvas.on('object:removed', handleRemove);
    canvas.on('text:changed', handleTextChanged);
    canvas.on('text:editing:exited', handleTextChanged);

    return () => {
      canvas.off('object:added', handleAdd);
      canvas.off('object:modified', handleModify);
      canvas.off('object:removed', handleRemove);
      canvas.off('text:changed', handleTextChanged);
      canvas.off('text:editing:exited', handleTextChanged);
    };
  }, []);

  // Set up drawing mode with eraser implementation
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (selectedTool === 'pen') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = strokeWidth;
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.selection = false;
      
      // Drawing event handlers
      const handleDrawingStart = (e) => {
        isDrawingRef.current = true;
        socketRef.current.emit('drawing-start', {
          pointer: canvas.getPointer(e.e),
          color: strokeColor,
          width: strokeWidth
        });
      };

      const handleDrawingPath = (e) => {
        if (!isDrawingRef.current) return;
        socketRef.current.emit('drawing-path', {
          pointer: canvas.getPointer(e.e)
        });
      };

      const handleDrawingEnd = () => {
        isDrawingRef.current = false;
        socketRef.current.emit('drawing-end', {});
      };

      canvas.on('path:created', handleDrawingEnd);
      canvas.on('mouse:down', handleDrawingStart);
      canvas.on('mouse:move', handleDrawingPath);

      return () => {
        canvas.off('path:created', handleDrawingEnd);
        canvas.off('mouse:down', handleDrawingStart);
        canvas.off('mouse:move', handleDrawingPath);
      };
    } else if (selectedTool === 'eraser') {
      // Simple eraser using white color
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.width = strokeWidth * 3; // Make eraser wider
      canvas.freeDrawingBrush.color = canvas.backgroundColor || 'white'; // Use canvas background color
      canvas.selection = false;
      
      // Use the same drawing handlers as pen tool but with white color
      const handleEraserStart = (e) => {
        isDrawingRef.current = true;
        socketRef.current.emit('drawing-start', {
          pointer: canvas.getPointer(e.e),
          color: canvas.backgroundColor || 'white',
          width: strokeWidth * 3
        });
      };

      const handleEraserPath = (e) => {
        if (!isDrawingRef.current) return;
        socketRef.current.emit('drawing-path', {
          pointer: canvas.getPointer(e.e)
        });
      };

      const handleEraserEnd = () => {
        isDrawingRef.current = false;
        socketRef.current.emit('drawing-end', {});
      };

      canvas.on('path:created', handleEraserEnd);
      canvas.on('mouse:down', handleEraserStart);
      canvas.on('mouse:move', handleEraserPath);

      return () => {
        canvas.off('path:created', handleEraserEnd);
        canvas.off('mouse:down', handleEraserStart);
        canvas.off('mouse:move', handleEraserPath);
      };
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = true;
    }
  }, [selectedTool, strokeColor, strokeWidth]);

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

  // Tool functions
  const addRectangle = () => {
    const canvas = fabricCanvasRef.current;
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
    const canvas = fabricCanvasRef.current;
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
    const canvas = fabricCanvasRef.current;
    const text = new window.fabric.IText('Click to edit', {
      left: 100,
      top: 100,
      fontSize: 20,
      fill: strokeColor
    });
    canvas.add(text);
  };

  const deleteSelected = () => {
    const canvas = fabricCanvasRef.current;
    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach(obj => {
      canvas.remove(obj);
    });
    canvas.discardActiveObject();
  };

  const clearCanvas = () => {
    const canvas = fabricCanvasRef.current;
    canvas.clear();
    canvas.backgroundColor = 'white';
    canvas.renderAll();
    socketRef.current.emit('clear-canvas');
  };

  return (
    <div className="whiteboard-container">
      <div className="toolbar">
        <button 
          className={selectedTool === 'select' ? 'active' : ''}
          onClick={() => setSelectedTool('select')}
        >
          Select
        </button>
        <button 
          className={selectedTool === 'pen' ? 'active' : ''}
          onClick={() => setSelectedTool('pen')}
        >
          Pen
        </button>
        <button 
          className={selectedTool === 'eraser' ? 'active' : ''}
          onClick={() => setSelectedTool('eraser')}
        >
          Eraser
        </button>
        
        <div className="separator"></div>
        
        <button onClick={addRectangle}>Rectangle</button>
        <button onClick={addCircle}>Circle</button>
        <button onClick={addText}>Text</button>
        
        <div className="separator"></div>
        
        <label>
          Stroke:
          <input 
            type="color" 
            value={strokeColor} 
            onChange={(e) => setStrokeColor(e.target.value)}
          />
        </label>
        
        <label>
          Fill:
          <input 
            type="color" 
            value={fillColor} 
            onChange={(e) => setFillColor(e.target.value)}
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
          />
          <span>{strokeWidth}</span>
        </label>
        
        <div className="separator"></div>
        
        <button onClick={deleteSelected}>Delete</button>
        <button onClick={clearCanvas}>Clear</button>
      </div>
      
      <div className="canvas-container">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};

export default WhiteboardApp;
