import type { ExhibitionItem } from "../data/exhibition";

export interface SectionBriefingProps {
  eyebrow: string;
  title: string;
  description: string;
  activeItem: ExhibitionItem | null;
  onOpenDetails?: (item: ExhibitionItem) => void;
}

export function SectionBriefing({ eyebrow, title, description, activeItem, onOpenDetails }: SectionBriefingProps) {
  return (
    <aside className="section-briefing" aria-label={`${title} 简介`}>
      <div className="section-briefing-text">
        <span className="section-briefing-eyebrow">{eyebrow}</span>
        <h2 className="section-briefing-title">{title}</h2>
        <p className="section-briefing-description">{description}</p>
      </div>
      {activeItem && onOpenDetails ? (
        <div className="section-briefing-actions">
          <button
            type="button"
            className="section-briefing-button"
            onClick={() => onOpenDetails(activeItem)}
            aria-label={`放大查看：${activeItem.title}`}
            title="放大查看"
          >
            <span className="section-briefing-button-dot" aria-hidden="true" />
            <span>{activeItem.title}</span>
          </button>
        </div>
      ) : null}
    </aside>
  );
}
