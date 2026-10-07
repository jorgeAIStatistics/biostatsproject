import { useEffect, useMemo, useState, Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router';
import clsx from 'clsx';
import {
  Search,
  Moon,
  Sun,
  Monitor,
  Menu,
  PanelLeft,
  Bookmark,
  BookmarkCheck,
  NotebookPen,
  ChevronRight,
  ChevronDown,
  Keyboard,
} from 'lucide-react';
import { NAV } from './nav';
import { usePageMeta } from './page';
import { useSettings, applyTheme } from '../../state/settings';
import { useProgress } from '../../state/progress';
import { Dialog, IconButton, Kbd, Loading, Toaster, toast } from '../ui';
import { CommandPalette } from './CommandPalette';
import { NotesDrawer } from './NotesDrawer';
import './layout.css';

function useDueReviews() {
  const reviews = useProgress((s) => s.reviews);
  const later = useProgress((s) => s.reviewLater);
  return useMemo(() => {
    const now = Date.now();
    const due = Object.entries(reviews).filter(([, r]) => r.due <= now && r.lastResult < 1).length;
    return due + Object.keys(later).length;
  }, [reviews, later]);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const due = useDueReviews();
  const navCollapsed = useSettings((s) => s.navCollapsed);
  const setSettings = useSettings((s) => s.set);

  const toggleGroup = (label: string) =>
    setSettings({
      navCollapsed: navCollapsed.includes(label) ? navCollapsed.filter((l) => l !== label) : [...navCollapsed, label],
    });

  const renderItem = (item: (typeof NAV)[number]['items'][number]) => {
    const active = item.prefix ? location.pathname.startsWith(item.prefix) : location.pathname === item.to;
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={clsx('sidebar__item', active && 'is-active')}
        aria-current={active ? 'page' : undefined}
        onClick={onNavigate}
      >
        <Icon className="sidebar__icon" />
        <span className="grow">{item.label}</span>
        {item.badge === 'review' && due > 0 && (
          <span className="sidebar__count num" aria-label={`${due} due for review`}>
            {due}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <Link to="/" className="sidebar__brand" onClick={onNavigate}>
        <span className="sidebar__logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="27" height="27">
            <rect width="32" height="32" rx="8" fill="var(--accent)" />
            <path
              d="M6.5 21.2h3.1l2.2-6.6 3.3 10.4 3.1-14.2 2.3 10.4h4.9"
              fill="none"
              stroke="#fff"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="sidebar__brand-text">
          <span className="sidebar__brand-name">Clinical Biometrics</span>
          <span className="sidebar__brand-sub">Mastery OS</span>
        </span>
      </Link>
      <div className="sidebar__scroll">
        {NAV.map((group, gi) => {
          // Groups are foldable so a daily user can quiet the sections they are
          // not working in. The group holding the current route never folds, so
          // a collapsed group can never hide where you actually are.
          const hasActive = group.items.some((i) =>
            i.prefix ? location.pathname.startsWith(i.prefix) : location.pathname === i.to,
          );
          const foldable = !!group.label && group.collapsible !== false;
          const open = !foldable || hasActive || !navCollapsed.includes(group.label!);
          return (
            <div key={gi} className="sidebar__group">
              {group.label &&
                (foldable ? (
                  <button
                    type="button"
                    className="sidebar__label sidebar__group-toggle"
                    aria-expanded={open}
                    onClick={() => toggleGroup(group.label!)}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className="sidebar__chevron" aria-hidden="true" />
                  </button>
                ) : (
                  <div className="sidebar__label">{group.label}</div>
                ))}
              {open && group.items.map(renderItem)}
            </div>
          );
        })}
      </div>
      <div className="sidebar__foot">
        <span className="sidebar__foot-dot" aria-hidden="true" />
        <span>Synthetic data · educational use</span>
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  const label = theme === 'light' ? 'Light theme' : theme === 'dark' ? 'Dark theme' : 'System theme';
  return (
    <IconButton label={`${label} — switch to ${next}`} onClick={() => set({ theme: next })}>
      {theme === 'light' ? <Sun /> : theme === 'dark' ? <Moon /> : <Monitor />}
    </IconButton>
  );
}

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Command palette & search'],
  [['/'], 'Search'],
  [['g', 'd'], 'Go to dashboard'],
  [['g', 'p'], 'Go to learning path'],
  [['g', 'r'], 'Go to review queue'],
  [['g', 'i'], 'Go to interview center'],
  [['g', 's'], 'Go to SQL workbench'],
  [['b'], 'Bookmark this page'],
  [['n'], 'Open notes for this page'],
  [['t'], 'Toggle light/dark theme'],
  [['['], 'Previous lesson (on a lesson page)'],
  [[']'], 'Next lesson (on a lesson page)'],
  [['?'], 'Show keyboard shortcuts'],
];

export function AppShell() {
  const theme = useSettings((s) => s.theme);
  const setSettings = useSettings((s) => s.set);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const { title, crumbs, kind } = usePageMeta();
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const path = location.pathname + location.search;
  const bookmarked = useProgress((s) => !!s.bookmarks[path]);
  const toggleBookmark = useProgress((s) => s.toggleBookmark);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme]);

  useEffect(() => {
    setMobileNav(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  // Global keyboard shortcuts.
  useEffect(() => {
    let pendingG = false;
    let gTimer = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable || target.closest('.cm-editor'));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (pendingG) {
        pendingG = false;
        window.clearTimeout(gTimer);
        const map: Record<string, string> = { d: '/', p: '/path', r: '/review', i: '/interview', s: '/sql', l: '/reference', c: '/crosswalk', t: '/trial' };
        if (map[e.key]) {
          e.preventDefault();
          navigate(map[e.key]);
        }
        return;
      }
      switch (e.key) {
        case '/':
          e.preventDefault();
          setPaletteOpen(true);
          break;
        case 'g':
          pendingG = true;
          gTimer = window.setTimeout(() => (pendingG = false), 900);
          break;
        case 'b':
          if (title) {
            toggleBookmark({ path, title, kind });
            toast(bookmarked ? 'Bookmark removed' : 'Bookmarked', 'info');
          }
          break;
        case 'n':
          setNotesOpen(true);
          break;
        case 't': {
          const dark = document.documentElement.dataset.theme === 'dark';
          setSettings({ theme: dark ? 'light' : 'dark' });
          break;
        }
        case '?':
          setHelpOpen(true);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(gTimer);
    };
  }, [navigate, title, path, kind, bookmarked, toggleBookmark, setSettings]);

  return (
    <div className={clsx('shell', collapsed && 'shell--collapsed')}>
      <aside className="shell__sidebar">
        <Sidebar />
      </aside>
      {mobileNav && (
        <>
          <div className="overlay" onClick={() => setMobileNav(false)} />
          <aside className="shell__mobile-nav">
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </aside>
        </>
      )}
      <div className="shell__main">
        <header className="topbar">
          <IconButton label="Open navigation" className="topbar__menu" onClick={() => setMobileNav(true)}>
            <Menu />
          </IconButton>
          <IconButton label={collapsed ? 'Show sidebar' : 'Hide sidebar'} className="topbar__collapse" onClick={() => setSettings({ sidebarCollapsed: !collapsed })}>
            <PanelLeft />
          </IconButton>
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} className="crumbs__item">
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
                <ChevronRight className="crumbs__sep" />
              </span>
            ))}
            <span className="crumbs__current">{title}</span>
          </nav>
          <span className="grow" />
          <button type="button" className="topbar__search" onClick={() => setPaletteOpen(true)}>
            <Search />
            <span>Search lessons, datasets, reference…</span>
            <span className="topbar__kbd">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <IconButton
            label={bookmarked ? 'Remove bookmark (b)' : 'Bookmark this page (b)'}
            pressed={bookmarked}
            onClick={() => title && toggleBookmark({ path, title, kind })}
          >
            {bookmarked ? <BookmarkCheck /> : <Bookmark />}
          </IconButton>
          <IconButton label="Notes for this page (n)" onClick={() => setNotesOpen(true)}>
            <NotebookPen />
          </IconButton>
          <IconButton label="Keyboard shortcuts (?)" onClick={() => setHelpOpen(true)} className="topbar__help">
            <Keyboard />
          </IconButton>
          <ThemeToggle />
        </header>
        <main className="shell__content" id="main">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotesDrawer open={notesOpen} onClose={() => setNotesOpen(false)} context={path} title={title} />
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts" width={480}>
        <div className="dialog__body">
          <table className="shortcut-table">
            <tbody>
              {SHORTCUTS.map(([keys, desc]) => (
                <tr key={desc}>
                  <td>
                    <span className="row gap-1">
                      {keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
      <Toaster />
    </div>
  );
}
