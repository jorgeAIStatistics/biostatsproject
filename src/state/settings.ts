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
  onboarded: boolean;
  /** Preferred language tab in multi-language code blocks. */
  codeTab: string;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      hoursPerWeek: 6,
      startDate: today(),
      focus: ['programmer', 'biostatistician'],
      denseTables: false,
      allowPyodide: false,
      sidebarCollapsed: false,
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
