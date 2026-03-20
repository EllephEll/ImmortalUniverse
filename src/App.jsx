import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BrowserRouter,
  HashRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  familyTrees as defaultFamilyTrees,
  timelineHighlights as defaultTimelineHighlights,
} from './data/universe';

const STORAGE_KEYS = {
  content: 'immortal-universe-content-v2',
  session: 'immortal-universe-session-v1',
};
const CONTENT_SCHEMA_VERSION = 5;

const ADMIN_ACCOUNT = {
  username: 'Elleph',
  password: '$Tigerlily1127',
  role: 'admin',
};
const ADMIN_ONLY_FAMILY_TREE_IDS = new Set(['mayfairs', 'blackwoods']);

const LEGACY_TIMELINE_TITLES = ['Origins', 'Expansion', 'Fracture', 'Modern Tension'];
const TIMELINE_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MIN_TREE_ZOOM = 0.1;
const MAX_TREE_ZOOM = 1.9;
const FAMILY_CARD_WIDTH = 184;
const FAMILY_CARD_HEIGHT = 96;
const FAMILY_LAYOUT_PADDING_X = 42;
const FAMILY_LAYOUT_PADDING_Y = 40;

const pageTransition = {
  duration: 0.55,
  ease: [0.22, 1, 0.36, 1],
};

let modalBodyLockCount = 0;
let previousBodyOverflow = '';

function useModalLifecycle(onClose) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (typeof document !== 'undefined') {
      if (modalBodyLockCount === 0) {
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }

      modalBodyLockCount += 1;
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);

      if (typeof document !== 'undefined') {
        modalBodyLockCount = Math.max(0, modalBodyLockCount - 1);

        if (modalBodyLockCount === 0) {
          document.body.style.overflow = previousBodyOverflow;
          previousBodyOverflow = '';
        }
      }
    };
  }, [onClose]);
}

function clampTreeZoom(value) {
  return Math.min(MAX_TREE_ZOOM, Math.max(MIN_TREE_ZOOM, Number(value.toFixed(2))));
}

function canAccessFamilyTree(familyId, isAdmin) {
  return isAdmin || !ADMIN_ONLY_FAMILY_TREE_IDS.has(familyId);
}

function App() {
  const Router = import.meta.env.PROD ? HashRouter : BrowserRouter;
  const [content, setContent] = useState(loadStoredContent);
  const [session, setSession] = useState(loadStoredSession);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.content, JSON.stringify(content));
  }, [content]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (session) {
      window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
      return;
    }

    window.localStorage.removeItem(STORAGE_KEYS.session);
  }, [session]);

  function handleLogin({ username, password }) {
    const matchesAdmin =
      username === ADMIN_ACCOUNT.username && password === ADMIN_ACCOUNT.password;

    if (!matchesAdmin) {
      return {
        ok: false,
        message: 'That login was not recognized. Account creation is disabled.',
      };
    }

    setSession({
      username: ADMIN_ACCOUNT.username,
      role: ADMIN_ACCOUNT.role,
    });
    setIsLoginOpen(false);

    return { ok: true };
  }

  function handleLogout() {
    setSession(null);
  }

  function updateTimeline(nextTimeline) {
    setContent((currentContent) => ({
      ...currentContent,
      timelineHighlights: nextTimeline,
    }));
  }

  function updateFamilyTree(familyId, nextFamilyOrUpdater) {
    setContent((currentContent) => {
      const currentFamily = currentContent.familyTrees[familyId];
      const nextFamily =
        typeof nextFamilyOrUpdater === 'function'
          ? nextFamilyOrUpdater(currentFamily)
          : nextFamilyOrUpdater;

      return {
        ...currentContent,
        familyTrees: {
          ...currentContent.familyTrees,
          [familyId]: nextFamily,
        },
      };
    });
  }

  function resetFamilyTree(familyId) {
    setContent((currentContent) => ({
      ...currentContent,
      familyTrees: {
        ...currentContent.familyTrees,
        [familyId]: cloneValue(defaultFamilyTrees[familyId]),
      },
    }));
  }

  return (
    <Router>
      <ScrollToTop />
      <AppShell
        content={content}
        isAdmin={session?.role === 'admin'}
        session={session}
        onLoginOpen={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        onUpdateTimeline={updateTimeline}
        onUpdateFamilyTree={updateFamilyTree}
        onResetFamilyTree={resetFamilyTree}
      />
      <AnimatePresence>
        {isLoginOpen ? (
          <LoginModal
            key="login-modal"
            onClose={() => setIsLoginOpen(false)}
            onLogin={handleLogin}
          />
        ) : null}
      </AnimatePresence>
    </Router>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
}

function AppShell({
  content,
  isAdmin,
  session,
  onLoginOpen,
  onLogout,
  onUpdateTimeline,
  onUpdateFamilyTree,
  onResetFamilyTree,
}) {
  const location = useLocation();

  return (
    <div className="app-shell">
      <DecorativeBackdrop />
      <div className="top-utility-bar">
        <CornerAuthControl session={session} onLoginOpen={onLoginOpen} onLogout={onLogout} />
      </div>

      <header className="site-header">
        <NavLink to="/" className="brandmark">
          <span className="brandmark__symbol">IU</span>
          <span>
            <strong>Immortal Universe</strong>
            <small>Interactive story atlas</small>
          </span>
        </NavLink>

        <div className="site-header__cluster">
          <nav className="site-nav" aria-label="Primary">
            <AppNavLink to="/">Home</AppNavLink>
            <AppNavLink to="/timeline">Timeline</AppNavLink>
            <AppNavLink to="/family-trees">Genealogies</AppNavLink>
          </nav>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={<HomePage />}
          />
          <Route
            path="/timeline"
            element={
              <TimelinePage
                isAdmin={isAdmin}
                timelineEntries={content.timelineHighlights}
                onUpdateTimeline={onUpdateTimeline}
              />
            }
          />
          <Route
            path="/family-trees"
            element={
              <FamilyTreesPage
                familyTreeMap={content.familyTrees}
                isAdmin={isAdmin}
                onResetFamilyTree={onResetFamilyTree}
                onUpdateFamilyTree={onUpdateFamilyTree}
              />
            }
          />
        </Routes>
      </AnimatePresence>

    </div>
  );
}

function CornerAuthControl({ session, onLoginOpen, onLogout }) {
  return (
    <div className="corner-auth">
      {session ? (
        <>
          <span className="corner-auth__status">Admin</span>
          <button type="button" className="corner-auth__button" onClick={onLogout}>
            Log Out
          </button>
        </>
      ) : (
        <button type="button" className="corner-auth__button" onClick={onLoginOpen}>
          Admin Login
        </button>
      )}
    </div>
  );
}

function AppNavLink({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `site-nav__link${isActive ? ' site-nav__link--active' : ''}`
      }
    >
      {children}
    </NavLink>
  );
}

function DecorativeBackdrop() {
  return (
    <div className="decorative-backdrop" aria-hidden="true">
      <div className="decorative-backdrop__orb decorative-backdrop__orb--teal" />
      <div className="decorative-backdrop__orb decorative-backdrop__orb--amber" />
      <div className="decorative-backdrop__orb decorative-backdrop__orb--sage" />
      <div className="decorative-backdrop__mesh" />
    </div>
  );
}

function PageShell({ children }) {
  return (
    <motion.main
      className="page-shell"
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -22 }}
      transition={pageTransition}
    >
      {children}
    </motion.main>
  );
}

function HeroPanel({ eyebrow, title, lede, actions, aside }) {
  const hasAside = Boolean(aside);

  return (
    <section className={`hero-panel${hasAside ? '' : ' hero-panel--full'}`}>
      <div className="hero-panel__content">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p className="hero-panel__lede">{lede}</p>
        <div className="hero-actions">{actions}</div>
      </div>
      {hasAside ? <div className="hero-panel__aside">{aside}</div> : null}
    </section>
  );
}

function HomePage() {
  return (
    <PageShell>
      <section className="hero-panel hero-panel--full hero-panel--minimal">
        <div className="hero-panel__content hero-panel__content--minimal">
          <div className="hero-actions hero-actions--centered">
            <NavLink className="button button--primary button--home" to="/timeline">
              Timeline
            </NavLink>
            <NavLink className="button button--secondary button--home button--home-blood" to="/family-trees">
              Genealogies
            </NavLink>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function TimelinePage({
  isAdmin,
  timelineEntries,
  onUpdateTimeline,
}) {
  const [zoomLevel, setZoomLevel] = useState(2.4);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const groupedTimelineEntries = groupTimelineEntries(normalizeTimelineEntries(timelineEntries));
  const latestYear = groupedTimelineEntries[groupedTimelineEntries.length - 1]?.year ?? null;
  const [activeYear, setActiveYear] = useState(latestYear);

  useEffect(() => {
    if (!groupedTimelineEntries.some((group) => group.year === activeYear)) {
      setActiveYear(latestYear);
    }
  }, [activeYear, groupedTimelineEntries, latestYear]);

  function handleCreateTimelineEntry(nextEntry) {
    onUpdateTimeline([
      ...timelineEntries,
      {
        year: nextEntry.year,
        month: nextEntry.month,
        day: nextEntry.day,
        title: nextEntry.title,
        description: nextEntry.description,
      },
    ]);
    setActiveYear(nextEntry.year);
    setIsAddEventOpen(false);
  }

  return (
    <>
      <PageShell>
        <TimelineExplorer
          entries={timelineEntries}
          isAdmin={isAdmin}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          activeYear={activeYear}
          onActiveYearChange={setActiveYear}
          onOpenAddEvent={() => setIsAddEventOpen(true)}
        />

        {isAdmin ? (
          <TimelineEditor
            entries={timelineEntries}
            activeYear={activeYear}
            onActiveYearChange={setActiveYear}
            onUpdateTimeline={onUpdateTimeline}
          />
        ) : null}
      </PageShell>

      <AnimatePresence>
        {isAdmin && isAddEventOpen ? (
          <AddEventModal
            key={`add-event-${activeYear ?? 'new'}`}
            initialYear={activeYear ?? getNextTimelineYear(timelineEntries)}
            onClose={() => setIsAddEventOpen(false)}
            onCreate={handleCreateTimelineEntry}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function TimelineExplorer({
  entries,
  isAdmin,
  zoomLevel,
  onZoomChange,
  activeYear,
  onActiveYearChange,
  onOpenAddEvent,
}) {
  const viewportRef = useRef(null);
  const jumpInputRef = useRef(null);
  const pendingZoomAnchorRef = useRef(null);
  const hasInitializedZoomRef = useRef(false);
  const hasInitializedViewportPositionRef = useRef(false);
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
  });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportScrollLeft, setViewportScrollLeft] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const normalizedZoom = Number(zoomLevel);
  const groupedTimelineEntries = groupTimelineEntries(normalizeTimelineEntries(entries));
  const [jumpQuery, setJumpQuery] = useState('');
  const [isJumpFocused, setIsJumpFocused] = useState(false);
  const [jumpFeedback, setJumpFeedback] = useState('');
  const surfaceInset = 38;
  const baseYearWidth = 290.4;
  const yearWidth = baseYearWidth;
  const gapYearWidth = yearWidth;
  const baseRibbonHeight = 451.2;
  const firstYear = groupedTimelineEntries[0]?.year ?? 1;
  const lastYear = groupedTimelineEntries[groupedTimelineEntries.length - 1]?.year ?? firstYear;
  const firstYearIndex = getTimelineYearIndex(firstYear);
  const lastYearIndex = getTimelineYearIndex(lastYear);
  const availableTrackWidth = Math.max(48, viewportWidth - surfaceInset * 2);

  const segments = [];
  let ribbonCursor = 0;

  groupedTimelineEntries.forEach((group, index) => {
    const currentYearIndex = getTimelineYearIndex(group.year);

    segments.push({
      type: 'event',
      group,
      colorVariant: index % 2 === 0 ? 'teal' : 'coral',
      left: ribbonCursor,
      width: yearWidth,
    });

    ribbonCursor += yearWidth;

    const nextGroup = groupedTimelineEntries[index + 1];

    if (!nextGroup) {
      return;
    }

    const nextYearIndex = getTimelineYearIndex(nextGroup.year);
    const gapYears = Math.max(0, nextYearIndex - currentYearIndex - 1);

    if (gapYears > 0) {
      const gapWidth = gapYears * gapYearWidth;

      segments.push({
        type: 'gap',
        left: ribbonCursor,
        width: gapWidth,
        gapYears,
        startYear: getTimelineYearFromIndex(currentYearIndex + 1),
        endYear: getTimelineYearFromIndex(nextYearIndex - 1),
      });

      ribbonCursor += gapWidth;
    }
  });

  const ribbonWidth = Math.max(ribbonCursor, 0);
  const visibleYearUnits = Math.max(1, ribbonWidth / baseYearWidth);
  const minZoom = Math.max(1, visibleYearUnits / 100);
  const maxZoom = Math.max(70, minZoom * 20);
  const fitScale =
    viewportWidth > 0 ? Math.min(1, availableTrackWidth / Math.max(ribbonWidth, 1)) : 1;
  const visualScale = fitScale * normalizedZoom;
  const scaledRibbonWidth = Math.max(1, Math.round(ribbonWidth * visualScale));
  const scrollCanvasWidth = Math.max(viewportWidth || 0, Math.round(surfaceInset * 2 + scaledRibbonWidth));
  const visibleContentLeft = Math.min(
    ribbonWidth,
    Math.max(0, (viewportScrollLeft - surfaceInset) / Math.max(visualScale, 0.001)),
  );
  const visibleContentRight = Math.min(
    ribbonWidth,
    Math.max(0, (viewportScrollLeft + viewportWidth - surfaceInset) / Math.max(visualScale, 0.001)),
  );
  const visibleStartYearIndex = Math.min(
    lastYearIndex,
    Math.max(
      firstYearIndex,
      firstYearIndex + Math.floor(Math.min(visibleContentLeft, Math.max(0, ribbonWidth - 1)) / yearWidth),
    ),
  );
  const visibleEndYearIndex = Math.min(
    lastYearIndex,
    Math.max(
      firstYearIndex,
      firstYearIndex +
        Math.floor(Math.max(0, Math.min(visibleContentRight, ribbonWidth) - 1) / yearWidth),
    ),
  );
  const visibleRangeLabel = formatTimelineYearRange(
    getTimelineYearFromIndex(visibleStartYearIndex),
    getTimelineYearFromIndex(visibleEndYearIndex),
  );
  const eventSegments = segments.filter((segment) => segment.type === 'event');
  const scaledTrackHeight = baseRibbonHeight * visualScale;
  const renderedSegmentWidth = yearWidth * visualScale;
  const zoomOutProgress = Number(
    Math.max(0, Math.min(1, (0.8 - visualScale) / 0.45)).toFixed(2),
  );
  const insideYearProgress = Number(
    Math.max(0, Math.min(1, (renderedSegmentWidth - 115) / 115)).toFixed(2),
  );
  const outsideYearProgress = Number((1 - insideYearProgress).toFixed(2));
  const yearMarkerLineHeight = Number(
    Math.max(0, outsideYearProgress * (24 + zoomOutProgress * 22)).toFixed(2),
  );
  const yearMarkerFontSize = Number(
    (15 + outsideYearProgress * (1.5 + zoomOutProgress * 5)).toFixed(2),
  );
  const yearMarkerBadgeHeight = Number(
    (36 + outsideYearProgress * (2 + zoomOutProgress * 8)).toFixed(2),
  );
  const yearMarkerPadX = Number((14 + outsideYearProgress * (1 + zoomOutProgress * 4)).toFixed(2));
  const yearMarkerGap = Number(
    Math.max(0, outsideYearProgress * (6 + zoomOutProgress * 4)).toFixed(2),
  );
  const yearMarkerShift = Number((insideYearProgress * 18).toFixed(2));
  const minMarkerSpacing = Number((78 + zoomOutProgress * 38).toFixed(2));
  const yearMarkers = [];
  let lastMarkerCenter = Number.NEGATIVE_INFINITY;

  eventSegments.forEach((segment) => {
    const center = surfaceInset + (segment.left + segment.width / 2) * visualScale;

    if (center - lastMarkerCenter < minMarkerSpacing) {
      return;
    }

    yearMarkers.push({
      center,
      year: segment.group.year,
    });
    lastMarkerCenter = center;
  });

  const activeGroup =
    groupedTimelineEntries.find((group) => group.year === activeYear) ?? groupedTimelineEntries[0];
  const jumpSuggestions = findTimelineYearSuggestions(jumpQuery, groupedTimelineEntries);

  useEffect(() => {
    if (!hasInitializedZoomRef.current) {
      if (viewportWidth <= 0) {
        return;
      }

      hasInitializedZoomRef.current = true;
      onZoomChange((minZoom + maxZoom) / 2);
      return;
    }

    if (normalizedZoom < minZoom) {
      onZoomChange(minZoom);
      return;
    }

    if (normalizedZoom > maxZoom) {
      onZoomChange(maxZoom);
    }
  }, [maxZoom, minZoom, normalizedZoom, onZoomChange, viewportWidth]);

  useEffect(() => {
    setJumpFeedback('');
  }, [activeYear]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return undefined;
    }

    function syncViewportMetrics() {
      setViewportWidth(viewport.clientWidth);
      setViewportScrollLeft(viewport.scrollLeft);
    }

    syncViewportMetrics();

    const resizeObserver = new ResizeObserver(() => {
      syncViewportMetrics();
    });

    resizeObserver.observe(viewport);
    viewport.addEventListener('scroll', syncViewportMetrics, { passive: true });

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener('scroll', syncViewportMetrics);
    };
  }, []);

  useLayoutEffect(() => {
    const pendingZoomAnchor = pendingZoomAnchorRef.current;
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (pendingZoomAnchor) {
      const targetCenter =
        surfaceInset + getRibbonPositionForYear(pendingZoomAnchor.year) * visualScale;
      const nextScrollLeft = targetCenter - pendingZoomAnchor.focusX;
      const nextMaxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

      viewport.scrollLeft = Math.min(Math.max(0, nextScrollLeft), nextMaxScroll);
      setViewportScrollLeft(viewport.scrollLeft);
      pendingZoomAnchorRef.current = null;
      return;
    }

    if (!hasInitializedViewportPositionRef.current && hasInitializedZoomRef.current && viewportWidth > 0) {
      viewport.scrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      setViewportScrollLeft(viewport.scrollLeft);
      hasInitializedViewportPositionRef.current = true;
    }
  }, [scrollCanvasWidth, surfaceInset, viewportWidth, visualScale]);

  function getYearIndexAtViewportPosition(viewportX) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return getTimelineYearIndex(activeYear ?? firstYear);
    }

    const contentX = Math.min(
      ribbonWidth,
      Math.max(
        0,
        (viewport.scrollLeft + viewportX - surfaceInset) / Math.max(visualScale, 0.001),
      ),
    );

    for (const segment of segments) {
      if (segment.type === 'event') {
        const segmentRight = segment.left + segment.width;

        if (contentX <= segmentRight) {
          return getTimelineYearIndex(segment.group.year);
        }

        continue;
      }

      const segmentRight = segment.left + segment.width;

      if (contentX <= segmentRight) {
        const startIndex = getTimelineYearIndex(segment.startYear);
        const offsetYears = Math.floor((contentX - segment.left) / gapYearWidth);
        return Math.min(lastYearIndex, Math.max(firstYearIndex, startIndex + offsetYears));
      }
    }

    return lastYearIndex;
  }

  function setZoomPreservingPosition(nextZoom, focusClientX) {
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    const focusX =
      typeof focusClientX === 'number' && rect
        ? focusClientX - rect.left
        : (viewport?.clientWidth ?? 0) / 2;
    const clampedZoom = clampZoom(nextZoom, minZoom, maxZoom);
    const anchoredYear = getTimelineYearFromIndex(getYearIndexAtViewportPosition(focusX));

    if (clampedZoom === normalizedZoom) {
      return;
    }

    pendingZoomAnchorRef.current = {
      year: anchoredYear,
      focusX,
    };

    onZoomChange(clampedZoom);
  }

  function handlePointerDown(event) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    const viewport = viewportRef.current;

    if (!viewport || !dragStateRef.current.isDragging) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;
    viewport.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
  }

  function handlePointerUp() {
    if (!dragStateRef.current.isDragging) {
      return;
    }

    dragStateRef.current.isDragging = false;
    setIsDragging(false);
  }

  function getYearIndexNearViewportCenter() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return getTimelineYearIndex(activeYear ?? firstYear);
    }

    return getYearIndexAtViewportPosition(viewport.clientWidth / 2);
  }

  function getRibbonPositionForYear(targetYear) {
    const clampedYearIndex = Math.min(
      lastYearIndex,
      Math.max(firstYearIndex, getTimelineYearIndex(targetYear)),
    );

    for (const segment of segments) {
      if (segment.type === 'event' && getTimelineYearIndex(segment.group.year) === clampedYearIndex) {
        return segment.left + segment.width / 2;
      }

      if (segment.type === 'gap') {
        const startIndex = getTimelineYearIndex(segment.startYear);
        const endIndex = getTimelineYearIndex(segment.endYear);

        if (clampedYearIndex >= startIndex && clampedYearIndex <= endIndex) {
          return segment.left + (clampedYearIndex - startIndex + 0.5) * gapYearWidth;
        }
      }
    }

    return ribbonWidth / 2;
  }

  function scrollTimelineToYear(targetYear) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const targetCenter = surfaceInset + getRibbonPositionForYear(targetYear) * visualScale;
    const targetScrollLeft = targetCenter - viewport.clientWidth / 2;
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

    viewport.scrollTo({
      left: Math.min(Math.max(0, targetScrollLeft), maxScrollLeft),
      behavior: 'smooth',
    });
  }

  function handleYearJump(direction, stepSize) {
    const centeredYearIndex = getYearIndexNearViewportCenter();
    const nextYearIndex = Math.min(
      lastYearIndex,
      Math.max(firstYearIndex, centeredYearIndex + direction * stepSize),
    );

    scrollTimelineToYear(getTimelineYearFromIndex(nextYearIndex));
    setJumpFeedback('');
  }

  function handleJumpSuggestionSelect(suggestion) {
    const { year } = suggestion;
    const targetSegment = segments.find(
      (segment) => segment.type === 'event' && segment.group.year === year,
    );
    const viewport = viewportRef.current;

    if (!targetSegment || !viewport) {
      return;
    }

    scrollTimelineToYear(year);
    onActiveYearChange(year);
    setJumpQuery('');
    setJumpFeedback('');
    setIsJumpFocused(false);
    jumpInputRef.current?.blur();
  }

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return undefined;
    }

    function handleViewportWheel(event) {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        viewport.scrollLeft += event.deltaX;
        return;
      }

      event.preventDefault();
      setZoomPreservingPosition(
        normalizedZoom * Math.exp(-event.deltaY / 140),
        event.clientX,
      );
    }

    viewport.addEventListener('wheel', handleViewportWheel, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleViewportWheel);
    };
  }, [fitScale, maxZoom, minZoom, normalizedZoom, ribbonWidth, visualScale]);

  return (
    <section className="timeline-explorer">
      <div className="timeline-explorer__header">
        <div className="timeline-explorer__copy">
          <h2>Chronology Bar</h2>
          <p className="timeline-explorer__description">
            Event segments alternate between teal and coral, while red spans show years with no
            recorded information.
          </p>
        </div>

        <div className="timeline-explorer__actions">
          <div className="timeline-jump" role="search">
            <div className="timeline-jump__field">
              <input
                ref={jumpInputRef}
                type="text"
                value={jumpQuery}
                onChange={(event) => {
                  setJumpQuery(event.target.value);
                  setJumpFeedback('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                  }
                }}
                onFocus={() => setIsJumpFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => {
                    setIsJumpFocused(false);
                  }, 120);
                }}
                placeholder="Search"
                aria-label="Search"
                autoComplete="off"
              />
            </div>

            {isJumpFocused && jumpQuery.trim() && jumpSuggestions.length > 0 ? (
              <div className="timeline-jump__suggestions">
                {jumpSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="timeline-jump__suggestion"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleJumpSuggestionSelect(suggestion);
                    }}
                  >
                    <span className="timeline-jump__suggestion-title">{suggestion.title}</span>
                    <span className="timeline-jump__suggestion-year">{suggestion.yearLabel}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {isAdmin ? (
            <button type="button" className="button button--primary" onClick={onOpenAddEvent}>
              Add Event
            </button>
          ) : null}

          {jumpFeedback ? (
            <p className="timeline-jump__feedback" role="status">
              {jumpFeedback}
            </p>
          ) : null}
        </div>
      </div>

      <p className="timeline-explorer__hint">
        Scroll left and right to move through the years. Scroll up and down directly over the
        timeline to zoom in and out. You can also drag the timeline sideways.
      </p>

      <div className="timeline-surface">
        <div className="timeline-surface__topbar">
          <div className="timeline-surface__topbar-buttons">
            <button
              type="button"
              className="timeline-surface__nav-button"
              onClick={() => handleYearJump(-1, 1000)}
            >
              <span aria-hidden="true">&larr;</span>
              <span>Back 1,000 Years</span>
            </button>

            <button
              type="button"
              className="timeline-surface__nav-button"
              onClick={() => handleYearJump(-1, 100)}
            >
              <span aria-hidden="true">&larr;</span>
              <span>Back 100 Years</span>
            </button>

            <button
              type="button"
              className="timeline-surface__nav-button timeline-surface__nav-button--compact"
              onClick={() => handleYearJump(-1, 10)}
            >
              <span aria-hidden="true">&larr;</span>
              <span>Back 10 Years</span>
            </button>

            <div className="timeline-surface__range timeline-surface__range-badge" aria-live="polite">
              <strong>{visibleRangeLabel}</strong>
            </div>

            <button
              type="button"
              className="timeline-surface__nav-button timeline-surface__nav-button--compact"
              onClick={() => handleYearJump(1, 10)}
            >
              <span>Skip 10 Years</span>
              <span aria-hidden="true">&rarr;</span>
            </button>

            <button
              type="button"
              className="timeline-surface__nav-button"
              onClick={() => handleYearJump(1, 100)}
            >
              <span>Skip 100 Years</span>
              <span aria-hidden="true">&rarr;</span>
            </button>

            <button
              type="button"
              className="timeline-surface__nav-button"
              onClick={() => handleYearJump(1, 1000)}
            >
              <span>Skip 1,000 Years</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>

        <div
          ref={viewportRef}
          className={`timeline-viewport${isDragging ? ' timeline-viewport--dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          >
            <div
              className="timeline-scroll-width"
              style={{
                width: `${scrollCanvasWidth}px`,
              }}
            >
              <div className="timeline-year-marker-layer" aria-hidden="true">
                {yearMarkers.map((marker, index) => (
                  <div
                    key={`year-marker-${marker.year}-${index}`}
                    className="timeline-year-marker"
                    style={{
                      left: `${marker.center}px`,
                      bottom: `calc(50% + ${scaledTrackHeight / 2}px - 6px)`,
                      '--timeline-year-line-height': `${yearMarkerLineHeight}px`,
                      '--timeline-year-font-size': `${yearMarkerFontSize}px`,
                      '--timeline-year-badge-height': `${yearMarkerBadgeHeight}px`,
                      '--timeline-year-badge-pad-x': `${yearMarkerPadX}px`,
                      '--timeline-year-marker-gap': `${yearMarkerGap}px`,
                      '--timeline-year-marker-opacity': outsideYearProgress,
                      '--timeline-year-marker-shift': `${yearMarkerShift}px`,
                    }}
                  >
                    <span className="timeline-year-marker__badge">
                      {formatTimelineYear(marker.year)}
                    </span>
                    <span className="timeline-year-marker__line" />
                  </div>
                ))}
              </div>
              <div
                className="timeline-track"
                style={{
                  left: `${surfaceInset}px`,
                  width: `${ribbonWidth}px`,
                height: `${baseRibbonHeight}px`,
                transform: `translateY(-50%) scale(${visualScale})`,
              }}
            >
              {segments.map((segment, index) => {
                if (segment.type === 'gap') {
                  return (
                    <div
                      key={`gap-${segment.startYear}-${segment.endYear}-${index}`}
                      className="timeline-segment timeline-segment--gap"
                      style={{
                        left: `${segment.left}px`,
                        width: `${segment.width}px`,
                      }}
                    >
                      {segment.width > 120 ? (
                        <span className="timeline-segment__gap-label">
                          {formatTimelineYearRange(segment.startYear, segment.endYear)}
                        </span>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <button
                    key={`event-${segment.group.year}-${index}`}
                    type="button"
                    className={`timeline-segment timeline-segment--event timeline-segment--${segment.colorVariant}${
                      index === 0 ? ' timeline-segment--start' : ''
                    }`}
                    style={{
                      left: `${segment.left}px`,
                      width: `${segment.width}px`,
                    }}
                    onClick={() => onActiveYearChange(segment.group.year)}
                  >
                    <div className="timeline-segment__content">
                      {insideYearProgress > 0.04 ? (
                        <span
                          className="timeline-segment__year"
                          style={{
                            opacity: insideYearProgress,
                          }}
                        >
                          {formatTimelineYear(segment.group.year)}
                        </span>
                      ) : null}
                      <div className="timeline-segment__events">
                        {segment.group.entries.map((entry, entryIndex) => (
                          <span
                            key={`${segment.group.year}-${entry.title}-${entryIndex}`}
                            className="timeline-segment__event-name timeline-segment__event-name--stacked"
                          >
                            {entry.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {activeGroup ? (
        <motion.section
          key={activeGroup.year}
          className="timeline-detail-panel"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="timeline-detail-panel__header">
            <span className="eyebrow">Selected year</span>
            <h3>{formatTimelineYear(activeGroup.year)}</h3>
          </div>

          <div className="timeline-detail-list">
            {activeGroup.entries.map((entry, index) => (
              <article key={`${activeGroup.year}-${entry.title}-${index}`} className="timeline-detail-card">
                <strong>{entry.title}</strong>
                {hasTimelinePartialDate(entry) ? (
                  <span>{formatTimelineEntryDate(entry, { includeYear: false })}</span>
                ) : null}
                {entry.description ? <p>{entry.description}</p> : null}
              </article>
            ))}
          </div>
        </motion.section>
      ) : null}
    </section>
  );
}

function TimelineEditor({
  entries,
  activeYear,
  onActiveYearChange,
  onUpdateTimeline,
}) {
  const visibleEntries = sortTimelineEntriesForYear(
    entries
      .map((entry, index) => ({
        entry,
        index,
        year: getTimelineEntryYear(entry, index),
        month: getTimelineEntryMonth(entry),
        day: getTimelineEntryDay(entry),
        submissionIndex: index,
      }))
      .filter((entryMeta) => entryMeta.year === activeYear),
  );

  function updateEntryYear(index, nextYearNumber, nextEra) {
    onUpdateTimeline(
      entries.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              year: buildHistoricalYear(nextYearNumber, nextEra),
            }
          : entry,
      ),
    );
  }

  function updateEntryMonthDay(index, nextMonth, nextDay) {
    onUpdateTimeline(
      entries.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              month: nextMonth,
              day: nextDay,
            }
          : entry,
      ),
    );
  }

  function updateEntry(index, field, value) {
    onUpdateTimeline(
      entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  function removeEntry(index) {
    if (entries.length === 1) {
      return;
    }

    const entryToRemove = entries[index];
    const shouldDelete =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Delete "${entryToRemove?.title || 'this event'}" from ${formatTimelineEntryDate(entryToRemove)}? This cannot be undone.`);

    if (!shouldDelete) {
      return;
    }

    onUpdateTimeline(entries.filter((_, entryIndex) => entryIndex !== index));
  }

  function moveEntry(visibleIndex, direction) {
    const currentEntry = visibleEntries[visibleIndex];
    const swapEntry = visibleEntries[visibleIndex + direction];

    if (!currentEntry || !swapEntry) {
      return;
    }

    const reorderedEntries = [...entries];
    [reorderedEntries[currentEntry.index], reorderedEntries[swapEntry.index]] = [
      reorderedEntries[swapEntry.index],
      reorderedEntries[currentEntry.index],
    ];
    onUpdateTimeline(reorderedEntries);
  }

  return (
    <section className="editor-shell">
      <div className="editor-shell__header">
        <div>
          <span className="eyebrow">Admin editor</span>
          <h2>Timeline Controls</h2>
          <p className="editor-shell__description">
            {activeYear
              ? `Only the entries for ${formatTimelineYear(activeYear)} are shown here. Use the Add Event button in the chronology header to create a new one for this date.`
              : 'Select a year on the timeline above to edit its entries here.'}
          </p>
        </div>
      </div>

      <div className="editor-list">
        {visibleEntries.map(({ entry, index }, visibleIndex) => (
          <article key={`${activeYear}-${entry.title}-${index}`} className="editor-card">
            <div className="editor-card__header">
              <div>
                <span className="editor-card__eyebrow">
                  {visibleEntries.length > 1
                    ? `Entry ${visibleIndex + 1} in ${formatTimelineYear(activeYear)}`
                    : formatTimelineYear(activeYear)}
                </span>
                <h3>{entry.title || 'Untitled Entry'}</h3>
              </div>

              <div className="editor-inline-actions">
                <button
                  type="button"
                  className="button button--outline button--small"
                  onClick={() => moveEntry(visibleIndex, -1)}
                  disabled={visibleIndex === 0}
                >
                  Move Up
                </button>
                <button
                  type="button"
                  className="button button--outline button--small"
                  onClick={() => moveEntry(visibleIndex, 1)}
                  disabled={visibleIndex === visibleEntries.length - 1}
                >
                  Move Down
                </button>
                <button
                  type="button"
                  className="button button--danger button--small"
                  onClick={() => removeEntry(index)}
                  disabled={entries.length === 1}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="form-grid">
              <Field label="Year">
                <input
                  type="number"
                  min="1"
                  value={getTimelineYearNumber(getTimelineEntryYear(entry, index))}
                  onChange={(event) => {
                    const nextYearNumber = sanitizeTimelineYear(
                      event.target.value,
                      index,
                      entry,
                    );
                    const nextEra = getTimelineYearEra(getTimelineEntryYear(entry, index));
                    const nextYear = buildHistoricalYear(nextYearNumber, nextEra);
                    updateEntryYear(index, nextYearNumber, nextEra);

                    if (visibleEntries.length === 1 && nextYear !== activeYear) {
                      onActiveYearChange(nextYear);
                    }
                  }}
                />
              </Field>

              <Field label="Era">
                <select
                  value={getTimelineYearEra(getTimelineEntryYear(entry, index))}
                  onChange={(event) => {
                    const nextYearNumber = getTimelineYearNumber(
                      getTimelineEntryYear(entry, index),
                    );
                    const nextYear = buildHistoricalYear(nextYearNumber, event.target.value);
                    updateEntryYear(index, nextYearNumber, event.target.value);

                    if (visibleEntries.length === 1 && nextYear !== activeYear) {
                      onActiveYearChange(nextYear);
                    }
                  }}
                >
                  <option value="CE">CE</option>
                  <option value="BCE">BCE</option>
                </select>
              </Field>

              <Field label="Month">
                <select
                  value={getTimelineEntryMonth(entry) ?? ''}
                  onChange={(event) => {
                    const nextMonth = sanitizeTimelineMonth(event.target.value);
                    const currentDay = getTimelineEntryDay(entry);
                    updateEntryMonthDay(
                      index,
                      nextMonth,
                      nextMonth ? sanitizeTimelineDay(currentDay, nextMonth) : null,
                    );
                  }}
                >
                  <option value="">None</option>
                  {TIMELINE_MONTHS.map((monthName, monthIndex) => (
                    <option key={monthName} value={monthIndex + 1}>
                      {monthName}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Day">
                <select
                  value={getTimelineEntryDay(entry) ?? ''}
                  onChange={(event) => {
                    updateEntryMonthDay(
                      index,
                      getTimelineEntryMonth(entry),
                      sanitizeTimelineDay(event.target.value, getTimelineEntryMonth(entry)),
                    );
                  }}
                  disabled={!getTimelineEntryMonth(entry)}
                >
                  <option value="">None</option>
                  {Array.from(
                    { length: getTimelineDaysInMonth(getTimelineEntryMonth(entry) ?? 1) },
                    (_, dayIndex) => dayIndex + 1,
                  ).map((dayValue) => (
                    <option key={dayValue} value={dayValue}>
                      {dayValue}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Title" full>
                <input
                  type="text"
                  value={entry.title}
                  onChange={(event) => updateEntry(index, 'title', event.target.value)}
                />
              </Field>

              <Field label="Description" full>
                <textarea
                  rows="4"
                  value={entry.description}
                  onChange={(event) => updateEntry(index, 'description', event.target.value)}
                />
              </Field>
            </div>
          </article>
        ))}

        {activeYear && visibleEntries.length === 0 ? (
          <article className="editor-card">
            <div className="editor-card__header">
              <div>
                <span className="editor-card__eyebrow">No entries</span>
                <h3>{formatTimelineYear(activeYear)}</h3>
              </div>
            </div>

            <p className="editor-shell__description">
              This date does not have any editable entries yet. Use the Add Event button in the
              chronology header to create one here.
            </p>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function FamilyTreesPage({ familyTreeMap, isAdmin, onResetFamilyTree, onUpdateFamilyTree }) {
  const families = Object.values(familyTreeMap);
  const fallbackFamily =
    families.find((family) => canAccessFamilyTree(family.id, isAdmin)) ?? families[0] ?? null;
  const [activeFamilyId, setActiveFamilyId] = useState(fallbackFamily?.id ?? '');
  const requestedFamily = familyTreeMap[activeFamilyId] ?? fallbackFamily;
  const activeFamily =
    requestedFamily && canAccessFamilyTree(requestedFamily.id, isAdmin)
      ? requestedFamily
      : fallbackFamily;
  const [activePersonId, setActivePersonId] = useState(activeFamily?.people?.[0]?.id ?? '');
  const [isPersonDetailOpen, setIsPersonDetailOpen] = useState(false);
  const [personModalState, setPersonModalState] = useState(null);
  const [treeZoom, setTreeZoom] = useState(1);
  const [treePan, setTreePan] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isTreeDragging, setIsTreeDragging] = useState(false);
  const treeViewportRef = useRef(null);
  const treeZoomRef = useRef(treeZoom);
  const treePanRef = useRef(treePan);
  const viewportSizeRef = useRef(viewportSize);
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const gestureStateRef = useRef({
    zoom: treeZoom,
    pan: treePan,
    clientX: null,
    clientY: null,
  });

  useEffect(() => {
    if (!activeFamily) {
      return;
    }

    if (activeFamily.id !== activeFamilyId) {
      setActiveFamilyId(activeFamily.id);
      return;
    }

    if (!activeFamily.people.some((person) => person.id === activePersonId)) {
      setActivePersonId(activeFamily.people[0]?.id ?? '');
    }
  }, [activeFamily, activeFamilyId, activePersonId]);

  const activePerson =
    activeFamily?.people.find((person) => person.id === activePersonId) ??
    activeFamily?.people[0] ??
    null;
  const activePersonChildren = activePerson
    ? getChildrenForPerson(activeFamily.people, activePerson.id, activeFamily)
    : [];
  const activePersonPartners = activePerson
    ? getPartnersForPerson(activeFamily.people, activePerson.id, activeFamily)
    : [];
  const activePersonSiblings = activePerson
    ? getSiblingsForPerson(activeFamily.people, activePerson.id, activeFamily)
    : [];
  const relationCopy = getFamilyRelationshipCopy(activeFamily);
  const treeStats = getFamilyTreeStats(activeFamily);
  const editingPerson =
    personModalState?.mode === 'edit'
      ? activeFamily?.people.find((person) => person.id === personModalState.personId) ?? null
      : null;

  useEffect(() => {
    treeZoomRef.current = treeZoom;
  }, [treeZoom]);

  useEffect(() => {
    treePanRef.current = treePan;
  }, [treePan]);

  useEffect(() => {
    viewportSizeRef.current = viewportSize;
  }, [viewportSize]);

  useLayoutEffect(() => {
    const viewportElement = treeViewportRef.current;

    if (!viewportElement) {
      return undefined;
    }

    function updateViewportWidth() {
      setViewportSize({
        width: viewportElement.clientWidth,
        height: viewportElement.clientHeight,
      });
    }

    updateViewportWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewportWidth);

      return () => {
        window.removeEventListener('resize', updateViewportWidth);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateViewportWidth();
    });

    resizeObserver.observe(viewportElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    setTreePan({ x: 0, y: 0 });
  }, [activeFamilyId]);

  function getTreeZoomAnchor(anchorClientPoint) {
    const viewportElement = treeViewportRef.current;
    const viewportRect = viewportElement?.getBoundingClientRect();

    if (
      anchorClientPoint &&
      viewportRect &&
      typeof anchorClientPoint.x === 'number' &&
      typeof anchorClientPoint.y === 'number'
    ) {
      return {
        x: anchorClientPoint.x - viewportRect.left,
        y: anchorClientPoint.y - viewportRect.top,
      };
    }

    return {
      x: viewportSizeRef.current.width / 2,
      y: viewportSizeRef.current.height / 2,
    };
  }

  function applyTreeZoom(nextZoomValue, anchorClientPoint, sourceState = null) {
    const currentZoom = sourceState?.zoom ?? treeZoomRef.current;
    const currentPan = sourceState?.pan ?? treePanRef.current;
    const normalizedZoom = clampTreeZoom(nextZoomValue);

    if (normalizedZoom === currentZoom) {
      return;
    }

    const anchor = getTreeZoomAnchor(anchorClientPoint);
    const ratio = normalizedZoom / currentZoom;
    const nextPan = {
      x: Number((ratio * currentPan.x + (1 - ratio) * (anchor.x - viewportSizeRef.current.width / 2)).toFixed(2)),
      y: Number((ratio * currentPan.y + (1 - ratio) * (anchor.y - viewportSizeRef.current.height / 2)).toFixed(2)),
    };

    setTreeZoom(normalizedZoom);
    setTreePan(nextPan);
  }

  function handleTreeZoomStep(direction) {
    applyTreeZoom(treeZoomRef.current + direction * 0.1);
  }

  function applyTreePan(deltaX, deltaY) {
    setTreePan((currentPan) => {
      const nextPan = {
        x: Number((currentPan.x - deltaX).toFixed(2)),
        y: Number((currentPan.y - deltaY).toFixed(2)),
      };

      treePanRef.current = nextPan;
      return nextPan;
    });
  }

  useEffect(() => {
    const viewportElement = treeViewportRef.current;

    if (!viewportElement) {
      return undefined;
    }

    function handleWheel(event) {
      if (event.target.closest('button, input, select, textarea, label')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!event.ctrlKey) {
        applyTreePan(event.deltaX, event.deltaY);
        return;
      }

      applyTreeZoom(
        treeZoomRef.current * Math.exp(-event.deltaY * 0.0032),
        {
          x: event.clientX,
          y: event.clientY,
        },
      );
    }

    function handleGestureStart(event) {
      event.preventDefault();
      gestureStateRef.current = {
        zoom: treeZoomRef.current,
        pan: treePanRef.current,
        clientX: typeof event.clientX === 'number' ? event.clientX : null,
        clientY: typeof event.clientY === 'number' ? event.clientY : null,
      };
    }

    function handleGestureChange(event) {
      event.preventDefault();

      applyTreeZoom(
        gestureStateRef.current.zoom * (typeof event.scale === 'number' ? event.scale : 1),
        {
          x: gestureStateRef.current.clientX ?? undefined,
          y: gestureStateRef.current.clientY ?? undefined,
        },
        {
          zoom: gestureStateRef.current.zoom,
          pan: gestureStateRef.current.pan,
        },
      );
    }

    function handleGestureEnd(event) {
      event.preventDefault();
    }

    viewportElement.addEventListener('wheel', handleWheel, { passive: false });
    viewportElement.addEventListener('gesturestart', handleGestureStart);
    viewportElement.addEventListener('gesturechange', handleGestureChange);
    viewportElement.addEventListener('gestureend', handleGestureEnd);

    return () => {
      viewportElement.removeEventListener('wheel', handleWheel);
      viewportElement.removeEventListener('gesturestart', handleGestureStart);
      viewportElement.removeEventListener('gesturechange', handleGestureChange);
      viewportElement.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []);

  function openAddEntry() {
    if (!isAdmin) {
      return;
    }

    setPersonModalState({
      mode: 'create',
      relationType: null,
      anchorPersonId: null,
    });
  }

  function openAddParent() {
    if (!isAdmin || !activePerson) {
      return;
    }

    setPersonModalState({
      mode: 'create',
      relationType: 'parent',
      anchorPersonId: activePerson.id,
    });
  }

  function openAddChild() {
    if (!isAdmin || !activePerson) {
      return;
    }

    setPersonModalState({
      mode: 'create',
      relationType: 'child',
      anchorPersonId: activePerson.id,
    });
  }

  function openEditEntry() {
    if (!isAdmin || !activePerson) {
      return;
    }

    setPersonModalState({
      mode: 'edit',
      personId: activePerson.id,
    });
  }

  function handleSavePerson(savePayload) {
    if (!activeFamily) {
      return;
    }

    const nextPerson = savePayload.person;

    if (personModalState?.mode === 'edit' && editingPerson) {
      onUpdateFamilyTree(activeFamily.id, (currentFamily) => {
        const normalizedFamily = normalizeFamilyTree(currentFamily);
        const newPartnerIds = createFamilyPersonIds(normalizedFamily, savePayload.newPartners.length);
        const updatedPerson = normalizeFamilyPerson(
          {
            ...editingPerson,
            ...nextPerson,
            id: editingPerson.id,
            partnerIds: [...savePayload.existingPartnerIds, ...newPartnerIds],
          },
          0,
          editingPerson,
        );
        const createdPartners = savePayload.newPartners.map((partnerDraft, partnerIndex) =>
          normalizeFamilyPerson(
            {
              ...partnerDraft,
              id: newPartnerIds[partnerIndex],
              partnerIds: [editingPerson.id],
            },
            normalizedFamily.people.length + partnerIndex,
          ),
        );
        let nextPeople = normalizedFamily.people.map((person) =>
          person.id === editingPerson.id ? updatedPerson : person,
        );

        nextPeople = [...nextPeople, ...createdPartners];
        nextPeople = setFamilyPersonPartners(nextPeople, editingPerson.id, updatedPerson.partnerIds);

        return {
          ...normalizedFamily,
          people: normalizeFamilyPeopleForMode(nextPeople, normalizedFamily.relationshipMode),
        };
      });
      setActivePersonId(editingPerson.id);
      setPersonModalState(null);
      setIsPersonDetailOpen(false);
      return;
    }

    const nextPersonId = createFamilyPersonId(activeFamily);

    onUpdateFamilyTree(activeFamily.id, (currentFamily) => {
      const normalizedFamily = normalizeFamilyTree(currentFamily);
      const [createdPersonId, ...newPartnerIds] = createFamilyPersonIds(
        normalizedFamily,
        1 + savePayload.newPartners.length,
      );
      const createdPerson = normalizeFamilyPerson(
        {
          ...nextPerson,
          id: createdPersonId,
          partnerIds: [...savePayload.existingPartnerIds, ...newPartnerIds],
        },
        normalizedFamily.people.length,
      );
      const createdPartners = savePayload.newPartners.map((partnerDraft, partnerIndex) =>
        normalizeFamilyPerson(
          {
            ...partnerDraft,
            id: newPartnerIds[partnerIndex],
            partnerIds: [createdPersonId],
          },
          normalizedFamily.people.length + partnerIndex + 1,
        ),
      );
      let nextPeople = [...normalizedFamily.people, createdPerson, ...createdPartners];

      if (personModalState?.relationType === 'child' && personModalState.anchorPersonId) {
        nextPeople = attachParentToFamilyPerson(
          nextPeople,
          createdPersonId,
          personModalState.anchorPersonId,
          normalizedFamily,
        );
      }

      if (personModalState?.relationType === 'parent' && personModalState.anchorPersonId) {
        nextPeople = attachParentToFamilyPerson(
          nextPeople,
          personModalState.anchorPersonId,
          createdPersonId,
          normalizedFamily,
        );
      }

      nextPeople = setFamilyPersonPartners(nextPeople, createdPersonId, createdPerson.partnerIds);

      return {
        ...normalizedFamily,
        people: normalizeFamilyPeopleForMode(nextPeople, normalizedFamily.relationshipMode),
      };
    });

    setActivePersonId(nextPersonId);
    setPersonModalState(null);
    setIsPersonDetailOpen(false);
  }

  function handleDeletePerson(personId) {
    if (!activeFamily) {
      return;
    }

    const remainingPeople = activeFamily.people.filter((person) => person.id !== personId);
    const nextActivePersonId = remainingPeople[0]?.id ?? '';

    onUpdateFamilyTree(activeFamily.id, (currentFamily) => removeFamilyPerson(currentFamily, personId));
    setPersonModalState(null);
    setIsPersonDetailOpen(false);
    setActivePersonId(nextActivePersonId);
  }

  function handleTreeViewportPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest('button, input, select, textarea, label, .tree-stage-toolbar')) {
      return;
    }

    const viewportElement = treeViewportRef.current;

    if (!viewportElement) {
      return;
    }

    viewportElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();

    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: treePan.x,
      startPanY: treePan.y,
    };
    setIsTreeDragging(true);
  }

  function handleTreeViewportPointerMove(event) {
    if (!dragStateRef.current.isDragging) {
      return;
    }

    const viewportElement = treeViewportRef.current;

    if (!viewportElement) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;

    setTreePan({
      x: dragStateRef.current.startPanX + deltaX,
      y: dragStateRef.current.startPanY + deltaY,
    });
  }

  function handleTreeViewportPointerEnd(event) {
    if (!dragStateRef.current.isDragging) {
      return;
    }

    treeViewportRef.current?.releasePointerCapture?.(event.pointerId);
    dragStateRef.current.isDragging = false;
    setIsTreeDragging(false);
  }

  if (!activeFamily) {
    return null;
  }

  return (
    <>
      <PageShell>
        <section className="family-selector">
          {families.map((family) => {
            const isRestricted = !canAccessFamilyTree(family.id, isAdmin);
            const isActive = family.id === activeFamily.id;

            return (
              <button
                key={family.id}
                type="button"
                className={`family-selector__button${
                  isActive ? ' family-selector__button--active' : ''
                }${isRestricted ? ' family-selector__button--locked' : ''}`}
                style={{
                  '--family-accent': family.accent,
                  '--family-accent-soft': family.softAccent,
                }}
                onClick={() => {
                  if (isRestricted) {
                    return;
                  }

                  setActiveFamilyId(family.id);
                }}
                aria-pressed={isActive}
                aria-disabled={isRestricted}
                disabled={isRestricted}
                title={
                  isRestricted
                    ? `${family.name} is under construction for regular users.`
                    : undefined
                }
              >
                <span className="family-selector__name">{family.name}</span>
                {isRestricted ? (
                  <span className="family-selector__label">Under Construction</span>
                ) : null}
              </button>
            );
          })}
        </section>

        <section className="family-tree-stats">
          <div className="stat-grid">
            {treeStats.map((stat) => (
              <article key={stat.label} className="stat-card">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="tree-panel tree-panel--explorer">
          <div className="tree-panel__header">
            <div>
              <span className="eyebrow">Relationship map</span>
              <h2>{activeFamily.name} Genealogy</h2>
            </div>

            <div className="tree-panel__actions">
              <span className="tree-panel__tag">
                {isAdmin ? 'Admins can edit this tree' : 'Read-only viewer'}
              </span>
              {isAdmin ? (
                <button type="button" className="button button--primary" onClick={openAddEntry}>
                  Add Entry
                </button>
              ) : null}
            </div>
          </div>

          <div
            ref={treeViewportRef}
            className={`tree-stage-viewport${isTreeDragging ? ' tree-stage-viewport--dragging' : ''}`}
            onPointerDown={handleTreeViewportPointerDown}
            onPointerMove={handleTreeViewportPointerMove}
            onPointerUp={handleTreeViewportPointerEnd}
            onPointerCancel={handleTreeViewportPointerEnd}
            onPointerLeave={handleTreeViewportPointerEnd}
          >
            <div className="tree-stage-toolbar">
              <div
                className="tree-zoom-controls tree-zoom-controls--floating"
                aria-label="Tree zoom controls"
              >
                <button
                  type="button"
                  className="tree-zoom-controls__button"
                  onClick={() => handleTreeZoomStep(-1)}
                  disabled={treeZoom <= MIN_TREE_ZOOM}
                >
                  -
                </button>
                <span className="tree-zoom-controls__label">{Math.round(treeZoom * 100)}%</span>
                <button
                  type="button"
                  className="tree-zoom-controls__button"
                  onClick={() => handleTreeZoomStep(1)}
                  disabled={treeZoom >= MAX_TREE_ZOOM}
                >
                  +
                </button>
              </div>
            </div>
            <FamilyTreeCanvas
              family={activeFamily}
              activePersonId={activePerson?.id ?? ''}
              pan={treePan}
              zoom={treeZoom}
              viewportWidth={viewportSize.width}
              viewportHeight={viewportSize.height}
              onSelectPerson={(personId) => {
                setActivePersonId(personId);
                setIsPersonDetailOpen(true);
              }}
            />
          </div>
        </section>
      </PageShell>

      <AnimatePresence>
        {isPersonDetailOpen && activePerson ? (
          <FamilyPersonDetailModal
            key={`person-${activePerson.id}`}
            person={activePerson}
            family={activeFamily}
            people={activeFamily.people}
            children={activePersonChildren}
            partners={activePersonPartners}
            siblings={activePersonSiblings}
            isAdmin={isAdmin}
            onClose={() => setIsPersonDetailOpen(false)}
            onSelectPerson={(personId) => {
              setActivePersonId(personId);
              setIsPersonDetailOpen(true);
            }}
            onEditEntry={openEditEntry}
            onAddParent={openAddParent}
            onAddChild={openAddChild}
          />
        ) : null}
        {isAdmin && personModalState ? (
          <AddFamilyMemberModal
            key={
              personModalState.mode === 'edit'
                ? `edit-${personModalState.personId}`
                : `create-${personModalState.relationType ?? 'root'}-${
                    personModalState.anchorPersonId ?? 'none'
                  }`
            }
            mode={personModalState.mode}
            relationType={personModalState.relationType ?? null}
            anchorPersonId={personModalState.anchorPersonId ?? null}
            family={activeFamily}
            people={activeFamily.people}
            initialPerson={editingPerson}
            onClose={() => setPersonModalState(null)}
            onSave={handleSavePerson}
            onDelete={handleDeletePerson}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function FamilyPersonDetailModal({
  person,
  family,
  people,
  children,
  partners,
  siblings,
  isAdmin,
  onClose,
  onSelectPerson,
  onEditEntry,
  onAddParent,
  onAddChild,
}) {
  useModalLifecycle(onClose);
  const relationCopy = getFamilyRelationshipCopy(family);
  const makerId = getFamilyPrimaryParentId(person, family);
  const canAddParent = isFamilySingleParentMode(family)
    ? !makerId
    : !(person.motherId && person.fatherId);

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card modal-card--wide family-member-modal"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={pageTransition}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="family-member-modal__close"
          onClick={onClose}
          aria-label="Close selected person"
        >
          X
        </button>

        <div className="modal-card__header">
          <div>
            <span className="eyebrow">Selected person</span>
            <h2>{formatFamilyPersonName(person)}</h2>
            <p className="family-member-card__lede">
              {person.description?.trim()
                ? person.description
                : 'This person is part of the current family tree but does not have extra notes yet.'}
            </p>
          </div>
        </div>

        {isAdmin ? (
          <div className="family-member-card__actions">
            <button
              type="button"
              className="button button--outline button--small"
              onClick={onEditEntry}
            >
              Edit Entry
            </button>
            <button
              type="button"
              className="button button--outline button--small"
              onClick={onAddParent}
              disabled={!canAddParent}
            >
              {relationCopy.parentActionLabel}
            </button>
            <button
              type="button"
              className="button button--primary button--small"
              onClick={onAddChild}
            >
              {relationCopy.childActionLabel}
            </button>
          </div>
        ) : null}

        <div className="family-member-card__facts">
          <article>
            <strong>Gender</strong>
            <span>{formatGenderLabel(person.gender)}</span>
          </article>
          <article>
            <strong>Birth</strong>
            <span>{formatFamilyDateSummary(person, 'birth') || 'Unknown'}</span>
          </article>
          <article>
            <strong>{person.isDeceased ? 'Approximate age at death' : 'Approximate age'}</strong>
            <span>{formatFamilyPersonAge(person)}</span>
          </article>
          {isFamilySingleParentMode(family) ? (
            <article>
              <strong>Year changed</strong>
              <span>{person.changedYear ? formatTimelineYear(person.changedYear) : 'Unknown'}</span>
            </article>
          ) : null}
          <article>
            <strong>Place of birth</strong>
            <span>{person.birthPlace?.trim() || 'Unknown'}</span>
          </article>
          <article>
            <strong>Status</strong>
            <span>{person.isDeceased ? 'Deceased' : 'Living / unknown'}</span>
          </article>
          {person.isDeceased ? (
            <article>
              <strong>Date of death</strong>
              <span>{formatFamilyDateSummary(person, 'death') || 'Unknown'}</span>
            </article>
          ) : null}
        </div>

        {isFamilySingleParentMode(family) ? (
          <div className="family-member-card__group">
            <strong>{relationCopy.parentSingularLabel}</strong>
            {renderRelatedPersonButton(
              people,
              makerId,
              onSelectPerson,
              relationCopy.parentEmptyLabel,
            )}
          </div>
        ) : (
          <>
            <div className="family-member-card__group">
              <strong>Mother</strong>
              {renderRelatedPersonButton(people, person.motherId, onSelectPerson)}
            </div>

            <div className="family-member-card__group">
              <strong>Father</strong>
              {renderRelatedPersonButton(people, person.fatherId, onSelectPerson)}
            </div>
          </>
        )}

        {!isFamilySingleParentMode(family) ? (
          <div className="family-member-card__group">
            <strong>{relationCopy.partnerPluralLabel}</strong>
            {partners.length ? (
              <div className="family-member-card__list">
                {partners.map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    className="family-member-card__link"
                    onClick={() => onSelectPerson(partner.id)}
                  >
                    <span>{formatFamilyPersonName(partner)}</span>
                    <small>{formatFamilyDateSummary(partner, 'birth') || 'No birth date'}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="family-member-card__empty">{relationCopy.partnerEmptyLabel}</p>
            )}
          </div>
        ) : null}

        <div className="family-member-card__group">
          <strong>{relationCopy.childPluralLabel}</strong>
          {children.length ? (
            <div className="family-member-card__list">
              {children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  className="family-member-card__link"
                  onClick={() => onSelectPerson(child.id)}
                >
                  <span>{formatFamilyPersonName(child)}</span>
                  <small>{formatFamilyDateSummary(child, 'birth') || 'No birth date'}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="family-member-card__empty">{relationCopy.childEmptyLabel}</p>
          )}
        </div>

        <div className="family-member-card__group">
          <strong>{relationCopy.siblingPluralLabel}</strong>
          {siblings.length ? (
            <div className="family-member-card__list">
              {siblings.map((sibling) => (
                <button
                  key={sibling.id}
                  type="button"
                  className="family-member-card__link"
                  onClick={() => onSelectPerson(sibling.id)}
                >
                  <span>{formatFamilyPersonName(sibling)}</span>
                  <small>{formatFamilyDateSummary(sibling, 'birth') || 'No birth date'}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="family-member-card__empty">{relationCopy.siblingEmptyLabel}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function renderRelatedPersonButton(
  people,
  personId,
  onSelectPerson,
  emptyLabel = 'Not linked yet.',
) {
  if (!personId) {
    return <p className="family-member-card__empty">{emptyLabel}</p>;
  }

  const relatedPerson = people.find((person) => person.id === personId);

  if (!relatedPerson) {
    return <p className="family-member-card__empty">{emptyLabel}</p>;
  }

  return (
    <button
      type="button"
      className="family-member-card__link"
      onClick={() => onSelectPerson(relatedPerson.id)}
    >
      <span>{formatFamilyPersonName(relatedPerson)}</span>
      <small>{formatFamilyDateSummary(relatedPerson, 'birth') || 'No birth date'}</small>
    </button>
  );
}

function AddFamilyMemberModal({
  mode,
  relationType,
  anchorPersonId,
  family,
  people,
  initialPerson,
  onClose,
  onSave,
  onDelete,
}) {
  const [formState, setFormState] = useState(() =>
    createFamilyPersonDraft(initialPerson, relationType, anchorPersonId, people, family),
  );
  const [error, setError] = useState('');
  const [pendingPartnerId, setPendingPartnerId] = useState(null);
  const [partnerLookupKey, setPartnerLookupKey] = useState(0);
  const [newPartnerDrafts, setNewPartnerDrafts] = useState([]);
  const anchorPerson = anchorPersonId
    ? people.find((person) => person.id === anchorPersonId) ?? null
    : null;
  const isEditing = mode === 'edit';
  const relationCopy = getFamilyRelationshipCopy(family);
  const modalTitle = isEditing
    ? 'Edit Tree Entry'
    : relationType === 'child'
      ? relationCopy.childActionLabel
      : relationType === 'parent'
        ? relationCopy.parentActionLabel
        : 'Add Entry';

  useModalLifecycle(onClose);

  function updateField(field, value) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
    setError('');
  }

  function handleSubmit(event) {
    event.preventDefault();

    const normalizedFirstName = formState.firstName.trim();
    const normalizedLastName = formState.lastName.trim();
    const normalizedBirthPlace = formState.birthPlace.trim();
    const normalizedDescription = formState.description.trim();
    const nextMakerId = isFamilySingleParentMode(family)
      ? sanitizeFamilyRelationId(
          getFamilyPrimaryParentId(formState, family),
          people,
          initialPerson?.id,
        )
      : null;
    const nextMotherId = sanitizeFamilyRelationId(formState.motherId, people, initialPerson?.id);
    const nextFatherId = sanitizeFamilyRelationId(formState.fatherId, people, initialPerson?.id);

    if (!normalizedFirstName) {
      setError('First name is required before saving this entry.');
      return;
    }

    if (
      !isFamilySingleParentMode(family) &&
      nextMotherId &&
      nextFatherId &&
      nextMotherId === nextFatherId
    ) {
      setError('Mother and father must point to different people.');
      return;
    }

    const normalizedNewPartners = newPartnerDrafts.map((partnerDraft) => ({
      firstName: partnerDraft.firstName.trim(),
      lastName: partnerDraft.lastName.trim(),
      gender: sanitizeGender(partnerDraft.gender),
      birthMonth: null,
      birthDay: null,
      birthYear: null,
      changedYear: null,
      birthPlace: '',
      isDeceased: false,
      deathMonth: null,
      deathDay: null,
      deathYear: null,
      motherId: null,
      fatherId: null,
      partnerIds: [],
      description: '',
    }));

    if (normalizedNewPartners.some((partnerDraft) => !partnerDraft.firstName)) {
      setError('Each new partner needs at least a first name before saving.');
      return;
    }

    onSave({
      person: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        gender: sanitizeGender(formState.gender),
        birthMonth: sanitizeTimelineMonth(formState.birthMonth),
        birthDay: sanitizeTimelineDay(formState.birthDay, formState.birthMonth),
        birthYear: sanitizeFamilyYear(formState.birthYear, formState.birthEra),
        changedYear: isFamilySingleParentMode(family)
          ? sanitizeFamilyYear(formState.changedYear, formState.changedEra)
          : null,
        birthPlace: normalizedBirthPlace,
        isDeceased: Boolean(formState.isDeceased),
        deathMonth: formState.isDeceased ? sanitizeTimelineMonth(formState.deathMonth) : null,
        deathDay: formState.isDeceased
          ? sanitizeTimelineDay(formState.deathDay, formState.deathMonth)
          : null,
        deathYear: formState.isDeceased
          ? sanitizeFamilyYear(formState.deathYear, formState.deathEra)
          : null,
        motherId: isFamilySingleParentMode(family) ? nextMakerId : nextMotherId,
        fatherId: isFamilySingleParentMode(family) ? null : nextFatherId,
        partnerIds: formState.partnerIds,
        description: normalizedDescription,
      },
      existingPartnerIds: formState.partnerIds,
      newPartners: normalizedNewPartners,
    });
  }

  function handleDelete() {
    if (!isEditing || !initialPerson || !onDelete) {
      return;
    }

    const shouldDelete =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Delete "${formatFamilyPersonName(initialPerson)}" from this tree?`);

    if (!shouldDelete) {
      return;
    }

    onDelete(initialPerson.id);
  }

  function addExistingPartner() {
    if (!pendingPartnerId) {
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      partnerIds: [...new Set([...currentState.partnerIds, pendingPartnerId])],
    }));
    setPendingPartnerId(null);
    setPartnerLookupKey((currentKey) => currentKey + 1);
    setError('');
  }

  function removeExistingPartner(partnerId) {
    setFormState((currentState) => ({
      ...currentState,
      partnerIds: currentState.partnerIds.filter((currentPartnerId) => currentPartnerId !== partnerId),
    }));
    setError('');
  }

  function addNewPartnerDraft() {
    setNewPartnerDrafts((currentDrafts) => [
      ...currentDrafts,
      createEmptyFamilyPartnerDraft(),
    ]);
    setError('');
  }

  function updateNewPartnerDraft(draftIndex, field, value) {
    setNewPartnerDrafts((currentDrafts) =>
      currentDrafts.map((draft, index) =>
        index === draftIndex
          ? {
              ...draft,
              [field]: value,
            }
          : draft,
      ),
    );
    setError('');
  }

  function removeNewPartnerDraft(draftIndex) {
    setNewPartnerDrafts((currentDrafts) =>
      currentDrafts.filter((_, index) => index !== draftIndex),
    );
    setError('');
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card modal-card--wide"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={pageTransition}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <div>
            <span className="eyebrow">
              {isEditing
                ? 'Edit person'
                : relationType === 'child'
                  ? relationCopy.childActionLabel
                  : relationType === 'parent'
                    ? relationCopy.parentActionLabel
                    : relationCopy.newEntryEyebrow}
            </span>
            <h2>{modalTitle}</h2>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="auth-note">
          {anchorPerson && relationType === 'child'
            ? `This entry will open as a ${relationCopy.childFlowLabel} flow for ${formatFamilyPersonName(anchorPerson)}. The ${relationCopy.prefilledParentLabel} link is prefilled when possible${isFamilySingleParentMode(family) ? '.' : ', and you can still choose another parent from the search fields below.'}`
            : null}
          {anchorPerson && relationType === 'parent'
            ? `This entry will open as a ${relationCopy.parentFlowLabel} flow for ${formatFamilyPersonName(anchorPerson)}. The new person will be attached to the selected person after you save.`
            : null}
          {!anchorPerson && !isEditing
            ? 'Only first name is required. Every other field can be left blank and completed later.'
            : null}
          {isEditing
            ? 'Update any known details here. First name is still required so the tree always has a readable label.'
            : null}
        </p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <Field label="First name">
              <input
                type="text"
                value={formState.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
              />
            </Field>

            <Field label="Last name">
              <input
                type="text"
                value={formState.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
              />
            </Field>

            <Field label="Gender">
              <select
                value={formState.gender}
                onChange={(event) => updateField('gender', event.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Place of birth">
              <input
                type="text"
                value={formState.birthPlace}
                onChange={(event) => updateField('birthPlace', event.target.value)}
              />
            </Field>

            <Field label="Birth month">
              <select
                value={formState.birthMonth}
                onChange={(event) => {
                  const nextMonth = event.target.value;
                  updateField('birthMonth', nextMonth);
                  setFormState((currentState) => ({
                    ...currentState,
                    birthMonth: nextMonth,
                    birthDay: nextMonth
                      ? String(sanitizeTimelineDay(currentState.birthDay, nextMonth) ?? '')
                      : '',
                  }));
                }}
              >
                <option value="">Unknown</option>
                {TIMELINE_MONTHS.map((monthName, monthIndex) => (
                  <option key={monthName} value={monthIndex + 1}>
                    {monthName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Birth day">
              <select
                value={formState.birthDay}
                onChange={(event) => updateField('birthDay', event.target.value)}
                disabled={!formState.birthMonth}
              >
                <option value="">Unknown</option>
                {Array.from(
                  { length: getTimelineDaysInMonth(sanitizeTimelineMonth(formState.birthMonth) ?? 1) },
                  (_, dayIndex) => dayIndex + 1,
                ).map((dayValue) => (
                  <option key={dayValue} value={dayValue}>
                    {dayValue}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Birth year">
              <input
                type="number"
                min="1"
                value={formState.birthYear}
                onChange={(event) => updateField('birthYear', event.target.value)}
              />
            </Field>

            <Field label="Birth era">
              <select
                value={formState.birthEra}
                onChange={(event) => updateField('birthEra', event.target.value)}
              >
                <option value="CE">CE</option>
                <option value="BCE">BCE</option>
              </select>
            </Field>

            {isFamilySingleParentMode(family) ? (
              <>
                <Field label="Year Changed">
                  <input
                    type="number"
                    min="1"
                    value={formState.changedYear}
                    onChange={(event) => updateField('changedYear', event.target.value)}
                  />
                </Field>

                <Field label="Changed era">
                  <select
                    value={formState.changedEra}
                    onChange={(event) => updateField('changedEra', event.target.value)}
                  >
                    <option value="CE">CE</option>
                    <option value="BCE">BCE</option>
                  </select>
                </Field>
              </>
            ) : null}

            {!isFamilySingleParentMode(family) ? (
              <Field label={relationCopy.partnerPluralLabel} full>
                <div className="partner-manager">
                  {formState.partnerIds.length ? (
                    <div className="partner-manager__list">
                      {formState.partnerIds
                        .map((partnerId) => people.find((person) => person.id === partnerId))
                        .filter(Boolean)
                        .map((partner) => (
                          <div key={partner.id} className="partner-manager__pill">
                            <span>{formatFamilyPersonName(partner)}</span>
                            <button
                              type="button"
                              className="partner-manager__remove"
                              onClick={() => removeExistingPartner(partner.id)}
                              aria-label={`Remove ${formatFamilyPersonName(partner)} as a partner`}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="family-member-card__empty">{relationCopy.partnerEmptyLabel}</p>
                  )}

                  <div className="partner-manager__lookup">
                    <PersonLookupField
                      key={partnerLookupKey}
                      label={relationCopy.partnerSearchLabel}
                      people={people}
                      valueId={pendingPartnerId}
                      excludedIds={[
                        ...(initialPerson?.id ? [initialPerson.id] : []),
                        ...formState.partnerIds,
                      ]}
                      placeholder="Type a name to search the tree"
                      onChange={(nextPersonId) => {
                        setPendingPartnerId(nextPersonId);
                        setError('');
                      }}
                    />
                    <button
                      type="button"
                      className="button button--outline button--small"
                      onClick={addExistingPartner}
                      disabled={!pendingPartnerId}
                    >
                      {relationCopy.partnerLinkLabel}
                    </button>
                  </div>

                  {newPartnerDrafts.length ? (
                    <div className="partner-manager__drafts">
                      {newPartnerDrafts.map((partnerDraft, draftIndex) => (
                        <div key={`partner-draft-${draftIndex}`} className="partner-draft">
                          <div className="partner-draft__header">
                            <strong>New Partner {draftIndex + 1}</strong>
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              onClick={() => removeNewPartnerDraft(draftIndex)}
                            >
                              Remove
                            </button>
                          </div>
                          <div className="partner-draft__grid">
                            <input
                              type="text"
                              value={partnerDraft.firstName}
                              placeholder="First name"
                              onChange={(event) =>
                                updateNewPartnerDraft(draftIndex, 'firstName', event.target.value)
                              }
                            />
                            <input
                              type="text"
                              value={partnerDraft.lastName}
                              placeholder="Last name"
                              onChange={(event) =>
                                updateNewPartnerDraft(draftIndex, 'lastName', event.target.value)
                              }
                            />
                            <select
                              value={partnerDraft.gender}
                              onChange={(event) =>
                                updateNewPartnerDraft(draftIndex, 'gender', event.target.value)
                              }
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="button button--outline button--small"
                    onClick={addNewPartnerDraft}
                  >
                    {relationCopy.partnerCreateLabel}
                  </button>
                </div>
              </Field>
            ) : null}

            <Field label="Deceased" full>
              <div className="checkbox-field">
                <input
                  type="checkbox"
                  aria-label="Deceased"
                  checked={Boolean(formState.isDeceased)}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      isDeceased: event.target.checked,
                      deathMonth: event.target.checked ? currentState.deathMonth : '',
                      deathDay: event.target.checked ? currentState.deathDay : '',
                      deathYear: event.target.checked ? currentState.deathYear : '',
                    }))
                  }
                />
              </div>
            </Field>

            {formState.isDeceased ? (
              <>
                <Field label="Death month">
                  <select
                    value={formState.deathMonth}
                    onChange={(event) => {
                      const nextMonth = event.target.value;
                      updateField('deathMonth', nextMonth);
                      setFormState((currentState) => ({
                        ...currentState,
                        deathMonth: nextMonth,
                        deathDay: nextMonth
                          ? String(sanitizeTimelineDay(currentState.deathDay, nextMonth) ?? '')
                          : '',
                      }));
                    }}
                  >
                    <option value="">Unknown</option>
                    {TIMELINE_MONTHS.map((monthName, monthIndex) => (
                      <option key={monthName} value={monthIndex + 1}>
                        {monthName}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Death day">
                  <select
                    value={formState.deathDay}
                    onChange={(event) => updateField('deathDay', event.target.value)}
                    disabled={!formState.deathMonth}
                  >
                    <option value="">Unknown</option>
                    {Array.from(
                      {
                        length: getTimelineDaysInMonth(
                          sanitizeTimelineMonth(formState.deathMonth) ?? 1,
                        ),
                      },
                      (_, dayIndex) => dayIndex + 1,
                    ).map((dayValue) => (
                      <option key={dayValue} value={dayValue}>
                        {dayValue}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Death year">
                  <input
                    type="number"
                    min="1"
                    value={formState.deathYear}
                    onChange={(event) => updateField('deathYear', event.target.value)}
                  />
                </Field>

                <Field label="Death era">
                  <select
                    value={formState.deathEra}
                    onChange={(event) => updateField('deathEra', event.target.value)}
                  >
                    <option value="CE">CE</option>
                    <option value="BCE">BCE</option>
                  </select>
                </Field>
              </>
            ) : null}

            {isFamilySingleParentMode(family) ? (
              <Field label={relationCopy.parentSingularLabel} full>
                <PersonLookupField
                  label={relationCopy.parentSearchLabel}
                  people={people}
                  valueId={getFamilyPrimaryParentId(formState, family)}
                  excludedIds={initialPerson?.id ? [initialPerson.id] : []}
                  placeholder="Type a name to search the tree"
                  onChange={(nextPersonId) => {
                    setError('');
                    setFormState((currentState) => ({
                      ...currentState,
                      motherId: nextPersonId,
                      fatherId: null,
                    }));
                  }}
                />
              </Field>
            ) : (
              <>
                <Field label="Mother" full>
                  <PersonLookupField
                    label="Search for mother"
                    people={people}
                    valueId={formState.motherId}
                    excludedIds={initialPerson?.id ? [initialPerson.id] : []}
                    placeholder="Type a name to search the tree"
                    onChange={(nextPersonId) => updateField('motherId', nextPersonId)}
                  />
                </Field>

                <Field label="Father" full>
                  <PersonLookupField
                    label="Search for father"
                    people={people}
                    valueId={formState.fatherId}
                    excludedIds={initialPerson?.id ? [initialPerson.id] : []}
                    placeholder="Type a name to search the tree"
                    onChange={(nextPersonId) => updateField('fatherId', nextPersonId)}
                  />
                </Field>
              </>
            )}

            <Field label="Notes" full>
              <textarea
                rows="4"
                value={formState.description}
                placeholder="Optional notes for this person"
                onChange={(event) => updateField('description', event.target.value)}
              />
            </Field>
          </div>

          {error ? <p className="login-error">{error}</p> : null}

          <div className="modal-actions">
            {isEditing ? (
              <button type="button" className="button button--danger" onClick={handleDelete}>
                Delete Entry
              </button>
            ) : null}
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button--primary">
              {isEditing ? 'Save Changes' : 'Save Entry'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function PersonLookupField({
  label,
  people,
  valueId,
  excludedIds = [],
  placeholder,
  onChange,
}) {
  const eligiblePeople = people.filter((person) => !excludedIds.includes(person.id));
  const selectedPerson = eligiblePeople.find((person) => person.id === valueId) ?? null;
  const [query, setQuery] = useState(selectedPerson ? formatFamilyPersonName(selectedPerson) : '');
  const [isFocused, setIsFocused] = useState(false);
  const suggestions = findFamilyPersonSuggestions(query, eligiblePeople, selectedPerson?.id);

  useEffect(() => {
    setQuery(selectedPerson ? formatFamilyPersonName(selectedPerson) : '');
  }, [selectedPerson]);

  return (
    <div className="tree-person-lookup">
      <div className="tree-person-lookup__field">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);

            if (!nextQuery.trim()) {
              onChange(null);
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => {
              setIsFocused(false);
            }, 120);
          }}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
        />

        {selectedPerson ? (
          <button
            type="button"
            className="tree-person-lookup__clear"
            onMouseDown={(event) => {
              event.preventDefault();
              setQuery('');
              onChange(null);
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {isFocused && query.trim() && suggestions.length > 0 ? (
        <div className="tree-person-lookup__suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              className="tree-person-lookup__suggestion"
              onMouseDown={(event) => {
                event.preventDefault();
                setQuery(formatFamilyPersonName(suggestion.person));
                onChange(suggestion.person.id);
              }}
            >
              <span>{formatFamilyPersonName(suggestion.person)}</span>
              <small>{suggestion.meta}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, full = false, children }) {
  return (
    <label className={`input-field${full ? ' input-field--full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useModalLifecycle(onClose);

  function handleSubmit(event) {
    event.preventDefault();

    const result = onLogin({ username, password });

    if (!result.ok) {
      setError(result.message);
    }
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={pageTransition}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <div>
            <span className="eyebrow">Login</span>
            <h2>Admin Access</h2>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="auth-note">
          Visitors can browse the site without an account. There is no self-service registration
          or account creation flow.
        </p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <Field label="Username" full>
            <input
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setError('');
              }}
              autoComplete="username"
            />
          </Field>

          <Field label="Password" full>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              autoComplete="current-password"
            />
          </Field>

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" className="button button--primary">
            Login
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function AddEventModal({ initialYear, onClose, onCreate }) {
  const [yearNumber, setYearNumber] = useState(String(getTimelineYearNumber(initialYear)));
  const [era, setEra] = useState('CE');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useModalLifecycle(onClose);

  function handleSubmit(event) {
    event.preventDefault();

    const numericYear = Number.parseInt(yearNumber, 10);
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    if (Number.isNaN(numericYear) || numericYear < 1) {
      setError('Enter a valid year before saving the event.');
      return;
    }

    if (!normalizedTitle) {
      setError('Add an event title so it has a label on the timeline.');
      return;
    }

    onCreate({
      year: buildHistoricalYear(numericYear, era),
      month: sanitizeTimelineMonth(month),
      day: sanitizeTimelineDay(day, month),
      title: normalizedTitle,
      description: normalizedDescription,
    });
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={pageTransition}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card__header">
          <div>
            <span className="eyebrow">New event</span>
            <h2>Add Timeline Event</h2>
          </div>
        </div>

        <p className="auth-note">
          The selected date is prefilled from the chronology bar. Month and day are optional, and
          events without them stay in the order they were added within that year.
        </p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <Field label="Year">
              <input
                type="number"
                min="1"
                value={yearNumber}
                onChange={(event) => {
                  setYearNumber(event.target.value);
                  setError('');
                }}
              />
            </Field>

            <Field label="Era">
              <select
                value={era}
                onChange={(event) => {
                  setEra(event.target.value);
                  setError('');
                }}
              >
                <option value="CE">CE</option>
                <option value="BCE">BCE</option>
              </select>
            </Field>

            <Field label="Month">
              <select
                value={month}
                onChange={(event) => {
                  const nextMonth = event.target.value;
                  setMonth(nextMonth);
                  setDay((currentDay) =>
                    nextMonth ? String(sanitizeTimelineDay(currentDay, nextMonth) ?? '') : '',
                  );
                  setError('');
                }}
              >
                <option value="">None</option>
                {TIMELINE_MONTHS.map((monthName, monthIndex) => (
                  <option key={monthName} value={monthIndex + 1}>
                    {monthName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Day">
              <select
                value={day}
                onChange={(event) => {
                  setDay(event.target.value);
                  setError('');
                }}
                disabled={!month}
              >
                <option value="">None</option>
                {Array.from(
                  { length: getTimelineDaysInMonth(sanitizeTimelineMonth(month) ?? 1) },
                  (_, dayIndex) => dayIndex + 1,
                ).map((dayValue) => (
                  <option key={dayValue} value={dayValue}>
                    {dayValue}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Title" full>
              <input
                type="text"
                value={title}
                placeholder="Event title"
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError('');
                }}
              />
            </Field>

            <Field label="Description" full>
              <textarea
                rows="5"
                value={description}
                placeholder="Describe why this event matters in the timeline."
                onChange={(event) => {
                  setDescription(event.target.value);
                  setError('');
                }}
              />
            </Field>
          </div>

          {error ? <p className="login-error">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button button--primary">
              Save Event
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function FamilyTreeCanvas({
  family,
  activePersonId,
  pan,
  zoom,
  viewportWidth,
  viewportHeight,
  onSelectPerson,
}) {
  const layout = buildFamilyTreeLayout(family);
  const displayLayout = layout;
  const safeViewportWidth = viewportWidth || 0;
  const safeViewportHeight = viewportHeight || 0;
  const canvasPaddingX = Math.max(220, Math.round(safeViewportWidth * 0.24));
  const canvasPaddingY = 180;
  const renderedStageWidth = displayLayout.width * zoom;
  const renderedStageHeight = displayLayout.height * zoom;
  const workspaceWidth = Math.max(
    renderedStageWidth + canvasPaddingX * 2,
    safeViewportWidth + canvasPaddingX * 2,
    1200,
  );
  const workspaceHeight = Math.max(
    renderedStageHeight + canvasPaddingY * 2,
    safeViewportHeight + canvasPaddingY * 2,
    760,
  );
  const centeredX = (safeViewportWidth - workspaceWidth) / 2;
  const centeredY = (safeViewportHeight - workspaceHeight) / 2;
  const shellX = centeredX + pan.x;
  const shellY = centeredY + pan.y;
  const frameLeft = Math.max((workspaceWidth - renderedStageWidth) / 2, 0);
  const frameTop = Math.max((workspaceHeight - renderedStageHeight) / 2, 0);
  const stageRef = useRef(null);
  const nodeRefs = useRef(new Map());
  const [measuredStage, setMeasuredStage] = useState({
    width: renderedStageWidth,
    height: renderedStageHeight,
  });
  const [connectorPaths, setConnectorPaths] = useState([]);

  function handleNodeClick(personId) {
    onSelectPerson(personId);
  }

  useLayoutEffect(() => {
    const stageElement = stageRef.current;

    if (!stageElement) {
      return undefined;
    }

    let animationFrameId = 0;
    let timeoutId = 0;
    let resizeObserver = null;

    function measureConnectors() {
      const stageRect = stageElement.getBoundingClientRect();
      const connectorOffset = 1.5;

      if (!stageRect.width || !stageRect.height) {
        return;
      }

      const nextPaths = getFamilyRenderedChildConnectorLinks(family.people, family, (personId) => {
        const personNode = nodeRefs.current.get(personId);

        if (!personNode) {
          return null;
        }

        const personRect = personNode.getBoundingClientRect();

        return {
          id: personId,
          centerX: personRect.left - stageRect.left + personRect.width / 2,
          centerY: personRect.top - stageRect.top + personRect.height / 2,
          leftX: personRect.left - stageRect.left,
          rightX: personRect.right - stageRect.left,
          topY: personRect.top - stageRect.top - connectorOffset,
          bottomY: personRect.top - stageRect.top + personRect.height + connectorOffset,
        };
      });
      const partnerPaths = getFamilyPartnerPairs(family.people, family)
        .map((partnerPair) => {
          const leftNode = nodeRefs.current.get(partnerPair.leftId);
          const rightNode = nodeRefs.current.get(partnerPair.rightId);

          if (!leftNode || !rightNode) {
            return null;
          }

          const leftRect = leftNode.getBoundingClientRect();
          const rightRect = rightNode.getBoundingClientRect();
          const leftCenterX = leftRect.left - stageRect.left + leftRect.width / 2;
          const rightCenterX = rightRect.left - stageRect.left + rightRect.width / 2;
          const startRect = leftCenterX <= rightCenterX ? leftRect : rightRect;
          const endRect = leftCenterX <= rightCenterX ? rightRect : leftRect;
          const startX = startRect.right - stageRect.left;
          const startY = startRect.top - stageRect.top + startRect.height / 2;
          const endX = endRect.left - stageRect.left;
          const endY = endRect.top - stageRect.top + endRect.height / 2;

          return {
            parentId: partnerPair.leftId,
            childId: partnerPair.rightId,
            type: 'partner',
            path: createFamilyPartnerConnectorPath(startX, startY, endX, endY),
          };
        })
        .filter(Boolean);

      setMeasuredStage({
        width: stageRect.width,
        height: stageRect.height,
      });
      setConnectorPaths([...nextPaths, ...partnerPaths]);
    }

    function requestMeasure() {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(measureConnectors);
    }

    requestMeasure();
    timeoutId = window.setTimeout(requestMeasure, 220);
    window.addEventListener('resize', requestMeasure);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        requestMeasure();
      });

      resizeObserver.observe(stageElement);
      nodeRefs.current.forEach((nodeElement) => {
        resizeObserver.observe(nodeElement);
      });
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', requestMeasure);
      resizeObserver?.disconnect();
    };
  }, [
    family.people,
    displayLayout.height,
    displayLayout.width,
    renderedStageHeight,
    renderedStageWidth,
  ]);

  if (displayLayout.nodes.length === 0) {
    return (
      <div className="tree-stage tree-stage--empty">
        <p className="editor-empty-state">This family does not have any people yet.</p>
      </div>
    );
  }

  return (
    <div
      className="tree-stage-shell"
      style={{
        width: `${workspaceWidth}px`,
        height: `${workspaceHeight}px`,
        transform: `translate3d(${shellX}px, ${shellY}px, 0)`,
      }}
    >
      <div
        className="tree-stage-frame"
        style={{
          width: `${displayLayout.width}px`,
          height: `${displayLayout.height}px`,
          left: `${frameLeft}px`,
          top: `${frameTop}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        <div
          ref={stageRef}
          className="tree-stage"
          style={{
            width: `${displayLayout.width}px`,
            minWidth: `${displayLayout.width}px`,
            height: `${displayLayout.height}px`,
          }}
        >
          <svg
            className="tree-stage__links"
            viewBox={`0 0 ${measuredStage.width} ${measuredStage.height}`}
            preserveAspectRatio="none"
          >
            {connectorPaths.map((link) => (
              <path
                key={`${link.parentId}-${link.childId}`}
                className={`tree-stage__link${link.type === 'partner' ? ' tree-stage__link--partner' : ''}`}
                d={link.path}
                style={{ stroke: family.accent }}
              />
            ))}
          </svg>

          {displayLayout.nodes.map((node, index) => (
            <motion.button
              key={node.person.id}
              ref={(element) => {
                if (element) {
                  nodeRefs.current.set(node.person.id, element);
                  return;
                }

                nodeRefs.current.delete(node.person.id);
              }}
              type="button"
              className={`tree-node${node.person.id === activePersonId ? ' tree-node--active' : ''}`}
              style={{
                left: `${(node.x / displayLayout.width) * 100}%`,
                top: `${(node.y / displayLayout.height) * 100}%`,
                '--family-accent': family.accent,
                '--family-accent-soft': family.softAccent,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03, duration: 0.3, ease: 'easeOut' }}
              onClick={() => handleNodeClick(node.person.id)}
            >
              <span>{formatFamilyPersonName(node.person)}</span>
              <small>{formatFamilyPersonTileMeta(node.person)}</small>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDefaultContent() {
  return {
    contentVersion: CONTENT_SCHEMA_VERSION,
    timelineHighlights: cloneValue(defaultTimelineHighlights),
    familyTrees: cloneValue(defaultFamilyTrees),
  };
}

function loadStoredContent() {
  const defaultContent = getDefaultContent();

  if (typeof window === 'undefined') {
    return defaultContent;
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEYS.content);

    if (!storedValue) {
      return defaultContent;
    }

    const parsedContent = JSON.parse(storedValue);
    const storedContentVersion = Number.isFinite(parsedContent?.contentVersion)
      ? parsedContent.contentVersion
      : 0;
    const nextTimelineHighlights = Array.isArray(parsedContent.timelineHighlights)
      ? parsedContent.timelineHighlights
      : defaultContent.timelineHighlights;
    const nextFamilyTrees = mergeFamilyTrees(parsedContent.familyTrees, defaultContent.familyTrees);

    if (storedContentVersion < CONTENT_SCHEMA_VERSION) {
      nextFamilyTrees.blackwoods = normalizeFamilyTree(
        defaultContent.familyTrees.blackwoods,
        defaultContent.familyTrees.blackwoods,
      );
    }

    return {
      contentVersion: CONTENT_SCHEMA_VERSION,
      timelineHighlights: isLegacyTimelineSample(nextTimelineHighlights)
        ? defaultContent.timelineHighlights
        : normalizeTimelineEntries(nextTimelineHighlights, defaultContent.timelineHighlights),
      familyTrees: nextFamilyTrees,
    };
  } catch {
    return defaultContent;
  }
}

function loadStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEYS.session);

    if (!storedValue) {
      return null;
    }

    const parsedSession = JSON.parse(storedValue);

    if (
      parsedSession?.username === ADMIN_ACCOUNT.username &&
      parsedSession?.role === ADMIN_ACCOUNT.role
    ) {
      return parsedSession;
    }

    return null;
  } catch {
    return null;
  }
}

function mergeFamilyTrees(storedTrees, defaultTrees) {
  const nextTrees = {};

  for (const [familyId, defaultFamily] of Object.entries(defaultTrees)) {
    const storedFamily = storedTrees?.[familyId];

    nextTrees[familyId] = normalizeFamilyTree(storedFamily, defaultFamily);
  }

  return nextTrees;
}

function normalizeFamilyTree(family, fallbackFamily = {}) {
  const nextFamily = {
    ...cloneValue(fallbackFamily),
    ...cloneValue(family ?? {}),
  };

  const sourcePeople = Array.isArray(family?.people)
    ? family.people
    : Array.isArray(family?.nodes)
      ? family.nodes.map((node, index) =>
          convertLegacyNodeToFamilyPerson(
            node,
            index,
            family?.id ?? fallbackFamily?.id ?? 'family',
          ),
        )
      : Array.isArray(fallbackFamily?.people)
        ? fallbackFamily.people
        : [];
  const relationshipMode = nextFamily.relationshipMode ?? fallbackFamily.relationshipMode ?? 'family';
  const normalizedPeople = sourcePeople.map((person, index) =>
    normalizeFamilyPerson(person, index, fallbackFamily.people?.[index]),
  );

  return {
    ...nextFamily,
    relationshipMode,
    stats: Array.isArray(nextFamily.stats) ? nextFamily.stats : cloneValue(fallbackFamily.stats ?? []),
    notes: Array.isArray(nextFamily.notes) ? nextFamily.notes : cloneValue(fallbackFamily.notes ?? []),
    accent: nextFamily.accent ?? fallbackFamily.accent ?? '#5dc1c1',
    softAccent:
      nextFamily.softAccent ??
      (nextFamily.accent ? hexToRgba(nextFamily.accent, 0.32) : fallbackFamily.softAccent),
    people: normalizeFamilyPeopleForMode(normalizedPeople, relationshipMode),
  };
}

function sanitizeFamilyGraphCoordinate(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(2));
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsedValue = Number.parseFloat(value.trim());

  return Number.isFinite(parsedValue) ? Number(parsedValue.toFixed(2)) : null;
}

function normalizeFamilyPerson(person, index, fallbackPerson = {}) {
  const nextPerson = {
    ...cloneValue(fallbackPerson ?? {}),
    ...cloneValue(person ?? {}),
  };

  return {
    id: String(nextPerson.id ?? `family-person-${index + 1}`),
    firstName: String(nextPerson.firstName ?? '').trim(),
    lastName: String(nextPerson.lastName ?? '').trim(),
    gender: sanitizeGender(nextPerson.gender),
    birthMonth: sanitizeTimelineMonth(nextPerson.birthMonth),
    birthDay: sanitizeTimelineDay(nextPerson.birthDay, nextPerson.birthMonth),
    birthYear: sanitizeFamilyYear(nextPerson.birthYear),
    changedYear: sanitizeFamilyYear(nextPerson.changedYear),
    birthPlace: String(nextPerson.birthPlace ?? '').trim(),
    isDeceased: Boolean(nextPerson.isDeceased),
    deathMonth: Boolean(nextPerson.isDeceased) ? sanitizeTimelineMonth(nextPerson.deathMonth) : null,
    deathDay: Boolean(nextPerson.isDeceased)
      ? sanitizeTimelineDay(nextPerson.deathDay, nextPerson.deathMonth)
      : null,
    deathYear: Boolean(nextPerson.isDeceased) ? sanitizeFamilyYear(nextPerson.deathYear) : null,
    partnerIds: normalizeFamilyPartnerIds(nextPerson.partnerIds, nextPerson.id),
    motherId: nextPerson.motherId ? String(nextPerson.motherId) : null,
    fatherId: nextPerson.fatherId ? String(nextPerson.fatherId) : null,
    graphX: sanitizeFamilyGraphCoordinate(nextPerson.graphX),
    graphY: sanitizeFamilyGraphCoordinate(nextPerson.graphY),
    description: String(nextPerson.description ?? '').trim(),
  };
}

function convertLegacyNodeToFamilyPerson(node, index, familyId) {
  const trimmedLabel = String(node?.label ?? '').trim();
  const labelParts = trimmedLabel.split(/\s+/).filter(Boolean);
  const [firstName = `Person ${index + 1}`, ...lastNameParts] = labelParts;

  return {
    id: String(node?.id ?? `${familyId}-person-${index + 1}`),
    firstName,
    lastName: lastNameParts.join(' '),
    gender: 'other',
    birthMonth: null,
    birthDay: null,
    birthYear: null,
    changedYear: null,
    birthPlace: '',
    isDeceased: false,
    deathMonth: null,
    deathDay: null,
    deathYear: null,
    partnerIds: [],
    motherId: null,
    fatherId: null,
    graphX: null,
    graphY: null,
    description: String(node?.description ?? node?.subtitle ?? '').trim(),
  };
}

function createEmptyFamilyPerson() {
  return {
    firstName: '',
    lastName: '',
    gender: 'other',
    birthMonth: '',
    birthDay: '',
    birthYear: '',
    birthEra: 'CE',
    changedYear: '',
    changedEra: 'CE',
    birthPlace: '',
    isDeceased: false,
    deathMonth: '',
    deathDay: '',
    deathYear: '',
    deathEra: 'CE',
    partnerIds: [],
    motherId: null,
    fatherId: null,
    description: '',
  };
}

function createEmptyFamilyPartnerDraft() {
  return {
    firstName: '',
    lastName: '',
    gender: 'other',
  };
}

function createFamilyPersonDraft(initialPerson, relationType, anchorPersonId, people, family) {
  if (initialPerson) {
    const primaryParentId = getFamilyPrimaryParentId(initialPerson, family);

    return {
      firstName: initialPerson.firstName ?? '',
      lastName: initialPerson.lastName ?? '',
      gender: sanitizeGender(initialPerson.gender),
      birthMonth: initialPerson.birthMonth ? String(initialPerson.birthMonth) : '',
      birthDay: initialPerson.birthDay ? String(initialPerson.birthDay) : '',
      birthYear: initialPerson.birthYear ? String(getTimelineYearNumber(initialPerson.birthYear)) : '',
      birthEra: getFamilyYearEra(initialPerson.birthYear),
      changedYear: initialPerson.changedYear
        ? String(getTimelineYearNumber(initialPerson.changedYear))
        : '',
      changedEra: getFamilyYearEra(initialPerson.changedYear),
      birthPlace: initialPerson.birthPlace ?? '',
      isDeceased: Boolean(initialPerson.isDeceased),
      deathMonth: initialPerson.deathMonth ? String(initialPerson.deathMonth) : '',
      deathDay: initialPerson.deathDay ? String(initialPerson.deathDay) : '',
      deathYear: initialPerson.deathYear ? String(getTimelineYearNumber(initialPerson.deathYear)) : '',
      deathEra: getFamilyYearEra(initialPerson.deathYear),
      partnerIds: initialPerson.partnerIds ?? [],
      motherId: isFamilySingleParentMode(family)
        ? primaryParentId
        : initialPerson.motherId ?? null,
      fatherId: isFamilySingleParentMode(family) ? null : initialPerson.fatherId ?? null,
      description: initialPerson.description ?? '',
    };
  }

  const nextDraft = createEmptyFamilyPerson();
  const anchorPerson = anchorPersonId
    ? people.find((person) => person.id === anchorPersonId) ?? null
    : null;

  if (relationType === 'child' && anchorPerson) {
    const nextSlot = getAssignableParentSlot(nextDraft, anchorPerson, family);

    if (nextSlot) {
      nextDraft[getParentFieldName(nextSlot)] = anchorPerson.id;
    }
  }

  return nextDraft;
}

function replaceFamilyPerson(family, nextPerson) {
  const normalizedFamily = normalizeFamilyTree(family);

  return {
    ...normalizedFamily,
    people: normalizedFamily.people.map((person) =>
      person.id === nextPerson.id ? normalizeFamilyPerson(nextPerson, 0, person) : person,
    ),
  };
}

function removeFamilyPerson(family, personId) {
  const normalizedFamily = normalizeFamilyTree(family);

  return {
    ...normalizedFamily,
    people: normalizedFamily.people
      .filter((person) => person.id !== personId)
      .map((person) => ({
        ...person,
        partnerIds: person.partnerIds.filter((partnerId) => partnerId !== personId),
        motherId: person.motherId === personId ? null : person.motherId,
        fatherId: person.fatherId === personId ? null : person.fatherId,
      })),
  };
}

function insertFamilyPerson(family, nextPerson, modalState) {
  const normalizedFamily = normalizeFamilyTree(family);
  let nextPeople = [...normalizedFamily.people, normalizeFamilyPerson(nextPerson, normalizedFamily.people.length)];

  if (modalState?.relationType === 'child' && modalState.anchorPersonId) {
    nextPeople = attachParentToFamilyPerson(
      nextPeople,
      nextPerson.id,
      modalState.anchorPersonId,
      normalizedFamily,
    );
  }

  if (modalState?.relationType === 'parent' && modalState.anchorPersonId) {
    nextPeople = attachParentToFamilyPerson(
      nextPeople,
      modalState.anchorPersonId,
      nextPerson.id,
      normalizedFamily,
    );
  }

  return {
    ...normalizedFamily,
    people: normalizeFamilyPeopleForMode(nextPeople, normalizedFamily.relationshipMode),
  };
}

function attachParentToFamilyPerson(people, childId, parentId, family) {
  const parent = people.find((person) => person.id === parentId);

  if (!parent) {
    return people;
  }

  return people.map((person) => {
    if (person.id !== childId || getFamilyParentIds(person, family).includes(parentId)) {
      return person;
    }

    const nextSlot = getAssignableParentSlot(person, parent, family);

    if (!nextSlot) {
      return person;
    }

    return {
      ...person,
      [getParentFieldName(nextSlot)]: parentId,
    };
  });
}

function getAssignableParentSlot(person, parent, family) {
  if (isFamilySingleParentMode(family)) {
    return getFamilyPrimaryParentId(person, family) ? null : 'maker';
  }

  const preferredSlot = getPreferredParentSlot(parent?.gender, family);

  if (preferredSlot && !person[getParentFieldName(preferredSlot)]) {
    return preferredSlot;
  }

  if (!person.motherId) {
    return 'mother';
  }

  if (!person.fatherId) {
    return 'father';
  }

  return null;
}

function getPreferredParentSlot(gender, family) {
  if (isFamilySingleParentMode(family)) {
    return 'maker';
  }

  if (gender === 'female') {
    return 'mother';
  }

  if (gender === 'male') {
    return 'father';
  }

  return null;
}

function getParentFieldName(slot) {
  if (slot === 'maker') {
    return 'motherId';
  }

  if (slot === 'mother') {
    return 'motherId';
  }

  if (slot === 'father') {
    return 'fatherId';
  }

  return '';
}

function normalizeFamilyPartnerIds(partnerIds, currentPersonId) {
  if (!Array.isArray(partnerIds)) {
    return [];
  }

  return [...new Set(
    partnerIds
      .map((partnerId) => String(partnerId ?? '').trim())
      .filter((partnerId) => partnerId && partnerId !== String(currentPersonId ?? '')),
  )];
}

function createFamilyPersonId(family) {
  return createFamilyPersonIds(family, 1)[0];
}

function createFamilyPersonIds(family, count) {
  const existingIds = new Set(family.people.map((person) => person.id));
  const nextIds = [];
  let personNumber = family.people.length + 1;

  while (nextIds.length < count) {
    const nextId = `${family.id}-person-${personNumber}`;

    if (!existingIds.has(nextId)) {
      nextIds.push(nextId);
      existingIds.add(nextId);
    }

    personNumber += 1;
  }

  return nextIds;
}

function sanitizeFamilyYear(value, era = 'CE') {
  if (typeof value === 'number' && Number.isInteger(value) && value !== 0) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();

  if (!normalizedValue) {
    return null;
  }

  if (/(BCE|BC|CE|AD)$/.test(normalizedValue)) {
    const parsedYear = parseHistoricalYearValue(normalizedValue);

    if (!Number.isNaN(parsedYear)) {
      return parsedYear;
    }
  }

  const numericYear = Number.parseInt(normalizedValue, 10);

  if (Number.isNaN(numericYear) || numericYear < 1) {
    return null;
  }

  return buildHistoricalYear(numericYear, era === 'BCE' ? 'BCE' : 'CE');
}

function getFamilyYearEra(year) {
  if (typeof year !== 'number' || Number.isNaN(year) || year === 0) {
    return 'CE';
  }

  return getTimelineYearEra(year);
}

function sanitizeFamilyRelationId(value, people, currentPersonId) {
  if (!value) {
    return null;
  }

  if (value === currentPersonId) {
    return null;
  }

  return people.some((person) => person.id === value) ? value : null;
}

function sanitizeGender(value) {
  return value === 'male' || value === 'female' || value === 'other' ? value : 'other';
}

function isFamilySingleParentMode(family) {
  return family?.relationshipMode === 'maker';
}

function getFamilyRelationshipCopy(family) {
  if (isFamilySingleParentMode(family)) {
    return {
      layoutLabel: 'Maker-fledgling links',
      newEntryEyebrow: 'New vampire',
      parentActionLabel: 'Add Maker',
      childActionLabel: 'Add Fledgling',
      parentSingularLabel: 'Maker',
      parentSearchLabel: 'Search for maker',
      parentEmptyLabel: 'No maker linked yet.',
      childPluralLabel: 'Fledglings',
      childEmptyLabel: 'No fledglings linked yet.',
      siblingPluralLabel: 'Kin',
      siblingEmptyLabel: 'No kin linked yet.',
      partnerPluralLabel: 'Partners',
      partnerEmptyLabel: 'No partners linked yet.',
      partnerSearchLabel: 'Search for partner',
      partnerCreateLabel: 'Create New Partner',
      partnerLinkLabel: 'Link Existing Partner',
      childFlowLabel: 'fledgling',
      parentFlowLabel: 'maker',
      prefilledParentLabel: 'maker',
    };
  }

  return {
    layoutLabel: 'Parent-child links',
    newEntryEyebrow: 'New person',
    parentActionLabel: 'Add Parent',
    childActionLabel: 'Add Child',
    parentSingularLabel: 'Parent',
    parentSearchLabel: 'Search for parent',
    parentEmptyLabel: 'Not linked yet.',
    childPluralLabel: 'Children',
    childEmptyLabel: 'No children linked yet.',
    siblingPluralLabel: 'Siblings',
    siblingEmptyLabel: 'No siblings linked yet.',
    partnerPluralLabel: 'Partners',
    partnerEmptyLabel: 'No partners linked yet.',
    partnerSearchLabel: 'Search for partner',
    partnerCreateLabel: 'Create New Partner',
    partnerLinkLabel: 'Link Existing Partner',
    childFlowLabel: 'child',
    parentFlowLabel: 'parent',
    prefilledParentLabel: 'parent',
  };
}

function normalizeFamilyPeopleForMode(people, relationshipMode) {
  const basePeople = people.map((person) => {
    const makerId = person.motherId ?? person.fatherId ?? null;

    const nextPerson = {
      ...person,
      partnerIds: normalizeFamilyPartnerIds(person.partnerIds, person.id),
      ...(relationshipMode === 'maker'
        ? {
            motherId: makerId,
            fatherId: null,
          }
        : null),
    };

    if (relationshipMode === 'maker') {
      nextPerson.partnerIds = [];
    }

    return nextPerson;
  });

  if (relationshipMode === 'maker') {
    return basePeople;
  }

  const peopleById = new Map(basePeople.map((person) => [person.id, { ...person }]));

  peopleById.forEach((person) => {
    person.partnerIds = person.partnerIds.filter((partnerId) => peopleById.has(partnerId));

    person.partnerIds.forEach((partnerId) => {
      const partner = peopleById.get(partnerId);

      if (partner && !partner.partnerIds.includes(person.id)) {
        partner.partnerIds = [...partner.partnerIds, person.id];
      }
    });
  });

  return basePeople.map((person) => ({
    ...peopleById.get(person.id),
    partnerIds: normalizeFamilyPartnerIds(peopleById.get(person.id)?.partnerIds, person.id),
  }));
}

function getFamilyParentIds(person, family) {
  if (!person) {
    return [];
  }

  if (isFamilySingleParentMode(family)) {
    const makerId = person.motherId ?? person.fatherId ?? null;
    return makerId ? [makerId] : [];
  }

  return [person.motherId, person.fatherId].filter(Boolean);
}

function getFamilyPrimaryParentId(person, family) {
  return getFamilyParentIds(person, family)[0] ?? null;
}

function getChildrenForPerson(people, personId, family) {
  return people.filter((person) => getFamilyParentIds(person, family).includes(personId));
}

function getPartnersForPerson(people, personId, family) {
  if (isFamilySingleParentMode(family)) {
    return [];
  }

  const targetPerson = people.find((person) => person.id === personId);

  if (!targetPerson) {
    return [];
  }

  return targetPerson.partnerIds
    .map((partnerId) => people.find((person) => person.id === partnerId))
    .filter(Boolean)
    .sort(compareFamilyPeopleForLayout);
}

function setFamilyPersonPartners(people, personId, nextPartnerIds) {
  const normalizedPartnerIds = normalizeFamilyPartnerIds(nextPartnerIds, personId);

  return people.map((person) => {
    if (person.id === personId) {
      return {
        ...person,
        partnerIds: normalizedPartnerIds,
      };
    }

    const shouldLink = normalizedPartnerIds.includes(person.id);
    const hasLink = person.partnerIds.includes(personId);

    if (shouldLink && !hasLink) {
      return {
        ...person,
        partnerIds: [...person.partnerIds, personId],
      };
    }

    if (!shouldLink && hasLink) {
      return {
        ...person,
        partnerIds: person.partnerIds.filter((partnerId) => partnerId !== personId),
      };
    }

    return person;
  });
}

function getFamilyPartnerPairs(people, family) {
  if (isFamilySingleParentMode(family)) {
    return [];
  }

  return people.flatMap((person) =>
    person.partnerIds
      .filter((partnerId) => person.id < partnerId)
      .map((partnerId) => ({
        leftId: person.id,
        rightId: partnerId,
      })),
  );
}

function areFamilyPeoplePartners(peopleById, firstPersonId, secondPersonId) {
  if (!firstPersonId || !secondPersonId || firstPersonId === secondPersonId) {
    return false;
  }

  const firstPerson = peopleById.get(firstPersonId);
  const secondPerson = peopleById.get(secondPersonId);

  if (!firstPerson || !secondPerson) {
    return false;
  }

  return (
    (firstPerson.partnerIds ?? []).includes(secondPersonId) ||
    (secondPerson.partnerIds ?? []).includes(firstPersonId)
  );
}

function createFamilyConnectorPath(startX, startY, endX, endY) {
  const controlY = startY + (endY - startY) / 2;
  return `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
}

function createFamilyPartnerConnectorPath(startX, startY, endX, endY) {
  if (Math.abs(startY - endY) < 6) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const midX = startX + (endX - startX) / 2;
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function createFamilyElbowConnectorPath(startX, startY, endX, endY, preferredRailY = null) {
  const verticalGap = endY - startY;
  const horizontalSpan = Math.abs(endX - startX);

  if (verticalGap <= 24 || horizontalSpan <= 18) {
    return createFamilyConnectorPath(startX, startY, endX, endY);
  }

  const candidateRailY =
    preferredRailY ??
    startY + Math.min(58, Math.max(verticalGap * 0.4, 30));
  const railY = Math.max(startY + 20, Math.min(endY - 20, candidateRailY));
  const radius = Math.min(16, Math.max(6, Math.min(horizontalSpan / 4, verticalGap / 4)));
  const direction = endX >= startX ? 1 : -1;

  if (Math.abs(startX - endX) < 2 || horizontalSpan < radius * 2 + 2) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  return [
    `M ${startX} ${startY}`,
    `L ${startX} ${railY - radius}`,
    `Q ${startX} ${railY} ${startX + direction * radius} ${railY}`,
    `L ${endX - direction * radius} ${railY}`,
    `Q ${endX} ${railY} ${endX} ${railY + radius}`,
    `L ${endX} ${endY}`,
  ].join(' ');
}

function getFamilySharedParentAnchor(parentBoxes) {
  if (parentBoxes.length !== 2) {
    return null;
  }

  const [leftParentBox, rightParentBox] = parentBoxes
    .slice()
    .sort((leftBox, rightBox) => leftBox.centerX - rightBox.centerX);

  return {
    x: (leftParentBox.rightX + rightParentBox.leftX) / 2,
    y: (leftParentBox.centerY + rightParentBox.centerY) / 2,
    leftParentId: leftParentBox.id,
    rightParentId: rightParentBox.id,
  };
}

function getFamilyChildConnectorLinks(person, family, peopleById, parentBoxes, childX, childTopY) {
  const parentIds = getFamilyParentIds(person, family);

  if (
    parentIds.length === 2 &&
    parentBoxes.length === 2 &&
    areFamilyPeoplePartners(peopleById, parentIds[0], parentIds[1])
  ) {
    const sharedParentAnchor = getFamilySharedParentAnchor(parentBoxes);

    if (sharedParentAnchor) {
      return [
        {
          parentId: sharedParentAnchor.leftParentId,
          childId: person.id,
          sharedParentId: sharedParentAnchor.rightParentId,
          path: createFamilyConnectorPath(
            sharedParentAnchor.x,
            sharedParentAnchor.y,
            childX,
            childTopY,
          ),
        },
      ];
    }
  }

  return parentBoxes.map((parentBox) => ({
    parentId: parentBox.id,
    childId: person.id,
    path: createFamilyConnectorPath(parentBox.centerX, parentBox.bottomY, childX, childTopY),
  }));
}

function getFamilyRenderedChildConnectorLinks(people, family, resolvePersonBox) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const groupedPartnerChildren = new Map();
  const nextLinks = [];

  people.forEach((person) => {
    const childBox = resolvePersonBox(person.id);

    if (!childBox) {
      return;
    }

    const parentIds = getFamilyParentIds(person, family);
    const parentBoxes = parentIds.map((parentId) => resolvePersonBox(parentId)).filter(Boolean);

    if (
      parentIds.length === 2 &&
      parentBoxes.length === 2 &&
      areFamilyPeoplePartners(peopleById, parentIds[0], parentIds[1])
    ) {
      const sharedParentAnchor = getFamilySharedParentAnchor(parentBoxes);

      if (sharedParentAnchor) {
        const sortedParentIds = [sharedParentAnchor.leftParentId, sharedParentAnchor.rightParentId].sort();
        const rowKey = Math.round(childBox.topY);
        const groupKey = `${sortedParentIds[0]}|${sortedParentIds[1]}|${rowKey}`;

        if (!groupedPartnerChildren.has(groupKey)) {
          groupedPartnerChildren.set(groupKey, {
            parentIds: sortedParentIds,
            sharedParentAnchor,
            children: [],
          });
        }

        groupedPartnerChildren.get(groupKey).children.push({
          childId: person.id,
          x: childBox.centerX,
          topY: childBox.topY,
        });
        return;
      }
    }

    parentBoxes.forEach((parentBox) => {
      nextLinks.push({
        parentId: parentBox.id,
        childId: person.id,
        path: createFamilyConnectorPath(
          parentBox.centerX,
          parentBox.bottomY,
          childBox.centerX,
          childBox.topY,
        ),
      });
    });
  });

  groupedPartnerChildren.forEach((group) => {
    const children = group.children.slice().sort((leftChild, rightChild) => leftChild.x - rightChild.x);

    if (!children.length) {
      return;
    }

    const highestChildTopY = Math.min(...children.map((child) => child.topY));
    const railY = Math.max(
      group.sharedParentAnchor.y + 24,
      Math.min(highestChildTopY - 28, group.sharedParentAnchor.y + 58),
    );

    if (children.length === 1) {
      const [child] = children;
      const deltaX = Math.abs(child.x - group.sharedParentAnchor.x);

      nextLinks.push({
        parentId: group.parentIds[0],
        childId: child.childId,
        sharedParentId: group.parentIds[1],
        path:
          deltaX <= 56
            ? `M ${group.sharedParentAnchor.x} ${group.sharedParentAnchor.y} L ${group.sharedParentAnchor.x} ${child.topY}`
            : createFamilyElbowConnectorPath(
                group.sharedParentAnchor.x,
                group.sharedParentAnchor.y,
                child.x,
                child.topY,
                railY,
              ),
      });
      return;
    }

    const minChildX = children[0].x;
    const maxChildX = children[children.length - 1].x;
    const parentKey = `${group.parentIds[0]}-${group.parentIds[1]}-${Math.round(railY)}`;

    nextLinks.push({
      parentId: group.parentIds[0],
      childId: `${parentKey}-trunk`,
      sharedParentId: group.parentIds[1],
      path: `M ${group.sharedParentAnchor.x} ${group.sharedParentAnchor.y} L ${group.sharedParentAnchor.x} ${railY}`,
    });
    nextLinks.push({
      parentId: group.parentIds[0],
      childId: `${parentKey}-rail`,
      sharedParentId: group.parentIds[1],
      path: `M ${Math.min(minChildX, group.sharedParentAnchor.x)} ${railY} L ${Math.max(maxChildX, group.sharedParentAnchor.x)} ${railY}`,
    });

    children.forEach((child) => {
      nextLinks.push({
        parentId: group.parentIds[0],
        childId: child.childId,
        sharedParentId: group.parentIds[1],
        path: `M ${child.x} ${railY} L ${child.x} ${child.topY}`,
      });
    });
  });

  return nextLinks;
}

function getSiblingsForPerson(people, personId, family) {
  const targetPerson = people.find((person) => person.id === personId);

  if (!targetPerson) {
    return [];
  }

  const sharedParentIds = new Set(getFamilyParentIds(targetPerson, family));

  if (sharedParentIds.size === 0) {
    return [];
  }

  return people
    .filter((person) => {
      if (person.id === personId) {
        return false;
      }

      return getFamilyParentIds(person, family).some((parentId) => sharedParentIds.has(parentId));
    })
    .sort((leftPerson, rightPerson) => {
      const leftBirth = leftPerson.birthYear ?? Number.MAX_SAFE_INTEGER;
      const rightBirth = rightPerson.birthYear ?? Number.MAX_SAFE_INTEGER;

      if (leftBirth !== rightBirth) {
        return leftBirth - rightBirth;
      }

      return formatFamilyPersonName(leftPerson).localeCompare(formatFamilyPersonName(rightPerson));
    });
}

function getFamilyTreeStats(family) {
  const people = family?.people ?? [];
  const generationCount = getFamilyGenerationCount(people, family);
  const rootCount = people.filter((person) => getFamilyParentIds(person, family).length === 0).length;

  return [
    { label: 'Recorded people', value: String(people.length) },
    { label: 'Root branches', value: String(rootCount || (people.length ? 1 : 0)) },
    { label: 'Visible generations', value: String(generationCount) },
  ];
}

function getFamilyGenerationCount(people, family) {
  const generations = getFamilyGenerations(people, family);
  return generations.length || 1;
}

function compareFamilyPeopleForLayout(leftPerson, rightPerson) {
  const leftBirth = leftPerson.birthYear ?? Number.MAX_SAFE_INTEGER;
  const rightBirth = rightPerson.birthYear ?? Number.MAX_SAFE_INTEGER;

  if (leftBirth !== rightBirth) {
    return leftBirth - rightBirth;
  }

  return formatFamilyPersonName(leftPerson).localeCompare(formatFamilyPersonName(rightPerson));
}

function getFamilyGenerations(people, family) {
  const personMap = new Map(people.map((person) => [person.id, person]));
  const generationCache = new Map();

  function resolveGeneration(personId, stack = new Set()) {
    if (generationCache.has(personId)) {
      return generationCache.get(personId);
    }

    if (stack.has(personId)) {
      return 0;
    }

    const person = personMap.get(personId);

    if (!person) {
      return 0;
    }

    stack.add(personId);

    const parentIds = getFamilyParentIds(person, family).filter((parentId) => personMap.has(parentId));

    const nextGeneration = parentIds.length
      ? Math.max(...parentIds.map((parentId) => resolveGeneration(parentId, new Set(stack)))) + 1
      : 0;

    generationCache.set(personId, nextGeneration);
    return nextGeneration;
  }

  people.forEach((person) => {
    resolveGeneration(person.id);
  });

  if (!isFamilySingleParentMode(family)) {
    let changed = true;

    while (changed) {
      changed = false;

      people.forEach((person) => {
        const personGeneration = generationCache.get(person.id) ?? 0;

        (person.partnerIds ?? []).forEach((partnerId) => {
          if (!personMap.has(partnerId)) {
            return;
          }

          const partnerGeneration = generationCache.get(partnerId) ?? resolveGeneration(partnerId);
          const nextGeneration = Math.max(personGeneration, partnerGeneration);

          if ((generationCache.get(person.id) ?? 0) !== nextGeneration) {
            generationCache.set(person.id, nextGeneration);
            changed = true;
          }

          if ((generationCache.get(partnerId) ?? 0) !== nextGeneration) {
            generationCache.set(partnerId, nextGeneration);
            changed = true;
          }
        });
      });
    }
  }

  const groupedGenerations = [];

  people.forEach((person) => {
    const generation = generationCache.get(person.id) ?? resolveGeneration(person.id);

    if (!groupedGenerations[generation]) {
      groupedGenerations[generation] = [];
    }

    groupedGenerations[generation].push(person);
  });

  return groupedGenerations
    .filter(Boolean)
    .map((generationPeople) =>
      generationPeople.slice().sort((leftPerson, rightPerson) => {
        const leftBirth = leftPerson.birthYear ?? Number.MAX_SAFE_INTEGER;
        const rightBirth = rightPerson.birthYear ?? Number.MAX_SAFE_INTEGER;

        if (leftBirth !== rightBirth) {
          return leftBirth - rightBirth;
        }

        return formatFamilyPersonName(leftPerson).localeCompare(formatFamilyPersonName(rightPerson));
      }),
    );
}

function buildSingleParentFamilyTreeLayout(family) {
  const people = family?.people ?? [];
  const cardWidth = FAMILY_CARD_WIDTH;
  const cardHeight = FAMILY_CARD_HEIGHT;
  const horizontalGap = 52;
  const branchGap = 90;
  const verticalGap = 116;
  const paddingX = FAMILY_LAYOUT_PADDING_X;
  const paddingY = FAMILY_LAYOUT_PADDING_Y;
  const generations = getFamilyGenerations(people, family);
  const generationIndexMap = new Map();
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const personPositions = new Map();
  const layoutChildrenMap = new Map(people.map((person) => [person.id, []]));
  const rootPeople = [];

  generations.forEach((generation, generationIndex) => {
    generation.forEach((person) => {
      generationIndexMap.set(person.id, generationIndex);
    });
  });

  people.forEach((person) => {
    const layoutParentId = getFamilyLayoutParentId(person, family);

    if (layoutParentId && layoutChildrenMap.has(layoutParentId) && layoutParentId !== person.id) {
      layoutChildrenMap.get(layoutParentId).push(person);
      return;
    }

    rootPeople.push(person);
  });

  layoutChildrenMap.forEach((children) => {
    children.sort(compareFamilyPeopleForLayout);
  });

  const subtreeWidthCache = new Map();

  function getChildrenRowWidth(children, stack = new Set()) {
    if (!children.length) {
      return 0;
    }

    return children.reduce((totalWidth, child, childIndex) => {
      return (
        totalWidth +
        getSubtreeWidth(child.id, stack) +
        (childIndex === 0 ? 0 : horizontalGap)
      );
    }, 0);
  }

  function getSubtreeWidth(personId, stack = new Set()) {
    if (subtreeWidthCache.has(personId)) {
      return subtreeWidthCache.get(personId);
    }

    if (stack.has(personId)) {
      return cardWidth;
    }

    const children = layoutChildrenMap.get(personId) ?? [];
    const nextStack = new Set(stack);
    nextStack.add(personId);
    const childrenWidth = getChildrenRowWidth(children, nextStack);
    const subtreeWidth = Math.max(cardWidth, childrenWidth);

    subtreeWidthCache.set(personId, subtreeWidth);
    return subtreeWidth;
  }

  const minimumHeight =
    generations.length * cardHeight +
    Math.max(0, generations.length - 1) * verticalGap +
    paddingY * 2;
  const sortedRoots = (rootPeople.length ? rootPeople : people)
    .slice()
    .sort(compareFamilyPeopleForLayout);
  let nextLeft = paddingX;

  function assignSubtree(person, left, stack = new Set()) {
    if (personPositions.has(person.id) || stack.has(person.id)) {
      return;
    }

    const subtreeWidth = getSubtreeWidth(person.id, stack);
    const generationIndex = generationIndexMap.get(person.id) ?? 0;
    const x = left + subtreeWidth / 2;
    const y = paddingY + generationIndex * (cardHeight + verticalGap) + cardHeight / 2;
    const children = layoutChildrenMap.get(person.id) ?? [];
    const nextStack = new Set(stack);
    nextStack.add(person.id);

    personPositions.set(person.id, { x, y, person, generationIndex });

    if (!children.length) {
      return;
    }

    const childrenWidth = getChildrenRowWidth(children, nextStack);
    let childLeft = left + Math.max((subtreeWidth - childrenWidth) / 2, 0);

    children.forEach((child) => {
      assignSubtree(child, childLeft, nextStack);
      childLeft += getSubtreeWidth(child.id, nextStack) + horizontalGap;
    });
  }

  function placeRoot(person) {
    if (personPositions.has(person.id)) {
      return;
    }

    assignSubtree(person, nextLeft);
    nextLeft += getSubtreeWidth(person.id) + branchGap;
  }

  sortedRoots.forEach(placeRoot);
  people
    .filter((person) => !personPositions.has(person.id))
    .sort(compareFamilyPeopleForLayout)
    .forEach(placeRoot);

  people.forEach((person) => {
    const currentPosition = personPositions.get(person.id);

    if (!currentPosition) {
      return;
    }

    if (person.graphX === null && person.graphY === null) {
      return;
    }

    personPositions.set(person.id, {
      ...currentPosition,
      x: person.graphX ?? currentPosition.x,
      y: person.graphY ?? currentPosition.y,
    });
  });

  const positionedNodes = Array.from(personPositions.values());
  const minCardLeft = positionedNodes.length
    ? Math.min(...positionedNodes.map((position) => position.x - cardWidth / 2))
    : paddingX;
  const maxCardRight = positionedNodes.length
    ? Math.max(...positionedNodes.map((position) => position.x + cardWidth / 2))
    : paddingX + cardWidth;
  const minCardTop = positionedNodes.length
    ? Math.min(...positionedNodes.map((position) => position.y - cardHeight / 2))
    : paddingY;
  const maxCardBottom = positionedNodes.length
    ? Math.max(...positionedNodes.map((position) => position.y + cardHeight / 2))
    : paddingY + cardHeight;
  const xShift = paddingX - minCardLeft;
  const yShift = paddingY - minCardTop;

  if (xShift !== 0 || yShift !== 0) {
    personPositions.forEach((position, personId) => {
      personPositions.set(personId, {
        ...position,
        x: position.x + xShift,
        y: position.y + yShift,
      });
    });
  }

  const width = Math.max(cardWidth + paddingX * 2, maxCardRight - minCardLeft + paddingX * 2);
  const height = Math.max(minimumHeight, maxCardBottom - minCardTop + paddingY * 2);
  const nodes = people
    .map((person) => personPositions.get(person.id))
    .filter(Boolean);
  const links = people.flatMap((person) => {
    const childPosition = personPositions.get(person.id);

    if (!childPosition) {
      return [];
    }

    const parentBoxes = getFamilyParentIds(person, family)
      .map((parentId) => {
        const parentPosition = personPositions.get(parentId);

        if (!parentPosition) {
          return null;
        }

        return {
          id: parentId,
          centerX: parentPosition.x,
          centerY: parentPosition.y,
          leftX: parentPosition.x - cardWidth / 2,
          rightX: parentPosition.x + cardWidth / 2,
          bottomY: parentPosition.y + cardHeight / 2,
        };
      })
      .filter(Boolean);

    return getFamilyChildConnectorLinks(
      person,
      family,
      peopleById,
      parentBoxes,
      childPosition.x,
      childPosition.y - cardHeight / 2,
    );
  });

  return {
    width,
    height,
    nodes,
    links,
  };
}

function buildPartnerGraphFamilyLayout(family) {
  const people = family?.people ?? [];
  const cardWidth = FAMILY_CARD_WIDTH;
  const cardHeight = FAMILY_CARD_HEIGHT;
  const horizontalGap = 52;
  const branchGap = 90;
  const verticalGap = 116;
  const paddingX = FAMILY_LAYOUT_PADDING_X;
  const paddingY = FAMILY_LAYOUT_PADDING_Y;
  const generations = getFamilyGenerations(people, family);
  const generationIndexMap = new Map();
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const personPositions = new Map();

  generations.forEach((generation, generationIndex) => {
    generation.forEach((person) => {
      generationIndexMap.set(person.id, generationIndex);
    });
  });

  const partnerIdsByPerson = new Map(
    people.map((person) => [
      person.id,
      (person.partnerIds ?? []).filter((partnerId) => peopleById.has(partnerId)),
    ]),
  );

  function getClusterWidth(memberCount) {
    if (!memberCount) {
      return 0;
    }

    return memberCount * cardWidth + Math.max(0, memberCount - 1) * horizontalGap;
  }

  function getPersonParentAnchorX(person) {
    const parentIds = getFamilyParentIds(person, family).filter((parentId) => personPositions.has(parentId));

    if (!parentIds.length) {
      return null;
    }

    const parentBoxes = parentIds
      .map((parentId) => {
        const parentPosition = personPositions.get(parentId);

        if (!parentPosition) {
          return null;
        }

        return {
          id: parentId,
          centerX: parentPosition.x,
          centerY: parentPosition.y,
          leftX: parentPosition.x - cardWidth / 2,
          rightX: parentPosition.x + cardWidth / 2,
        };
      })
      .filter(Boolean);

    if (!parentBoxes.length) {
      return null;
    }

    if (
      parentBoxes.length === 2 &&
      areFamilyPeoplePartners(peopleById, parentBoxes[0].id, parentBoxes[1].id)
    ) {
      return (
        getFamilySharedParentAnchor(parentBoxes)?.x ??
        parentBoxes.reduce((totalX, parentBox) => totalX + parentBox.centerX, 0) / parentBoxes.length
      );
    }

    return parentBoxes.reduce((totalX, parentBox) => totalX + parentBox.centerX, 0) / parentBoxes.length;
  }

  function getGenerationPartnerClusters(generation) {
    const generationPersonIds = new Set(generation.map((person) => person.id));
    const visitedPersonIds = new Set();
    const clusters = [];

    generation.forEach((person) => {
      if (visitedPersonIds.has(person.id)) {
        return;
      }

      const stack = [person.id];
      const clusterPersonIds = [];
      visitedPersonIds.add(person.id);

      while (stack.length) {
        const currentPersonId = stack.pop();
        clusterPersonIds.push(currentPersonId);

        (partnerIdsByPerson.get(currentPersonId) ?? []).forEach((partnerId) => {
          if (!generationPersonIds.has(partnerId) || visitedPersonIds.has(partnerId)) {
            return;
          }

          visitedPersonIds.add(partnerId);
          stack.push(partnerId);
        });
      }

      clusters.push(clusterPersonIds);
    });

    return clusters;
  }

  function getGenerationPreferredXMap(generation) {
    const preferredXMap = new Map();

    generation.forEach((person) => {
      preferredXMap.set(person.id, getPersonParentAnchorX(person));
    });

    if (!isFamilySingleParentMode(family)) {
      let changed = true;

      while (changed) {
        changed = false;

        generation.forEach((person) => {
          const currentPreferredX = preferredXMap.get(person.id);

          if (currentPreferredX !== null && currentPreferredX !== undefined) {
            return;
          }

          const partnerPreferredXs = (partnerIdsByPerson.get(person.id) ?? [])
            .filter((partnerId) => generationIndexMap.get(partnerId) === generationIndexMap.get(person.id))
            .map((partnerId) => preferredXMap.get(partnerId))
            .filter((preferredX) => preferredX !== null && preferredX !== undefined);

          if (!partnerPreferredXs.length) {
            return;
          }

          preferredXMap.set(
            person.id,
            partnerPreferredXs.reduce((totalX, preferredX) => totalX + preferredX, 0) /
              partnerPreferredXs.length,
          );
          changed = true;
        });
      }
    }

    return preferredXMap;
  }

  function optimizeClusterMemberOrder(memberIds, preferredXMap) {
    if (memberIds.length <= 1) {
      return memberIds.slice();
    }

    const clusterMemberIds = new Set(memberIds);
    const desiredOrder = memberIds.slice().sort((leftPersonId, rightPersonId) => {
      const leftPreferredX = preferredXMap.get(leftPersonId);
      const rightPreferredX = preferredXMap.get(rightPersonId);
      const leftHasPreferredX = leftPreferredX !== null && leftPreferredX !== undefined;
      const rightHasPreferredX = rightPreferredX !== null && rightPreferredX !== undefined;

      if (leftHasPreferredX && rightHasPreferredX && leftPreferredX !== rightPreferredX) {
        return leftPreferredX - rightPreferredX;
      }

      if (leftHasPreferredX !== rightHasPreferredX) {
        return leftHasPreferredX ? -1 : 1;
      }

      return compareFamilyPeopleForLayout(
        peopleById.get(leftPersonId),
        peopleById.get(rightPersonId),
      );
    });
    const desiredIndexMap = new Map(
      desiredOrder.map((personId, personIndex) => [personId, personIndex]),
    );
    const clusterPartnerPairs = [];

    memberIds.forEach((personId) => {
      (partnerIdsByPerson.get(personId) ?? [])
        .filter((partnerId) => clusterMemberIds.has(partnerId) && personId < partnerId)
        .forEach((partnerId) => {
          clusterPartnerPairs.push([personId, partnerId]);
        });
    });

    function scoreOrder(order) {
      const orderIndexMap = new Map(order.map((personId, personIndex) => [personId, personIndex]));
      let score = 0;

      clusterPartnerPairs.forEach(([leftPersonId, rightPersonId]) => {
        const span = Math.abs(
          (orderIndexMap.get(leftPersonId) ?? 0) - (orderIndexMap.get(rightPersonId) ?? 0),
        );

        score += Math.max(0, span - 1) ** 2 * 16 + span * 0.25;
      });

      order.forEach((personId, personIndex) => {
        const desiredIndex = desiredIndexMap.get(personId) ?? personIndex;
        const preferredX = preferredXMap.get(personId);
        const anchorWeight =
          preferredX !== null && preferredX !== undefined ? 1.5 : 0.35;

        score += Math.abs(personIndex - desiredIndex) * anchorWeight;
      });

      return score;
    }

    let nextOrder = desiredOrder.slice();
    let improved = true;

    while (improved) {
      improved = false;

      for (let index = 0; index < nextOrder.length - 1; index += 1) {
        const swappedOrder = nextOrder.slice();
        const currentScore = scoreOrder(nextOrder);

        [swappedOrder[index], swappedOrder[index + 1]] = [
          swappedOrder[index + 1],
          swappedOrder[index],
        ];

        if (scoreOrder(swappedOrder) + 0.001 < currentScore) {
          nextOrder = swappedOrder;
          improved = true;
        }
      }
    }

    return nextOrder;
  }

  const minimumHeight =
    generations.length * cardHeight +
    Math.max(0, generations.length - 1) * verticalGap +
    paddingY * 2;

  generations.forEach((generation, generationIndex) => {
    const preferredXMap = getGenerationPreferredXMap(generation);
    let fallbackLeft = 0;
    const clusters = getGenerationPartnerClusters(generation)
      .map((clusterPersonIds) => {
        const orderedPersonIds = optimizeClusterMemberOrder(clusterPersonIds, preferredXMap);
        const preferredXs = orderedPersonIds
          .map((personId) => preferredXMap.get(personId))
          .filter((preferredX) => preferredX !== null && preferredX !== undefined);

        return {
          orderedPersonIds,
          preferredX: preferredXs.length
            ? preferredXs.reduce((totalX, preferredX) => totalX + preferredX, 0) / preferredXs.length
            : null,
          width: getClusterWidth(orderedPersonIds.length),
          sortPerson: peopleById.get(orderedPersonIds[0]),
        };
      })
      .sort((leftCluster, rightCluster) => {
        const leftHasPreferredX =
          leftCluster.preferredX !== null && leftCluster.preferredX !== undefined;
        const rightHasPreferredX =
          rightCluster.preferredX !== null && rightCluster.preferredX !== undefined;

        if (leftHasPreferredX && rightHasPreferredX && leftCluster.preferredX !== rightCluster.preferredX) {
          return leftCluster.preferredX - rightCluster.preferredX;
        }

        if (leftHasPreferredX !== rightHasPreferredX) {
          return leftHasPreferredX ? -1 : 1;
        }

        return compareFamilyPeopleForLayout(leftCluster.sortPerson, rightCluster.sortPerson);
      });
    const clustersWithDesiredLeft = [];

    for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
      const cluster = clusters[clusterIndex];

      if (cluster.preferredX === null || cluster.preferredX === undefined) {
        clustersWithDesiredLeft.push({
          ...cluster,
          desiredLeft: fallbackLeft,
        });
        fallbackLeft += cluster.width + branchGap;
        continue;
      }

      const anchorClusterGroup = [cluster];
      let groupedWidth = cluster.width;
      let nextClusterIndex = clusterIndex + 1;

      while (nextClusterIndex < clusters.length) {
        const nextCluster = clusters[nextClusterIndex];

        if (
          nextCluster.preferredX === null ||
          nextCluster.preferredX === undefined ||
          Math.abs(nextCluster.preferredX - cluster.preferredX) > 1
        ) {
          break;
        }

        anchorClusterGroup.push(nextCluster);
        groupedWidth += nextCluster.width + branchGap;
        nextClusterIndex += 1;
      }

      let groupLeft = cluster.preferredX - groupedWidth / 2;

      anchorClusterGroup.forEach((groupCluster) => {
        clustersWithDesiredLeft.push({
          ...groupCluster,
          desiredLeft: groupLeft,
        });
        groupLeft += groupCluster.width + branchGap;
      });

      clusterIndex = nextClusterIndex - 1;
    }

    let nextLeft = null;
    const y = paddingY + generationIndex * (cardHeight + verticalGap) + cardHeight / 2;

    clustersWithDesiredLeft.forEach((cluster) => {
      const clusterLeft =
        nextLeft === null ? cluster.desiredLeft : Math.max(cluster.desiredLeft, nextLeft);

      cluster.orderedPersonIds.forEach((personId, memberIndex) => {
        personPositions.set(personId, {
          x: clusterLeft + cardWidth / 2 + memberIndex * (cardWidth + horizontalGap),
          y,
          person: peopleById.get(personId),
          generationIndex,
        });
      });

      nextLeft = clusterLeft + cluster.width + branchGap;
    });
  });

  people.forEach((person) => {
    const currentPosition = personPositions.get(person.id);

    if (!currentPosition) {
      return;
    }

    if (person.graphX === null && person.graphY === null) {
      return;
    }

    personPositions.set(person.id, {
      ...currentPosition,
      x: person.graphX ?? currentPosition.x,
      y: person.graphY ?? currentPosition.y,
    });
  });

  const positionedNodes = Array.from(personPositions.values());
  const minCardLeft = positionedNodes.length
    ? Math.min(...positionedNodes.map((position) => position.x - cardWidth / 2))
    : paddingX;
  const maxCardRight = positionedNodes.length
    ? Math.max(...positionedNodes.map((position) => position.x + cardWidth / 2))
    : paddingX + cardWidth;
  const minCardTop = positionedNodes.length
    ? Math.min(...positionedNodes.map((position) => position.y - cardHeight / 2))
    : paddingY;
  const maxCardBottom = positionedNodes.length
    ? Math.max(...positionedNodes.map((position) => position.y + cardHeight / 2))
    : paddingY + cardHeight;
  const xShift = paddingX - minCardLeft;
  const yShift = paddingY - minCardTop;

  if (xShift !== 0 || yShift !== 0) {
    personPositions.forEach((position, personId) => {
      personPositions.set(personId, {
        ...position,
        x: position.x + xShift,
        y: position.y + yShift,
      });
    });
  }

  const width = Math.max(cardWidth + paddingX * 2, maxCardRight - minCardLeft + paddingX * 2);
  const height = Math.max(minimumHeight, maxCardBottom - minCardTop + paddingY * 2);

  const nodes = people
    .map((person) => personPositions.get(person.id))
    .filter(Boolean);

  const links = people.flatMap((person) => {
    const childPosition = personPositions.get(person.id);

    if (!childPosition) {
      return [];
    }

    const parentBoxes = getFamilyParentIds(person, family)
      .map((parentId) => {
        const parentPosition = personPositions.get(parentId);

        if (!parentPosition) {
          return null;
        }

        return {
          id: parentId,
          centerX: parentPosition.x,
          centerY: parentPosition.y,
          leftX: parentPosition.x - cardWidth / 2,
          rightX: parentPosition.x + cardWidth / 2,
          bottomY: parentPosition.y + cardHeight / 2,
        };
      })
      .filter(Boolean);

    return getFamilyChildConnectorLinks(
      person,
      family,
      peopleById,
      parentBoxes,
      childPosition.x,
      childPosition.y - cardHeight / 2,
    );
  });

  return {
    width,
    height,
    nodes,
    links,
  };
}

function buildFamilyTreeLayout(family) {
  if (isFamilySingleParentMode(family)) {
    return buildSingleParentFamilyTreeLayout(family);
  }

  return buildPartnerGraphFamilyLayout(family);
}

function getFamilyLayoutParentId(person, family) {
  if (isFamilySingleParentMode(family)) {
    return getFamilyPrimaryParentId(person, family);
  }

  if (person?.motherId) {
    return person.motherId;
  }

  if (person?.fatherId) {
    return person.fatherId;
  }

  return null;
}

function formatFamilyPersonName(person) {
  const fullName = `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim();
  return fullName || 'Unnamed person';
}

function formatFamilyPersonTileMeta(person) {
  const birthLabel = formatFamilyCardYear(person, 'birth') || 'Unknown';

  if (!person?.isDeceased) {
    return `${birthLabel} -`;
  }

  const deathLabel = formatFamilyCardYear(person, 'death') || 'Unknown';
  return `${birthLabel} - ${deathLabel}`;
}

function formatFamilyCardYear(person, type) {
  const year = type === 'birth' ? person?.birthYear : person?.deathYear;
  return year ? formatTimelineYear(year) : '';
}

function formatFamilyDateSummary(person, type) {
  const isBirth = type === 'birth';
  const month = isBirth ? person.birthMonth : person.deathMonth;
  const day = isBirth ? person.birthDay : person.deathDay;
  const year = isBirth ? person.birthYear : person.deathYear;
  const yearLabel = year ? formatTimelineYear(year) : '';

  if (!month && !day && !year) {
    return '';
  }

  if (month && day && year) {
    return `${TIMELINE_MONTHS[month - 1]} ${day}, ${yearLabel}`;
  }

  if (month && year) {
    return `${TIMELINE_MONTHS[month - 1]}, ${yearLabel}`;
  }

  if (month && day) {
    return `${TIMELINE_MONTHS[month - 1]} ${day}`;
  }

  if (year) {
    return yearLabel;
  }

  return month ? TIMELINE_MONTHS[month - 1] : '';
}

function getFamilyElapsedYears(startDate, endDate) {
  if (!startDate?.year || !endDate?.year) {
    return null;
  }

  let elapsedYears = getTimelineYearIndex(endDate.year) - getTimelineYearIndex(startDate.year);

  if (elapsedYears < 0) {
    return null;
  }

  const startMonth = sanitizeTimelineMonth(startDate.month);
  const endMonth = sanitizeTimelineMonth(endDate.month);
  const startDay = startMonth ? sanitizeTimelineDay(startDate.day, startMonth) : null;
  const endDay = endMonth ? sanitizeTimelineDay(endDate.day, endMonth) : null;

  if (startMonth && endMonth) {
    if (endMonth < startMonth) {
      elapsedYears -= 1;
    } else if (endMonth === startMonth && startDay && endDay && endDay < startDay) {
      elapsedYears -= 1;
    }
  }

  return elapsedYears >= 0 ? elapsedYears : null;
}

function formatFamilyPersonAge(person, currentDate = new Date()) {
  if (!person?.birthYear) {
    return 'Unknown';
  }

  if (person.isDeceased) {
    const ageAtDeath = getFamilyElapsedYears(
      {
        year: person.birthYear,
        month: person.birthMonth,
        day: person.birthDay,
      },
      {
        year: person.deathYear,
        month: person.deathMonth,
        day: person.deathDay,
      },
    );

    return ageAtDeath === null ? 'Unknown' : String(ageAtDeath);
  }

  const currentAge = getFamilyElapsedYears(
    {
      year: person.birthYear,
      month: person.birthMonth,
      day: person.birthDay,
    },
    {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      day: currentDate.getDate(),
    },
  );

  return currentAge === null ? 'Unknown' : String(currentAge);
}

function formatGenderLabel(gender) {
  if (gender === 'male') {
    return 'Male';
  }

  if (gender === 'female') {
    return 'Female';
  }

  return 'Other';
}

function findFamilyPersonSuggestions(query, people, selectedPersonId) {
  const normalizedQuery = query.trim().toUpperCase();
  const compactQuery = normalizedQuery.replace(/\s+/g, '');

  if (!normalizedQuery) {
    return [];
  }

  return people
    .filter((person) => person.id !== selectedPersonId)
    .map((person) => {
      const fullName = formatFamilyPersonName(person);
      const normalizedName = fullName.toUpperCase();
      const compactName = normalizedName.replace(/\s+/g, '');
      const place = person.birthPlace?.trim() ?? '';
      const normalizedPlace = place.toUpperCase();
      const birthYear = person.birthYear ? String(person.birthYear) : '';

      if (
        !normalizedName.includes(normalizedQuery) &&
        !compactName.includes(compactQuery) &&
        !normalizedPlace.includes(normalizedQuery) &&
        !birthYear.includes(normalizedQuery)
      ) {
        return null;
      }

      return {
        id: person.id,
        person,
        meta: formatFamilyPersonTileMeta(person),
      };
    })
    .filter(Boolean)
    .sort((leftSuggestion, rightSuggestion) =>
      formatFamilyPersonName(leftSuggestion.person).localeCompare(
        formatFamilyPersonName(rightSuggestion.person),
      ),
    )
    .slice(0, 8);
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTimelineEntries(entries, fallbackEntries = defaultTimelineHighlights) {
  return entries.map((entry, index) => {
    const fallbackEntry = fallbackEntries[index] ?? fallbackEntries[fallbackEntries.length - 1];

    return {
      year: getTimelineEntryYear(entry, index, fallbackEntry),
      month: getTimelineEntryMonth(entry),
      day: getTimelineEntryDay(entry),
      title: entry.title ?? fallbackEntry?.title ?? `Entry ${index + 1}`,
      description:
        entry.description ??
        fallbackEntry?.description ??
        'Describe the importance of this point in the universe timeline.',
    };
  });
}

function groupTimelineEntries(entries) {
  const groupedEntries = [];

  entries
    .slice()
    .map((entry, index) => ({
      ...entry,
      submissionIndex: index,
    }))
    .sort((leftEntry, rightEntry) => {
      const yearDiff =
        getTimelineYearIndex(leftEntry.year) - getTimelineYearIndex(rightEntry.year);

      if (yearDiff !== 0) {
        return yearDiff;
      }

      return leftEntry.submissionIndex - rightEntry.submissionIndex;
    })
    .forEach((entry) => {
      const existingGroup = groupedEntries[groupedEntries.length - 1];

      if (existingGroup?.year === entry.year) {
        existingGroup.entries.push(entry);
        return;
      }

      groupedEntries.push({
        year: entry.year,
        entries: [entry],
      });
    });

  return groupedEntries.map((group) => ({
    ...group,
    entries: sortTimelineEntriesForYear(group.entries),
  }));
}

function isLegacyTimelineSample(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return true;
  }

  if (entries.length !== LEGACY_TIMELINE_TITLES.length) {
    return false;
  }

  return entries.every((entry, index) => entry?.title === LEGACY_TIMELINE_TITLES[index]);
}

function clampZoom(value, min = 0.6, max = 2.2) {
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

function sanitizeTimelineYear(value, index, fallbackEntry) {
  const numericYear = Number.parseInt(value, 10);

  if (Number.isNaN(numericYear) || numericYear < 1) {
    return getTimelineYearNumber(getTimelineEntryYear(fallbackEntry, index));
  }

  return numericYear;
}

function sanitizeTimelineMonth(value) {
  const numericMonth = Number.parseInt(value, 10);

  if (Number.isNaN(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    return null;
  }

  return numericMonth;
}

function sanitizeTimelineDay(value, month) {
  const numericDay = Number.parseInt(value, 10);
  const normalizedMonth = sanitizeTimelineMonth(month);

  if (Number.isNaN(numericDay) || !normalizedMonth) {
    return null;
  }

  return Math.min(getTimelineDaysInMonth(normalizedMonth), Math.max(1, numericDay));
}

function getTimelineDaysInMonth(month) {
  const normalizedMonth = sanitizeTimelineMonth(month) ?? 1;
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][normalizedMonth - 1];
}

function getTimelineEntryYear(entry, index, fallbackEntry = defaultTimelineHighlights[index]) {
  const numericYear = parseHistoricalYearValue(entry?.year);

  if (!Number.isNaN(numericYear)) {
    return numericYear;
  }

  const fallbackYear = parseHistoricalYearValue(fallbackEntry?.year);

  if (!Number.isNaN(fallbackYear)) {
    return fallbackYear;
  }

  return 1600 + index * 3;
}

function getTimelineEntryMonth(entry) {
  return sanitizeTimelineMonth(entry?.month);
}

function getTimelineEntryDay(entry) {
  return sanitizeTimelineDay(entry?.day, entry?.month);
}

function getNextTimelineYear(entries) {
  const maxTimelineIndex = Math.max(
    ...entries.map((entry, index) => getTimelineYearIndex(getTimelineEntryYear(entry, index))),
    getTimelineYearIndex(1599),
  );

  return getTimelineYearFromIndex(maxTimelineIndex + 1);
}

function parseHistoricalYearValue(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value !== 0) {
    return value;
  }

  if (typeof value !== 'string') {
    return Number.NaN;
  }

  const normalizedValue = value.trim().toUpperCase();

  if (!normalizedValue) {
    return Number.NaN;
  }

  const historicalMatch = normalizedValue.match(/^(\d+)\s*(BCE|BC|CE|AD)$/);

  if (historicalMatch) {
    const [, yearNumber, era] = historicalMatch;
    return buildHistoricalYear(Number.parseInt(yearNumber, 10), era.startsWith('B') ? 'BCE' : 'CE');
  }

  const numericYear = Number.parseInt(normalizedValue, 10);

  if (!Number.isNaN(numericYear) && numericYear !== 0) {
    return numericYear;
  }

  return Number.NaN;
}

function buildHistoricalYear(yearNumber, era) {
  const normalizedYearNumber = Math.max(1, Number.parseInt(yearNumber, 10) || 1);
  return era === 'BCE' ? -normalizedYearNumber : normalizedYearNumber;
}

function getTimelineYearEra(year) {
  return year < 0 ? 'BCE' : 'CE';
}

function getTimelineYearNumber(year) {
  return Math.max(1, Math.abs(year));
}

function getTimelineYearIndex(year) {
  return year > 0 ? year - 1 : year;
}

function getTimelineYearFromIndex(index) {
  return index >= 0 ? index + 1 : index;
}

function formatTimelineYear(year) {
  return `${getTimelineYearNumber(year)} ${getTimelineYearEra(year)}`;
}

function formatTimelineYearRange(startYear, endYear) {
  if (startYear === endYear) {
    return formatTimelineYear(startYear);
  }

  const startEra = getTimelineYearEra(startYear);
  const endEra = getTimelineYearEra(endYear);

  if (startEra === endEra) {
    return `${getTimelineYearNumber(startYear)}-${getTimelineYearNumber(endYear)} ${startEra}`;
  }

  return `${formatTimelineYear(startYear)}-${formatTimelineYear(endYear)}`;
}

function hasTimelineExactDate(entry) {
  return getTimelineEntryMonth(entry) !== null && getTimelineEntryDay(entry) !== null;
}

function hasTimelinePartialDate(entry) {
  return getTimelineEntryMonth(entry) !== null;
}

function formatTimelineEntryDate(entry, options = {}) {
  const { includeYear = true } = options;
  const month = getTimelineEntryMonth(entry);
  const day = getTimelineEntryDay(entry);
  const parsedYear = parseHistoricalYearValue(entry?.year);
  const yearLabel = formatTimelineYear(Number.isNaN(parsedYear) ? 1 : parsedYear);

  if (month !== null && day !== null) {
    return includeYear
      ? `${TIMELINE_MONTHS[month - 1]} ${day}, ${yearLabel}`
      : `${TIMELINE_MONTHS[month - 1]} ${day}`;
  }

  if (month !== null) {
    return includeYear ? `${TIMELINE_MONTHS[month - 1]}, ${yearLabel}` : TIMELINE_MONTHS[month - 1];
  }

  return yearLabel;
}

function compareTimelineEntriesWithinYear(leftEntry, rightEntry) {
  if (hasTimelineExactDate(leftEntry) && hasTimelineExactDate(rightEntry)) {
    const monthDiff = getTimelineEntryMonth(leftEntry) - getTimelineEntryMonth(rightEntry);

    if (monthDiff !== 0) {
      return monthDiff;
    }

    const dayDiff = getTimelineEntryDay(leftEntry) - getTimelineEntryDay(rightEntry);

    if (dayDiff !== 0) {
      return dayDiff;
    }
  }

  return leftEntry.submissionIndex - rightEntry.submissionIndex;
}

function sortTimelineEntriesForYear(entries) {
  return entries.slice().sort(compareTimelineEntriesWithinYear);
}

function normalizeJumpSearchQuery(query) {
  return query.trim().toUpperCase();
}

function findTimelineYearSuggestions(query, groupedTimelineEntries) {
  const normalizedQuery = normalizeJumpSearchQuery(query);
  const compactQuery = normalizedQuery.replace(/\s+/g, '');

  if (!normalizedQuery) {
    return [];
  }

  return groupedTimelineEntries
    .flatMap((group) => {
      const yearLabel = formatTimelineYear(group.year);
      const normalizedYearLabel = yearLabel.toUpperCase();
      const compactYearLabel = normalizedYearLabel.replace(/\s+/g, '');
      const yearNumber = String(getTimelineYearNumber(group.year));

      return group.entries
        .map((entry, entryIndex) => {
          const title = entry.title?.trim() || 'Untitled Event';
          const normalizedTitle = title.toUpperCase();
          const compactTitle = normalizedTitle.replace(/\s+/g, '');
          const combinedLabel = `${title} - ${yearLabel}`;
          const combinedSearchLabel = `${normalizedTitle} ${normalizedYearLabel}`;
          const compactCombinedLabel = combinedSearchLabel.replace(/\s+/g, '');

          const titleStartsWith =
            normalizedTitle.startsWith(normalizedQuery) || compactTitle.startsWith(compactQuery);
          const yearStartsWith =
            yearNumber.startsWith(normalizedQuery) ||
            normalizedYearLabel.startsWith(normalizedQuery) ||
            compactYearLabel.startsWith(compactQuery);
          const titleIncludes =
            normalizedTitle.includes(normalizedQuery) || compactTitle.includes(compactQuery);
          const combinedIncludes =
            combinedSearchLabel.includes(normalizedQuery) ||
            compactCombinedLabel.includes(compactQuery);

          if (!titleStartsWith && !yearStartsWith && !titleIncludes && !combinedIncludes) {
            return null;
          }

          return {
            id: `${group.year}-${entryIndex}-${title}`,
            year: group.year,
            title,
            yearLabel,
            combinedLabel,
            rank: titleStartsWith ? 0 : yearStartsWith ? 1 : titleIncludes ? 2 : 3,
          };
        })
        .filter(Boolean);
    })
    .sort((leftSuggestion, rightSuggestion) => {
      if (leftSuggestion.rank !== rightSuggestion.rank) {
        return leftSuggestion.rank - rightSuggestion.rank;
      }

      if (leftSuggestion.year !== rightSuggestion.year) {
        return getTimelineYearIndex(leftSuggestion.year) - getTimelineYearIndex(rightSuggestion.year);
      }

      return leftSuggestion.title.localeCompare(rightSuggestion.title);
    });
}

function findTimelineYearMatch(query, groupedTimelineEntries) {
  const normalizedQuery = normalizeJumpSearchQuery(query);
  const compactQuery = normalizedQuery.replace(/\s+/g, '');

  if (!normalizedQuery) {
    return null;
  }

  const exactLabelMatch = groupedTimelineEntries.find(
    (group) => formatTimelineYear(group.year).toUpperCase() === normalizedQuery,
  );

  if (exactLabelMatch) {
    return exactLabelMatch.year;
  }

  const parsedYear = parseHistoricalYearValue(normalizedQuery);

  if (!Number.isNaN(parsedYear)) {
    const exactParsedMatch = groupedTimelineEntries.find((group) => group.year === parsedYear);

    if (exactParsedMatch) {
      return exactParsedMatch.year;
    }
  }

  const suggestions = findTimelineYearSuggestions(query, groupedTimelineEntries);
  const exactSuggestionMatches = suggestions.filter(({ title, combinedLabel }) => {
    const normalizedTitle = title.toUpperCase();
    const normalizedCombinedLabel = combinedLabel.toUpperCase();

    return (
      normalizedTitle === normalizedQuery ||
      normalizedTitle.replace(/\s+/g, '') === compactQuery ||
      normalizedCombinedLabel === normalizedQuery ||
      normalizedCombinedLabel.replace(/\s+/g, '') === compactQuery
    );
  });

  if (exactSuggestionMatches.length === 1) {
    return exactSuggestionMatches[0].year;
  }

  return suggestions.length === 1 ? suggestions[0].year : null;
}

function hexToRgba(hex, alpha) {
  const sanitizedHex = hex.replace('#', '');
  const fullHex =
    sanitizedHex.length === 3
      ? sanitizedHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : sanitizedHex;

  const numericValue = Number.parseInt(fullHex, 16);
  const red = (numericValue >> 16) & 255;
  const green = (numericValue >> 8) & 255;
  const blue = numericValue & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default App;
