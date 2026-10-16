'use client';

import { renderMosaic, toPng, type Mosaic, type MosaicLook } from '@blockify/core';
import { useEffect, useRef, useState } from 'react';
import { download } from '@/lib/image';

export interface MosaicOptions {
  grid: number;
  colors: number;
  look: MosaicLook;
}

const SIZE = 480;

export function MosaicPreview({ mosaic, look }: { mosaic: Mosaic | null; look: MosaicLook }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !mosaic) return;
    const bmp = renderMosaic(mosaic, { size: SIZE, look });
    ctx.putImageData(new ImageData(new Uint8ClampedArray(bmp.data), bmp.width, bmp.height), 0, 0);
  }, [mosaic, look]);

  return (
    <div className="preview">
      {mosaic ? (
        <canvas ref={canvas} width={SIZE} height={SIZE} className="preview-canvas preview-static" role="img" aria-label="Your photo as a block mosaic" />
      ) : (
        <div className="preview-empty">
          <p>Pick a photo to rebuild it out of blocks.</p>
        </div>
      )}
    </div>
  );
}

export function MosaicControls({
  options,
  onChange,
  canRebuild,
}: {
  options: MosaicOptions;
  onChange: (o: MosaicOptions) => void;
  /** False when the mosaic came from a share link: there's no photo to re-sample. */
  canRebuild: boolean;
}) {
  return (
    <div className="editor">
      <Slider
        label="Blocks per side"
        value={options.grid}
        min={16}
        max={64}
        step={8}
        disabled={!canRebuild}
        onChange={(grid) => onChange({ ...options, grid })}
      />
      <Slider
        label="Colors"
        value={options.colors}
        min={6}
        max={32}
        step={2}
        disabled={!canRebuild}
        onChange={(colors) => onChange({ ...options, colors })}
      />
      <label className="field">
        <span>Block look</span>
        <select value={options.look} onChange={(e) => onChange({ ...options, look: e.target.value as MosaicLook })}>
          <option value="blocks">Blocks</option>
          <option value="studs">Studs</option>
          <option value="flat">Flat pixels</option>
        </select>
      </label>
      {!canRebuild && <p className="hint">This mosaic came from a link. Pick a photo to change its size or colors.</p>}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  // Rebuilding a big mosaic on every pixel of drag is wasteful; commit on release, show the value live.
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="field slider">
      <span>
        {label} <strong>{draft}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => onChange(draft)}
        onKeyUp={() => onChange(draft)}
        onBlur={() => draft !== value && onChange(draft)}
      />
    </label>
  );
}

export function MosaicDownloads({ mosaic, look, shareUrl }: { mosaic: Mosaic | null; look: MosaicLook; shareUrl: () => string }) {
  const [size, setSize] = useState(1024);
  const [copied, setCopied] = useState(false);
  if (!mosaic) return <p className="hint">Your mosaic will be ready to download once you pick a photo.</p>;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="downloads">
      <div className="download-row">
        <button
          className="button button-primary"
          onClick={() => download(toPng(renderMosaic(mosaic, { size, look })), `blockify-mosaic-${look}.png`, 'image/png')}
        >
          Mosaic (PNG)
        </button>
        <label className="field field-inline">
          <span className="visually-hidden">Size</span>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[512, 1024, 2048].map((s) => (
              <option key={s} value={s}>
                {s}×{s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="button button-ghost" onClick={copy}>
        {copied ? 'Link copied!' : 'Copy share link'}
      </button>
      <p className="hint">The link stores the {mosaic.grid}×{mosaic.grid} blocks, not your photo.</p>
    </div>
  );
}
