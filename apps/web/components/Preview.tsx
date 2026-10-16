'use client';

import { renderCharacter, type CharacterSpec, type Framing } from '@blockify/core';
import { useEffect, useRef, useState } from 'react';

export type Background = string; // '#rrggbb' | 'transparent'

const SIZE = 480;

/** Live render of the character. Drag (or use the arrow keys) to turn it. */
export function Preview({ spec, framing, background }: { spec: CharacterSpec; framing: Framing; background: Background }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [yaw, setYaw] = useState(25);
  const [pitch, setPitch] = useState(12);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      const bmp = renderCharacter(spec, { size: SIZE, framing, yaw, pitch, background });
      ctx.putImageData(new ImageData(new Uint8ClampedArray(bmp.data), bmp.width, bmp.height), 0, 0);
    });
    return () => cancelAnimationFrame(frame.current);
  }, [spec, framing, background, yaw, pitch]);

  return (
    <div className={`preview ${background === 'transparent' ? 'checker' : ''}`}>
      <canvas
        ref={canvas}
        width={SIZE}
        height={SIZE}
        className="preview-canvas"
        role="img"
        aria-label="Your avatar. Drag or use the arrow keys to rotate."
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setYaw(d.yaw + (e.clientX - d.x) * 0.6);
          setPitch(Math.max(-30, Math.min(60, d.pitch + (e.clientY - d.y) * 0.4)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          const turn: Record<string, () => void> = {
            ArrowLeft: () => setYaw((y) => y - 15),
            ArrowRight: () => setYaw((y) => y + 15),
            ArrowUp: () => setPitch((p) => Math.max(-30, p - 10)),
            ArrowDown: () => setPitch((p) => Math.min(60, p + 10)),
          };
          if (turn[e.key]) {
            e.preventDefault();
            turn[e.key]!();
          }
        }}
      />
      <p className="preview-hint" aria-hidden>
        Drag to rotate
      </p>
    </div>
  );
}
