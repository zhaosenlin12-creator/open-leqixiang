import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ExhibitionHeader } from "./components/ExhibitionHeader";
import type { ExpansionOrigin } from "./components/OrbitGallery";
import {
  heroSlides,
  navigation,
  sections,
  sectionOrder,
  type ExhibitionItem,
  type SectionId
} from "./data/exhibition";

const HeroCarousel = React.lazy(() =>
  import("./components/HeroCarousel").then((m) => ({ default: m.HeroCarousel }))
);
const CategoryStage = React.lazy(() =>
  import("./components/CategoryStage").then((m) => ({ default: m.CategoryStage }))
);
const LayeredDrawer = React.lazy(() =>
  import("./components/LayeredDrawer").then((m) => ({ default: m.LayeredDrawer }))
);

interface DrawerState {
  items: ExhibitionItem[];
  index: number;
  origin?: ExpansionOrigin;
}

interface ClosingDrawerState {
  item: ExhibitionItem;
  items: ExhibitionItem[];
  index: number;
  origin?: ExpansionOrigin;
}

const tourOrder: SectionId[] = ["home", ...sectionOrder];
const SIDE_PANEL_SECTIONS = new Set<SectionId>(["students", "courses", "pricing", "staff", "honors", "about", "qidian", "yanxue"]);

export default function App() {
  const [activeSection, setActiveSection] = useState<SectionId>("home");
  const [heroIndex, setHeroIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [closingDrawer, setClosingDrawer] = useState<ClosingDrawerState | null>(null);
  const drawerItem = useMemo(() => drawer?.items[drawer.index] ?? null, [drawer]);
  const closingDrawerItem = useMemo(() => closingDrawer?.item ?? null, [closingDrawer]);
  const navigate = useCallback((section: SectionId, options?: { startTour?: boolean }) => {
    setActiveSection(section);
    setDrawer(null);
    if (options?.startTour && section !== "home") {
      setIsPlaying(true);
    }
  }, []);

  const openDetails = useCallback((item: ExhibitionItem, items: ExhibitionItem[], origin?: ExpansionOrigin) => {
    setClosingDrawer(null);
    setDrawer({ items, index: Math.max(0, items.findIndex((entry) => entry.id === item.id)), origin });
  }, []);

  const togglePlaying = useCallback(() => {
    setIsPlaying((current) => !current);
  }, []);

  const advanceTour = useCallback(() => {
    setActiveSection((current) => {
      const currentIndex = Math.max(0, tourOrder.indexOf(current));
      return tourOrder[(currentIndex + 1) % tourOrder.length];
    });
    setHeroIndex(0);
  }, []);

  const handleNavigate = useCallback(
    (section: SectionId) => navigate(section, { startTour: !isPlaying }),
    [navigate, isPlaying]
  );
  const toggleMuted = useCallback(() => setMuted((current) => !current), []);
  const changeDrawerItem = useCallback(
    (index: number) => setDrawer((current) => (current ? { ...current, index } : null)),
    []
  );
  const commitDrawerClose = useCallback(() => {
    setDrawer((current) => {
      if (!current) return null;
      const item = current.items[current.index];
      if (!item) return null;
      setClosingDrawer({ ...current, item });
      return null;
    });
  }, []);
  const closeExitDrawer = useCallback(() => setClosingDrawer(null), []);
  const noOp = useCallback(() => undefined, []);

  const sectionKey = activeSection;

  // Suspense fallback={null} so we don'\''t flash a spinner on top of the
  // already-visible shell (header + scrim + page background paint as part of
  // the initial bundle). The lazy chunks are tiny (<14 KB each) and resolve
  // in <50 ms on local dev; the user should never see the empty slot.
  return (
    <main className="spatial-stage">
      <ExhibitionHeader
        activeSection={activeSection}
        isPlaying={isPlaying}
        muted={muted}
        onNavigate={handleNavigate}
        onTogglePlaying={togglePlaying}
        onToggleMuted={toggleMuted}
      />

      <ErrorBoundary scope={activeSection} key={sectionKey}>
        <React.Suspense fallback={null}>
          {activeSection === "home" ? (
            <HeroCarousel
              items={heroSlides}
              activeIndex={heroIndex}
              isPlaying={isPlaying && !drawer}
              muted={muted}
              onActiveIndexChange={setHeroIndex}
              onOpenDetails={(item) => openDetails(item, heroSlides)}
              onComplete={advanceTour}
            />
          ) : (
            <CategoryStage
              section={sections[activeSection as Exclude<SectionId, "home">]}
              isTourPlaying={isPlaying}
              isDetailOpen={Boolean(drawer)}
              muted={muted}
              onOpenDetails={openDetails}
              onComplete={advanceTour}
            />
          )}
        </React.Suspense>
      </ErrorBoundary>

      <ErrorBoundary scope="drawer">
        <React.Suspense fallback={null}>
          <LayeredDrawer
            item={drawerItem}
            items={drawer?.items ?? []}
            origin={drawer?.origin}
            activeSection={activeSection}
            muted={muted}
            backdropPaused={Boolean(drawer)}
            variant={SIDE_PANEL_SECTIONS.has(activeSection) ? "side-panel" : "cinematic"}
            onNavigate={navigate}
            onItemChange={changeDrawerItem}
            onClose={commitDrawerClose}
            onExited={closeExitDrawer}
          />
          <LayeredDrawer
            item={closingDrawerItem}
            items={closingDrawer?.items ?? []}
            origin={closingDrawer?.origin}
            activeSection={activeSection}
            muted={muted}
            backdropPaused={false}
            variant={SIDE_PANEL_SECTIONS.has(activeSection) ? "side-panel" : "cinematic"}
            onNavigate={navigate}
            onItemChange={noOp}
            onClose={closeExitDrawer}
            onExited={closeExitDrawer}
          />
        </React.Suspense>
      </ErrorBoundary>
    </main>
  );
}

