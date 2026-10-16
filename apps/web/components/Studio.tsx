'use client';

import {
  DEFAULT_SPEC,
  NoFaceError,
  analyzePhoto,
  buildMosaic,
  decodeMosaic,
  decodeSpec,
  encodeMosaic,
  encodeSpec,
  type AnalyzeResult,
  type CharacterSpec,
  type Framing,
  type Mosaic,
  type MosaicLook,
} from '@blockify/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserDetector, preloadDetector } from '@/lib/detector';
import { fileToBitmap } from '@/lib/image';
import { Downloads } from './Downloads';
import { Editor } from './Editor';
import { MosaicControls, MosaicDownloads, MosaicPreview, type MosaicOptions } from './Mosaic';
import { PhotoInput } from './PhotoInput';
import { Preview, type Background } from './Preview';

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; message: string }
  | { kind: 'done'; warnings: string[] }
  | { kind: 'error'; message: string };

/** Character styles render a CharacterSpec; mosaic rebuilds the photo itself out of blocks. */
type View = 'blocky' | 'brick' | 'mosaic';

const LOOKS: MosaicLook[] = ['blocks', 'studs', 'flat'];

export function Studio() {
  const [spec, setSpec] = useState<CharacterSpec>(DEFAULT_SPEC);
  const [fromPhoto, setFromPhoto] = useState<CharacterSpec | null>(null);
  const [photo, setPhoto] = useState<Pick<AnalyzeResult, 'image' | 'face'> | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [view, setView] = useState<View>('blocky');
  const [framing, setFraming] = useState<Framing>('bust');
  const [background, setBackground] = useState<Background>('#9fd8f5');
  const [mosaicOpts, setMosaicOpts] = useState<MosaicOptions>({ grid: 32, colors: 20, look: 'blocks' });
  const [sharedMosaic, setSharedMosaic] = useState<Mosaic | null>(null);

  // Share links carry the character (?s=) or the mosaic blocks (?m=&l=), never the photo.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    try {
      const s = q.get('s');
      const m = q.get('m');
      if (s) {
        const shared = decodeSpec(s);
        setSpec(shared);
        setView(shared.style);
      }
      if (m) {
        setSharedMosaic(decodeMosaic(m));
        setView('mosaic');
        const look = q.get('l') as MosaicLook | null;
        if (look && LOOKS.includes(look)) setMosaicOpts((o) => ({ ...o, look }));
      }
    } catch {
      setStatus({ kind: 'error', message: "That share link is broken, so you're seeing the default instead." });
    }
  }, []);

  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const mosaicCrop = framing === 'head' ? 'head' : 'bust';
  const mosaic = useMemo(
    () => (photo ? buildMosaic(photo.image, photo.face, { grid: mosaicOpts.grid, colors: mosaicOpts.colors, crop: mosaicCrop }) : sharedMosaic),
    [photo, mosaicOpts.grid, mosaicOpts.colors, mosaicCrop, sharedMosaic],
  );

  const onPhoto = useCallback(
    async (file: File) => {
      setPhotoUrl(URL.createObjectURL(file));
      setStatus({ kind: 'working', message: 'Loading face models (first time only)…' });
      try {
        const bitmap = await fileToBitmap(file);
        preloadDetector();
        setStatus({ kind: 'working', message: 'Reading your photo…' });
        const res = await analyzePhoto(bitmap, browserDetector, { style: spec.style });
        setSpec(res.spec);
        setFromPhoto(res.spec);
        setPhoto({ image: res.image, face: res.face });
        setStatus({ kind: 'done', warnings: res.warnings });
      } catch (err) {
        const message =
          err instanceof NoFaceError
            ? err.message
            : `Something went wrong reading that photo. ${err instanceof Error ? err.message : ''}`.trim();
        setStatus({ kind: 'error', message });
      }
    },
    [spec.style],
  );

  const base = () => `${window.location.origin}${window.location.pathname}`;
  const shareUrl = () => `${base()}?s=${encodeSpec(spec)}`;
  const mosaicShareUrl = () => (mosaic ? `${base()}?m=${encodeMosaic(mosaic)}&l=${mosaicOpts.look}` : base());

  const isMosaic = view === 'mosaic';

  return (
    <div className="studio">
      <section className="stage" aria-label="Preview">
        {isMosaic ? (
          <MosaicPreview mosaic={mosaic} look={mosaicOpts.look} />
        ) : (
          <Preview spec={spec} framing={framing} background={background} />
        )}
        <div className="stage-controls">
          <Segmented
            label="Style"
            value={view}
            options={[
              ['blocky', 'Blocky'],
              ['brick', 'Brick'],
              ['mosaic', 'Mosaic'],
            ]}
            onChange={(v) => {
              setView(v);
              if (v !== 'mosaic') setSpec({ ...spec, style: v });
              if (v === 'mosaic' && framing === 'full') setFraming('bust');
            }}
          />
          <Segmented
            label="Framing"
            value={framing}
            options={
              isMosaic
                ? [
                    ['head', 'Head'],
                    ['bust', 'Bust'],
                  ]
                : [
                    ['head', 'Head'],
                    ['bust', 'Bust'],
                    ['full', 'Full body'],
                  ]
            }
            onChange={setFraming}
          />
          {!isMosaic && <BackgroundPicker value={background} onChange={setBackground} />}
        </div>
      </section>

      <div className="panels">
        <section className="panel">
          <h2 className="panel-title">
            <span className="step">1</span> Your photo
          </h2>
          <PhotoInput photoUrl={photoUrl} busy={status.kind === 'working'} onPhoto={onPhoto} onIntent={preloadDetector} />
          <StatusLine status={status} />
        </section>

        <section className="panel">
          <h2 className="panel-title">
            <span className="step">2</span> Fine-tune
            {!isMosaic && fromPhoto && spec !== fromPhoto && (
              <button className="link-button" onClick={() => setSpec({ ...fromPhoto, style: spec.style })}>
                Reset to photo
              </button>
            )}
          </h2>
          {isMosaic ? (
            <MosaicControls options={mosaicOpts} onChange={setMosaicOpts} canRebuild={!!photo} />
          ) : (
            <Editor spec={spec} onChange={setSpec} />
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">
            <span className="step">3</span> Download
          </h2>
          {isMosaic ? (
            <MosaicDownloads mosaic={mosaic} look={mosaicOpts.look} shareUrl={mosaicShareUrl} />
          ) : (
            <Downloads spec={spec} framing={framing} background={background} shareUrl={shareUrl} />
          )}
        </section>
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return <p className="hint">Use a front-facing, well-lit photo for the best result.</p>;
  if (status.kind === 'working')
    return (
      <p className="status" role="status">
        <span className="spinner" aria-hidden /> {status.message}
      </p>
    );
  if (status.kind === 'error')
    return (
      <p className="status status-error" role="alert">
        {status.message}
      </p>
    );
  return (
    <div className="status status-ok" role="status">
      <p>Done! Tweak anything that doesn&apos;t look like you.</p>
      {status.warnings.map((w) => (
        <p key={w} className="warning">
          {w}
        </p>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={v === value} className="segment" onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

const BACKGROUNDS: Background[] = ['#9fd8f5', '#b8e3a5', '#ffd59e', '#f4b6c2', '#c9b8f0', '#2b2d42', 'transparent'];

function BackgroundPicker({ value, onChange }: { value: Background; onChange: (b: Background) => void }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Background">
      {BACKGROUNDS.map((b) => (
        <button
          key={b}
          role="radio"
          aria-checked={b === value}
          aria-label={b === 'transparent' ? 'Transparent background' : `Background ${b}`}
          className={`swatch ${b === 'transparent' ? 'swatch-transparent' : ''}`}
          style={b === 'transparent' ? undefined : { background: b }}
          onClick={() => onChange(b)}
        />
      ))}
    </div>
  );
}
