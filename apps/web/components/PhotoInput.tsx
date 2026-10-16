'use client';

import { useRef, useState } from 'react';

export function PhotoInput({
  photoUrl,
  busy,
  onPhoto,
  onIntent,
}: {
  photoUrl: string | null;
  busy: boolean;
  onPhoto: (file: File) => void;
  /** Called on hover/focus so the face models can start downloading before a file is picked. */
  onIntent: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file && file.type.startsWith('image/')) onPhoto(file);
  };

  return (
    <div
      className={`dropzone ${over ? 'dropzone-over' : ''}`}
      onPointerEnter={onIntent}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
        onIntent();
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing to optimize
        <img src={photoUrl} alt="Your photo" className="dropzone-photo" />
      ) : (
        <div className="dropzone-empty" aria-hidden>
          📷
        </div>
      )}
      <div className="dropzone-body">
        <button className="button button-primary" disabled={busy} onFocus={onIntent} onClick={() => input.current?.click()}>
          {photoUrl ? 'Choose another photo' : 'Choose a photo'}
        </button>
        <span className="hint">or drop one here</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
