import { Home, Play, RotateCcw } from 'lucide-react';
import type { SiteConfig } from '../types/content';

interface TopBarProps {
  site: SiteConfig;
  onHome: () => void;
  onPlaylist: () => void;
}

export function TopBar({ site, onHome, onPlaylist }: TopBarProps) {
  const refreshContent = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } finally {
      window.location.reload();
    }
  };

  return (
    <header className="top-bar">
      <button className="brand-button" type="button" onClick={onHome}>
        <img src="/images/brand/logo.webp" alt="" className="brand-logo" />
        <span>
          <strong>{site.name}</strong>
          <small>{site.tagline}</small>
        </span>
      </button>
      <nav className="top-actions" aria-label="全局操作">
        <button type="button" className="icon-button" onClick={onHome} title="回首页">
          <Home size={22} />
        </button>
        <button type="button" className="icon-button" onClick={onPlaylist} title="进入轮播">
          <Play size={22} />
        </button>
        <button type="button" className="text-button" onClick={refreshContent}>
          <RotateCcw size={20} />
          刷新内容
        </button>
      </nav>
    </header>
  );
}
