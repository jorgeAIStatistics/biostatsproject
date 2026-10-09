import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TrackId } from '../content/schema';

export type ThemePref = 'light' | 'dark' | 'system';

export interface SettingsState {
  theme: ThemePref;
  /** Planned study time per week (hours). Drives the weekly plan. */
  hoursPerWeek: number;
  /** ISO date the learner started the programme (week 1). */
  startDate: string;
  /** Career focus: weights recommendations and readiness. */
  focus: TrackId[];
  /** Compact table density. */
  denseTables: boolean;
  /** In-browser Python (Pyodide) allowed to download on demand. */
  allowPyodide: boolean;
  sidebarCollapsed: boolean;
  /** Sidebar groups the learner has folded away, by group label. */
  navCollapsed: string[];
  onboarded: boolean;
  /** Preferred language tab in multi-language code blocks. */
  codeTab: string;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      // Light is the flagship theme, so a first-time visitor sees it regardless
      // of their OS setting. Anyone who picks a theme has that choice persisted,
      // and 'system' remains available from the toggle.
      theme: 'light',
      hoursPerWeek: 6,
      startDate: today(),
      focus: ['programmer', 'biostatistician'],
      denseTables: false,
      allowPyodide: false,
      sidebarCollapsed: false,
      navCollapsed: [],
      onboarded: false,
      codeTab: 'SAS',
      set: (patch) => set(patch),
    }),
    { name: 'cbmos:settings', version: 1 },
  ),
);

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePref) {
  document.documentElement.dataset.theme = resolveTheme(pref);
}
