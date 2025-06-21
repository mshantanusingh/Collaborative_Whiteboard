import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

function Whiteboard() {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    socket.on('draw', ({ x0, y0, x1, y1 }) => {
      drawLine(x0, y0, x1, y1, context);
    });

    return () => {
      socket.off('draw');
    };
  }, []);

  const drawLine = (x0, y0, x1, y1, context, emit) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
    context.closePath();

    if (!emit) return;
    socket.emit('draw', { x0, y0, x1, y1 });
  };

  const handleMouseDown = (e) => {
    setDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    window.lastX = e.clientX - rect.left;
    window.lastY = e.clientY - rect.top;
  };

  const handleMouseMove = (e) => {
    if (!drawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawLine(window.lastX, window.lastY, x, y, canvasRef.current.getContext('2d'), true);
    window.lastX = x;
    window.lastY = y;
  };

  const handleMouseUp = () => setDrawing(false);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ border: '1px solid #000' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseOut={handleMouseUp}
    />
  );
}

export default Whiteboard;
