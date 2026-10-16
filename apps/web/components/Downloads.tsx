'use client';

import { profilePic, skinFile, turntable, type CharacterSpec, type Framing } from '@blockify/core';
import { useState } from 'react';
import { download } from '@/lib/image';
import type { Background } from './Preview';

export function Downloads({
  spec,
  framing,
  background,
  shareUrl,
}: {
  spec: CharacterSpec;
  framing: Framing;
  background: Background;
  shareUrl: () => string;
}) {
  const [size, setSize] = useState(512);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const name = `blockify-${spec.style}`;

  const gif = async () => {
    setBusy(true);
    // Yield a frame so the button shows its busy state before the (synchronous) encode.
    await new Promise((r) => setTimeout(r, 30));
    try {
      download(turntable(spec, { framing: framing === 'head' ? 'bust' : framing, background }), `${name}-turntable.gif`, 'image/gif');
    } finally {
      setBusy(false);
    }
  };

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
          onClick={() => download(profilePic(spec, { size, framing, background }), `${name}-avatar.png`, 'image/png')}
        >
          Profile picture (PNG)
        </button>
        <label className="field field-inline">
          <span className="visually-hidden">Size</span>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[256, 512, 1024].map((s) => (
              <option key={s} value={s}>
                {s}×{s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="button" onClick={gif} disabled={busy}>
        {busy ? 'Rendering…' : 'Spinning GIF'}
      </button>
      {spec.style === 'blocky' ? (
        <>
          <button className="button" onClick={() => download(skinFile(spec), `${name}-skin.png`, 'image/png')}>
            Minecraft skin (64×64)
          </button>
          {spec.arms === 'slim' && <p className="hint">When you upload it in Minecraft, pick the Slim (Alex) model.</p>}
          {(spec.hairStyle === 'bun' || spec.hairStyle === 'ponytail') && (
            <p className="hint">Minecraft skins can&apos;t stick out of the head, so the {spec.hairStyle} is drawn flat in the skin file.</p>
          )}
        </>
      ) : (
        <p className="hint">Skin files are only available in the Blocky style.</p>
      )}
      <button className="button button-ghost" onClick={copy}>
        {copied ? 'Link copied!' : 'Copy share link'}
      </button>
      <p className="hint">The link stores your character, not your photo.</p>
    </div>
  );
}
