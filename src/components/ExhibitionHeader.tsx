import * as React from 'react';
import {
  Pause,
  Play,
  Volume2,
  VolumeX
} from 'lucide-react';
import { navigation, type SectionId } from '../data/exhibition';
import { prefetchStudentThumbs } from '../lib/studentArchive';

interface ExhibitionHeaderProps {
  activeSection: SectionId;
  isPlaying: boolean;
  muted: boolean;
  onNavigate: (section: SectionId) => void;
  onTogglePlaying: () => void;
  onToggleMuted: () => void;
}

function ExhibitionHeaderInner({
  activeSection,
  isPlaying,
  muted,
  onNavigate,
  onTogglePlaying,
  onToggleMuted
}: ExhibitionHeaderProps) {
  return (
    <header className="exhibition-header">
      <button
        type="button"
        className="brand-mark"
        onClick={() => onNavigate('home')}
        aria-label="返回首页"
      >
        <img src="/images/brand/logo.webp" alt="乐启享" />
      </button>

      <nav className="primary-navigation" aria-label="展厅分类">
        {navigation.map((item) => (
          <button
          type="button"
          key={item.id}
          data-section={item.id}
          data-nav-item={item.id}
          className={activeSection === item.id ? 'is-active' : ''}
          onClick={() => onNavigate(item.id)}
          onMouseEnter={() => {
            if (item.id === 'students') prefetchStudentThumbs();
            if (item.id !== 'home') void import('./CategoryStage');
          }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="media-controls">
        <button
          type="button"
          className="header-control icon-only"
          data-state={isPlaying ? 'playing' : 'paused'}
          onClick={onTogglePlaying}
          aria-label={isPlaying ? '暂停轮播' : '开始轮播'}
          title={isPlaying ? '暂停轮播' : '开始轮播'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          type="button"
          className="header-control icon-only"
          onClick={onToggleMuted}
          aria-label={muted ? '打开声音' : '关闭声音'}
          title={muted ? '打开声音' : '关闭声音'}
        >
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      </div>
    </header>
  );
}

// All props come from App; the component has no internal state, so memoising
// it skips a re-render whenever the parent re-renders for unrelated reasons
// (e.g. pointer-move in CategoryStage).
export const ExhibitionHeader = React.memo(ExhibitionHeaderInner);
