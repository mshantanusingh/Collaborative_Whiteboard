import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Initialize Socket.IO client
const socket = io('http://localhost:4000');

export default function Whiteboard() {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(3);
  const nextIdRef = useRef(1);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef(null);
  const currentShapeRef = useRef(null);

  // Initialize Fabric.js canvas and socket listeners
  useEffect(() => {
    const fabric = window.fabric;
    if (!fabric || !canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#fff',
      selection: true,
    });
    fabricCanvasRef.current = canvas;

    // Initial free-draw setup
    canvas.isDrawingMode = true;
    const brush = new fabric.PencilBrush(canvas);
    brush.color = color;
    brush.width = lineWidth;
    canvas.freeDrawingBrush = brush;

    // Handle incoming new shapes
    socket.on('add-object', (data) => {
      fabric.util.enlivenObjects([data.obj], ([obj]) => {
        obj.id = data.id;
        obj.noEmit = true;
        canvas.add(obj);
        canvas.requestRenderAll();
      });
    });

    // Handle incoming modifications
    socket.on('modify-object', (data) => {
      const obj = canvas.getObjects().find(o => o.id === data.id);
      if (obj) {
        obj.noEmit = true;
        obj.set(data.obj);
        obj.setCoords();
        canvas.requestRenderAll();
      }
    });

    // Handle incoming removals
    socket.on('remove-object', (data) => {
      const obj = canvas.getObjects().find(o => o.id === data.id);
      if (obj) {
        canvas.remove(obj);
        canvas.requestRenderAll();
      }
    });

    // Cleanup on unmount
    return () => {
      socket.removeAllListeners('add-object');
      socket.removeAllListeners('modify-object');
      socket.removeAllListeners('remove-object');
      canvas.dispose();
    };
  }, []);

  // Sync Fabric events to socket
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Emit new objects
    const handleAdd = (e) => {
      if (!e.target || e.target.noEmit) return;
      e.target.id = `${socket.id}_obj_${nextIdRef.current++}`;
      const payload = {
        id: e.target.id,
        obj: e.target.toObject([
          'left', 'top', 'width', 'height',
          'radius', 'fill', 'stroke', 'strokeWidth'
        ])
      };
      socket.emit('add-object', payload);
    };

    // Emit modifications
    const handleModify = (e) => {
      if (!e.target || e.target.noEmit) return;
      socket.emit('modify-object', {
        id: e.target.id,
        obj: e.target.toObject([
          'left', 'top', 'width', 'height',
          'radius', 'fill', 'stroke', 'strokeWidth'
        ])
      });
    };

    // Emit removals
    const handleRemove = (e) => {
      if (!e.target || e.target.noEmit) return;
      socket.emit('remove-object', { id: e.target.id });
    };

    canvas.on('object:added', handleAdd);
    canvas.on('object:modified', handleModify);
    canvas.on('object:removed', handleRemove);

    return () => {
      canvas.off('object:added', handleAdd);
      canvas.off('object:modified', handleModify);
      canvas.off('object:removed', handleRemove);
    };
  }, []);

  // Tool, color, and width updates
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove old mouse handlers
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    // Common setup
    canvas.isDrawingMode = tool === 'pen';
    canvas.selection = tool === 'select';

    // Adjust object interactivity
    canvas.forEachObject(o => {
      o.selectable = tool === 'select';
      o.evented = tool !== 'pen';
    });

    if (tool === 'pen') {
      const pencil = new fabric.PencilBrush(canvas);
      pencil.color = color;
      pencil.width = lineWidth;
      canvas.freeDrawingBrush = pencil;
    }

    else if (tool === 'eraser') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.on('mouse:down', e => {
        const target = canvas.findTarget(e.e);
        if (target) {
          canvas.remove(target);
          canvas.requestRenderAll();
        }
      });
    }

    else if (['rectangle', 'circle', 'text'].includes(tool)) {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.forEachObject(o => o.selectable = false);

      canvas.on('mouse:down', opt => {
        const p = canvas.getPointer(opt.e);
        startPointRef.current = p;
        isDrawingRef.current = true;

        if (tool === 'rectangle') {
          currentShapeRef.current = new fabric.Rect({
            left: p.x, top: p.y, width: 0, height: 0,
            fill: 'transparent', stroke: color, strokeWidth: lineWidth
          });
        } else if (tool === 'circle') {
          currentShapeRef.current = new fabric.Circle({
            left: p.x, top: p.y, radius: 0,
            fill: 'transparent', stroke: color, strokeWidth: lineWidth
          });
        }

        if (currentShapeRef.current) {
          currentShapeRef.current.id = `${socket.id}_obj_${nextIdRef.current++}`;
          canvas.add(currentShapeRef.current);
          canvas.requestRenderAll();
        }

        if (tool === 'text') {
          const txt = new fabric.IText('Edit me', {
            left: p.x, top: p.y, fill: color, fontSize: 24
          });
          txt.id = `${socket.id}_obj_${nextIdRef.current++}`;
          canvas.add(txt);
          canvas.setActiveObject(txt);
          txt.enterEditing();
        }
      });

      canvas.on('mouse:move', opt => {
        if (!isDrawingRef.current || !currentShapeRef.current) return;
        const p = canvas.getPointer(opt.e);
        const start = startPointRef.current;

        if (tool === 'rectangle') {
          const newProps = {
            width: Math.abs(p.x - start.x),
            height: Math.abs(p.y - start.y),
            left: Math.min(start.x, p.x), 
            top: Math.min(start.y, p.y)
          };
          currentShapeRef.current.set(newProps);
          
          // FIXED: Emit real-time updates during drawing
          socket.emit('modify-object', {
            id: currentShapeRef.current.id,
            obj: currentShapeRef.current.toObject([
              'left', 'top', 'width', 'height',
              'fill', 'stroke', 'strokeWidth'
            ])
          });
        } else if (tool === 'circle') {
          const dx = p.x - start.x, dy = p.y - start.y;
          const radius = Math.sqrt(dx*dx + dy*dy) / 2;
          const centerX = (start.x + p.x) / 2;
          const centerY = (start.y + p.y) / 2;
          const newProps = { 
            radius, 
            left: centerX - radius, 
            top: centerY - radius 
          };
          currentShapeRef.current.set(newProps);
          
          // FIXED: Emit real-time updates during drawing
          socket.emit('modify-object', {
            id: currentShapeRef.current.id,
            obj: currentShapeRef.current.toObject([
              'left', 'top', 'radius',
              'fill', 'stroke', 'strokeWidth'
            ])
          });
        }
        canvas.requestRenderAll();
      });

      canvas.on('mouse:up', () => {
        isDrawingRef.current = false;
        currentShapeRef.current = null;
      });
    }

    return () => {
      canvas.off('mouse:down');
      canvas.off('mouse:move');
      canvas.off('mouse:up');
    };
  }, [tool, color, lineWidth]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {['select','pen','eraser','rectangle','circle','text'].map(t => (
          <button key={t} onClick={() => setTool(t)}
            style={{ background: tool===t?'#ddd':'' }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} />
        <input type="range" min={1} max={20} value={lineWidth}
          onChange={e=>setLineWidth(+e.target.value)} />
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
