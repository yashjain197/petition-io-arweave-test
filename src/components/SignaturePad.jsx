// src/components/SignaturePad.jsx
import React, { useRef, useEffect, useState } from 'react';

export default function SignaturePad({ onSave, disabled }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);

  // Resize for device pixel ratio to keep strokes crisp
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = 600;
      const height = 220;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const c = canvas.getContext('2d');
      c.scale(ratio, ratio);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = 2;
      c.strokeStyle = '#111';
      c.fillStyle = '#fff';
      c.fillRect(0, 0, width, height);
      setCtx(c);
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e) {
    if (disabled) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setIsDrawing(true);
  }

  function handlePointerMove(e) {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function handlePointerUp(e) {
    if (disabled) return;
    e.preventDefault();
    setIsDrawing(false);
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Quick check if blank (sample a few pixels)
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let drawn = false;
    for (let i = 0; i < data.length; i += 16) {
      if (!(data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255)) { drawn = true; break; }
    }
    if (!drawn) {
      alert('Please draw a signature first');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const res = await fetch(dataUrl);
    const bytes = new Uint8Array(await res.arrayBuffer());
    onSave && onSave(bytes);
  }

  return (
    <div className="card" ref={containerRef}>
      <div className="label">Draw your signature</div>
      <canvas
        ref={canvasRef}
        className="sig"
        width={600}
        height={220}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={handleClear} disabled={disabled}>Clear</button>
        <button className="primary" onClick={handleSave} disabled={disabled}>Use this</button>
      </div>
    </div>
  );
}
