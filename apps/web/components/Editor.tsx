'use client';

import { ARMS, BEARDS, HAIR_STYLES, MOUTHS, SLEEVES, type CharacterSpec } from '@blockify/core';

const COLORS: [keyof CharacterSpec & ('skin' | 'hair' | 'eyes' | 'shirt' | 'pants' | 'shoes'), string][] = [
  ['skin', 'Skin'],
  ['hair', 'Hair'],
  ['eyes', 'Eyes'],
  ['shirt', 'Shirt'],
  ['pants', 'Pants'],
  ['shoes', 'Shoes'],
];

const LABELS: Record<string, string> = {
  bald: 'Bald',
  buzz: 'Buzz cut',
  short: 'Short',
  medium: 'Medium',
  bob: 'Bob',
  long: 'Long',
  afro: 'Afro',
  bun: 'Bun',
  ponytail: 'Ponytail',
  classic: 'Classic',
  slim: 'Slim',
  none: 'None',
  stubble: 'Stubble',
  full: 'Full beard',
  neutral: 'Neutral',
  smile: 'Smile',
};

export function Editor({ spec, onChange }: { spec: CharacterSpec; onChange: (s: CharacterSpec) => void }) {
  const set = <K extends keyof CharacterSpec>(k: K, v: CharacterSpec[K]) => onChange({ ...spec, [k]: v });

  return (
    <div className="editor">
      <div className="colors">
        {COLORS.map(([key, label]) => (
          <label key={key} className="color-field">
            <input type="color" value={spec[key]} onChange={(e) => set(key, e.target.value)} />
            <span>{label}</span>
          </label>
        ))}
        {spec.lips && (
          <label className="color-field">
            <input type="color" value={spec.lips} onChange={(e) => set('lips', e.target.value)} />
            <span>Lips</span>
          </label>
        )}
      </div>
      <div className="fields">
        <Select label="Hair" value={spec.hairStyle} options={HAIR_STYLES} onChange={(v) => set('hairStyle', v)} />
        <Select label="Beard" value={spec.beard} options={BEARDS} onChange={(v) => set('beard', v)} />
        <Select label="Mouth" value={spec.mouth} options={MOUTHS} onChange={(v) => set('mouth', v)} />
        <Select
          label="Sleeves"
          value={spec.sleeves}
          options={SLEEVES}
          onChange={(v) => set('sleeves', v)}
          format={(v) => (v === 'short' ? 'Short' : 'Long')}
        />
        <Select label="Arms" value={spec.arms} options={ARMS} onChange={(v) => set('arms', v)} />
        <label className="check">
          <input type="checkbox" checked={spec.glasses} onChange={(e) => set('glasses', e.target.checked)} />
          Glasses
        </label>
        <label className="check">
          <input type="checkbox" checked={spec.lashes} onChange={(e) => set('lashes', e.target.checked)} />
          Lashes
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={!!spec.lips}
            onChange={(e) => {
              if (e.target.checked) set('lips', '#c2465a');
              else {
                const { lips: _, ...rest } = spec;
                onChange(rest);
              }
            }}
          />
          Lip color
        </label>
      </div>
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  format = (v) => LABELS[v] ?? v,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
