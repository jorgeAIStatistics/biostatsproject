import { useEffect } from 'react';
import { create } from 'zustand';
import { useLocation } from 'react-router';
import { useProgress } from '../../state/progress';

export interface Crumb {
  label: string;
  to?: string;
}

interface PageMetaState {
  title: string;
  crumbs: Crumb[];
  /** Kind used when bookmarking this page (lesson, dataset, document…). */
  kind: string;
  set: (m: { title: string; crumbs?: Crumb[]; kind?: string }) => void;
}

export const usePageMeta = create<PageMetaState>((set) => ({
  title: '',
  crumbs: [],
  kind: 'page',
  set: ({ title, crumbs = [], kind = 'page' }) => set({ title, crumbs, kind }),
}));

/** Registers the current page's title/breadcrumbs and records it in history. */
export function usePage(title: string, crumbs: Crumb[] = [], kind = 'page') {
  const set = usePageMeta((s) => s.set);
  const pushHistory = useProgress((s) => s.pushHistory);
  const location = useLocation();
  const crumbKey = crumbs.map((c) => c.label).join('|');
  useEffect(() => {
    set({ title, crumbs, kind });
    document.title = title ? `${title} · Clinical Biometrics Mastery OS` : 'Clinical Biometrics Mastery OS';
    if (title) pushHistory({ path: location.pathname + location.search, title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, crumbKey, kind, location.pathname, location.search]);
}
