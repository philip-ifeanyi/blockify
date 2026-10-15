# Blockify

Turn a photo into a blocky game-style avatar: a profile picture, a Minecraft-compatible skin file, or a spinning 3D turntable.

Styles: **Blocky** (8px-head, 64×64 skin) and **Brick** (chunky toy proportions).
Not affiliated with Mojang, Microsoft, or Roblox.

## Layout
- `packages/core`: the whole pipeline in pure, isomorphic TypeScript (no native deps). It runs the same in the browser and Node.
  - `analyze/`: photo → `Features` → `CharacterSpec`. It samples face-aligned regions around a 478-point face mesh (skin, hair, beard, glasses, eyes, mouth, shirt). The detector is pluggable.
  - `spec/`: `CharacterSpec` (plain JSON), validation, and URL encoding
  - `skin/`: paints a spec onto the standard 64×64 skin layout
  - `render/`: software orthographic renderer for textured cuboids (any yaw/pitch, SSAA)
  - `outputs/`: `profilePic()`, `skinFile()`, `turntable()`
  - `node/` (`@blockify/core/node`): JPEG/PNG decoding and the Node face detector (`@vladmandic/human` on WebAssembly, offline)
- `apps/web`, `apps/discord-bot`: coming next (see the plan)

## Try it
```bash
pnpm install
pnpm core:try                              # hand-written sample specs → packages/core/out
pnpm core:try path/to/photo.jpg --debug    # photo → avatar; --debug also writes the sampled regions
pnpm core:try photo.jpg --style brick
pnpm test
```

## Photo analysis: known limits
Analysis is heuristic, so the web app will let users fix the result. It works best with a front-facing, well-lit photo where the face is at least ~150px wide. The current weak spots:
- Light blonde hair on fair skin in small photos can come out as short brown hair.
- Grey hair against a black background can come out darker than it is.
- It's deliberately conservative about beards and can miss light stubble.

`packages/core/test/fixtures/photos` has labelled Unsplash portraits. `pnpm test` checks that the detected features still match the labels.
