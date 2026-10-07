/**
 * Learner progress. Everything is stored locally (localStorage) and can be
 * exported/imported as JSON from the Progress page. No backend.
 *
 * Mastery is computed from *attempts* (demonstrated performance), never from
 * reading alone — see src/lib/mastery.ts.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModeId } from '../content/schema';

export interface Attempt {
  itemId: string;
  /** epoch ms */
  ts: number;
  /** 0..1 — 1 = fully correct. Open (self-assessed) items: 1 / 0.5 / 0. */
  score: number;
  hintsUsed: number;
  /** Mode the item was attempted in. */
  mode: ModeId;
  /** Seconds spent (approximate). */
  seconds?: number;
  /** Solution was revealed before answering. */
  revealed?: boolean;
}

export interface LessonProgress {
  firstOpened: number;
  lastOpened: number;
  /** Learner marked the lesson as read. Reading alone never counts as mastery. */
  completedAt?: number;
  /** Approximate seconds spent on the page. */
  seconds: number;
}

/** Leitner-style spaced-repetition state per item. */
export interface ReviewState {
  box: number; // 0..5
  due: number; // epoch ms
  lastResult: number; // last score
  lapses: number;
}

export interface Note {
  text: string;
  updatedAt: number;
  /** Where the note belongs: lesson id, item id, dataset id, or "general". */
  context: string;
  title: string;
}

export interface Bookmark {
  path: string;
  title: string;
  kind: string;
  addedAt: number;
}

export interface HistoryEntry {
  path: string;
  title: string;
  ts: number;
}

/** Per-day activity, keyed by local date YYYY-MM-DD. */
export interface DayActivity {
  /** seconds of active study */
  s: number;
  /** attempts */
  a: number;
  /** lessons completed */
  l: number;
}

export function localDay(ts = Date.now()): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface ProgressState {
  attempts: Attempt[];
  activity: Record<string, DayActivity>;
  lessons: Record<string, LessonProgress>;
  reviews: Record<string, ReviewState>;
  /** Items the learner flagged "review later". */
  reviewLater: Record<string, number>;
  notes: Record<string, Note>;
  bookmarks: Record<string, Bookmark>;
  history: HistoryEntry[];
  /** Capstone / case step completion: `${projectId}:${stepId}` → ts */
  steps: Record<string, number>;
  /** Active capstone shown on the dashboard. */
  currentProject?: string;
  /** Code editor drafts keyed by item id. */
  drafts: Record<string, string>;

  recordAttempt: (a: Omit<Attempt, 'ts'> & { ts?: number }) => void;
  openLesson: (id: string) => void;
  addLessonTime: (id: string, seconds: number) => void;
  completeLesson: (id: string, done?: boolean) => void;
  toggleReviewLater: (itemId: string) => void;
  saveNote: (key: string, note: Omit<Note, 'updatedAt'>) => void;
  deleteNote: (key: string) => void;
  toggleBookmark: (b: Omit<Bookmark, 'addedAt'>) => void;
  pushHistory: (e: Omit<HistoryEntry, 'ts'>) => void;
  toggleStep: (key: string) => void;
  setCurrentProject: (id?: string) => void;
  saveDraft: (itemId: string, code: string) => void;
  clearDraft: (itemId: string) => void;
  importState: (data: Partial<ProgressState>) => void;
  reset: () => void;
}

const DAY = 86_400_000;
/** Review intervals (days) per Leitner box. Box 0 = relearn today. */
export const REVIEW_INTERVALS = [0, 1, 3, 7, 16, 35];

function nextReview(prev: ReviewState | undefined, score: number, now: number): ReviewState {
  const box = prev?.box ?? 0;
  if (score >= 0.8) {
    const nb = Math.min(REVIEW_INTERVALS.length - 1, box + 1);
    return { box: nb, due: now + REVIEW_INTERVALS[nb] * DAY, lastResult: score, lapses: prev?.lapses ?? 0 };
  }
  if (score >= 0.5) {
    return { box: Math.max(1, box), due: now + DAY, lastResult: score, lapses: prev?.lapses ?? 0 };
  }
  return { box: 0, due: now + DAY / 2, lastResult: score, lapses: (prev?.lapses ?? 0) + 1 };
}

const MAX_ATTEMPTS = 8000;
const MAX_HISTORY = 60;

function bump(activity: Record<string, DayActivity>, patch: Partial<DayActivity>, ts = Date.now()) {
  const key = localDay(ts);
  const prev = activity[key] ?? { s: 0, a: 0, l: 0 };
  return { ...activity, [key]: { s: prev.s + (patch.s ?? 0), a: prev.a + (patch.a ?? 0), l: prev.l + (patch.l ?? 0) } };
}

const empty = {
  attempts: [] as Attempt[],
  activity: {} as Record<string, DayActivity>,
  lessons: {},
  reviews: {},
  reviewLater: {},
  notes: {},
  bookmarks: {},
  history: [] as HistoryEntry[],
  steps: {},
  currentProject: undefined,
  drafts: {},
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...empty,

      recordAttempt: (a) => {
        const now = a.ts ?? Date.now();
        const attempt: Attempt = { ...a, ts: now };
        const attempts = [...get().attempts, attempt];
        if (attempts.length > MAX_ATTEMPTS) attempts.splice(0, attempts.length - MAX_ATTEMPTS);
        const reviews = { ...get().reviews, [a.itemId]: nextReview(get().reviews[a.itemId], a.score, now) };
        set({ attempts, reviews, activity: bump(get().activity, { a: 1, s: Math.min(a.seconds ?? 0, 1800) }, now) });
      },

      openLesson: (id) => {
        const now = Date.now();
        const prev = get().lessons[id];
        set({
          lessons: {
            ...get().lessons,
            [id]: { firstOpened: prev?.firstOpened ?? now, lastOpened: now, completedAt: prev?.completedAt, seconds: prev?.seconds ?? 0 },
          },
        });
      },

      addLessonTime: (id, seconds) => {
        const prev = get().lessons[id];
        if (!prev) return;
        set({
          lessons: { ...get().lessons, [id]: { ...prev, seconds: prev.seconds + seconds } },
          activity: bump(get().activity, { s: seconds }),
        });
      },

      completeLesson: (id, done = true) => {
        const now = Date.now();
        const prev = get().lessons[id] ?? { firstOpened: now, lastOpened: now, seconds: 0 };
        set({
          lessons: { ...get().lessons, [id]: { ...prev, completedAt: done ? now : undefined } },
          activity: done && !prev.completedAt ? bump(get().activity, { l: 1 }, now) : get().activity,
        });
      },

      toggleReviewLater: (itemId) => {
        const rl = { ...get().reviewLater };
        if (rl[itemId]) delete rl[itemId];
        else rl[itemId] = Date.now();
        set({ reviewLater: rl });
      },

      saveNote: (key, note) => set({ notes: { ...get().notes, [key]: { ...note, updatedAt: Date.now() } } }),

      deleteNote: (key) => {
        const notes = { ...get().notes };
        delete notes[key];
        set({ notes });
      },

      toggleBookmark: (b) => {
        const bm = { ...get().bookmarks };
        if (bm[b.path]) delete bm[b.path];
        else bm[b.path] = { ...b, addedAt: Date.now() };
        set({ bookmarks: bm });
      },

      pushHistory: (e) => {
        const hist = get().history.filter((h) => h.path !== e.path);
        hist.unshift({ ...e, ts: Date.now() });
        set({ history: hist.slice(0, MAX_HISTORY) });
      },

      toggleStep: (key) => {
        const steps = { ...get().steps };
        if (steps[key]) delete steps[key];
        else steps[key] = Date.now();
        set({ steps });
      },

      setCurrentProject: (id) => set({ currentProject: id }),

      saveDraft: (itemId, code) => set({ drafts: { ...get().drafts, [itemId]: code } }),

      clearDraft: (itemId) => {
        const drafts = { ...get().drafts };
        delete drafts[itemId];
        set({ drafts });
      },

      importState: (data) =>
        set({
          attempts: Array.isArray(data.attempts) ? data.attempts : get().attempts,
          activity: data.activity ?? get().activity,
          lessons: data.lessons ?? get().lessons,
          reviews: data.reviews ?? get().reviews,
          reviewLater: data.reviewLater ?? get().reviewLater,
          notes: data.notes ?? get().notes,
          bookmarks: data.bookmarks ?? get().bookmarks,
          history: data.history ?? get().history,
          steps: data.steps ?? get().steps,
          currentProject: data.currentProject ?? get().currentProject,
          drafts: data.drafts ?? get().drafts,
        }),

      reset: () => set({ ...empty }),
    }),
    { name: 'cbmos:progress', version: 1 },
  ),
);

export function exportProgress(): string {
  const s = useProgress.getState();
  const data = {
    app: 'clinical-biometrics-mastery-os',
    version: 1,
    exportedAt: new Date().toISOString(),
    attempts: s.attempts,
    activity: s.activity,
    lessons: s.lessons,
    reviews: s.reviews,
    reviewLater: s.reviewLater,
    notes: s.notes,
    bookmarks: s.bookmarks,
    history: s.history,
    steps: s.steps,
    currentProject: s.currentProject,
    drafts: s.drafts,
  };
  return JSON.stringify(data, null, 2);
}
