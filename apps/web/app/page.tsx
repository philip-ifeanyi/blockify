import { Studio } from '@/components/Studio';

export default function Home() {
  return (
    <main className="page">
      <header className="masthead">
        <h1 className="wordmark">
          <span aria-hidden className="wordmark-block" />
          Blockify
        </h1>
        <p className="tagline">
          Turn a photo into a blocky avatar. It all runs in your browser, so <strong>your photo never leaves your device</strong>.
        </p>
      </header>
      <Studio />
      <footer className="footer">
        Skins use the standard 64×64 layout and work with Minecraft. Not affiliated with Mojang, Microsoft or Roblox.
      </footer>
    </main>
  );
}
