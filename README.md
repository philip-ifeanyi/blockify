# Blockify

Turn a photo into a blocky game-style avatar: a profile picture, a Minecraft-compatible skin file, or a spinning 3D turntable.

Styles: **Blocky** (8px-head, 64×64 skin), **Brick** (chunky toy proportions), and **Mosaic** (the photo itself rebuilt from 16–64 blocks per side, as beveled blocks, studs or flat pixels).

Characters support classic (4px) or slim (3px) arms, matching Minecraft's Steve/Alex models, plus lashes, lip color and hairstyles: bald, buzz, short, medium, bob, long, afro, bun and ponytail. The bun and ponytail stick out of the head in our renders; the skin file draws them flat, because Minecraft skins can't. Analysis never guesses gender. Hairstyle (including buns) and clearly colored lips are read from the photo, and arms and lashes are the user's choice.
Not affiliated with Mojang, Microsoft, or Roblox.

## Layout
- `packages/core`: the whole pipeline in pure, isomorphic TypeScript (no native deps). It runs the same in the browser and Node.
  - `analyze/`: photo → `Features` → `CharacterSpec`. It samples face-aligned regions around a 478-point face mesh (skin, hair, beard, glasses, eyes, mouth, shirt). The detector is pluggable.
  - `spec/`: `CharacterSpec` (plain JSON), validation, and URL encoding
  - `skin/`: paints a spec onto the standard 64×64 skin layout
  - `render/`: software orthographic renderer for textured cuboids (any yaw/pitch, SSAA)
  - `outputs/`: `profilePic()`, `skinFile()`, `turntable()`
  - `mosaic/`: `buildMosaic()` (face-centred crop → grid → median-cut + k-means palette), `renderMosaic()`, and a compact `encodeMosaic()` for share links (`?m=`)
  - `node/` (`@blockify/core/node`): JPEG/PNG decoding and the Node face detector (`@vladmandic/human` on WebAssembly, offline)
- `apps/web`: Next.js app. Pick a photo, then fine-tune the result and download a PNG, a skin or a GIF, or copy a share link. Face detection runs in the browser on WebGL, and the models are served from `/models`, so the photo is never uploaded. The 1.5MB detector loads only once a photo is picked. Share links carry the character spec in `?s=`, never the photo.
- `apps/discord-bot`: coming next (see the plan)

## Try it
```bash
pnpm install
pnpm dev               # web app on http://localhost:3000 (add -- --port 3100 if that's taken)
pnpm core:try                              # hand-written sample specs → packages/core/out
pnpm core:try path/to/photo.jpg --debug    # photo → avatar; --debug also writes the sampled regions
pnpm core:try photo.jpg --style brick
pnpm test
```

## Docker
The web app ships as a single container built from the monorepo root. It's a multi-stage build that runs Next.js standalone output on `node:24-slim` as the non-root `node` user, with a health check on `/api/health`.

```bash
docker compose up -d --build           # http://localhost:8080
BLOCKIFY_PORT=9000 docker compose up -d   # pick another host port
```

Or without compose:
```bash
docker build -t blockify-web .
docker run --rm -p 8080:3000 blockify-web
```

The container serves the face models from `/models` and never receives photos: analysis runs in the visitor's browser.

## Photo analysis: known limits
Analysis is heuristic, so the web app will let users fix the result. It works best with a front-facing, well-lit photo where the face is at least ~150px wide. The current weak spots:
- Light blonde hair on fair skin in small photos can come out as short brown hair.
- Grey hair against a black background can come out darker than it is.
- It's deliberately conservative about beards and can miss light stubble.

`packages/core/test/fixtures/photos` has labelled Unsplash portraits. `pnpm test` checks that the detected features still match the labels.
