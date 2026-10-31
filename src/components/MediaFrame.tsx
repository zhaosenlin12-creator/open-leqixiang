import type { DisplayAsset } from '../types/content';

interface MediaFrameProps {
  asset?: DisplayAsset;
  label?: string;
  fit?: 'contain' | 'cover';
  autoplay?: boolean;
}

export function MediaFrame({ asset, label, fit = 'cover', autoplay = false }: MediaFrameProps) {
  if (!asset) {
    return (
      <div className="media-frame media-placeholder">
        <span>{label ?? '素材待补充'}</span>
      </div>
    );
  }

  if (asset.type === 'video') {
    return (
      <div className={`media-frame fit-${fit}`}>
        <video src={asset.path} autoPlay={autoplay} muted loop playsInline />
      </div>
    );
  }

  return (
    <div className={`media-frame fit-${fit}`}>
      <img src={asset.path} alt={label ?? asset.title} />
    </div>
  );
}

