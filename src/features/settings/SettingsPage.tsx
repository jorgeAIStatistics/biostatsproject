import { usePage } from '../../components/layout/page';
import { useSettings, type ThemePref } from '../../state/settings';
import { useProgress } from '../../state/progress';
import { Button, Card, CardHeader, Field, Segmented, toast } from '../../components/ui';
import { TRACKS } from '../../content/labs';
import { PYODIDE_VERSION } from '../../lib/pyodide';
import type { TrackId } from '../../content/vocab';

export default function SettingsPage() {
  usePage('Settings');
  const s = useSettings();
  const reset = useProgress((st) => st.reset);
  const toggleFocus = (t: TrackId) => {
    const has = s.focus.includes(t);
    const next = has ? s.focus.filter((x) => x !== t) : [...s.focus, t];
    if (next.length) s.set({ focus: next });
  };
  return (
    <div className="page page--narrow">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-lede">Preferences are stored in this browser only.</p>
      </div>
      <div className="stack gap-4">
        <Card>
          <CardHeader title="Study plan" subtitle="Drives the weekly plan and recommendations" />
          <div className="card__body stack gap-4">
            <div className="grid grid-2">
              <Field label="Hours per week" hint="5–8 hours is the design target">
                <input className="input" type="number" min={2} max={20} value={s.hoursPerWeek} onChange={(e) => s.set({ hoursPerWeek: Math.max(2, Math.min(20, Number(e.target.value) || 6)) })} />
              </Field>
              <Field label="Programme start date" hint="Week 1 of your plan">
                <input className="input" type="date" value={s.startDate} onChange={(e) => e.target.value && s.set({ startDate: e.target.value })} />
              </Field>
            </div>
            <div className="field">
              <span className="field__label">Career focus (recommendations favour these tracks)</span>
              <div className="stack gap-2">
                {TRACKS.map((t) => (
                  <label key={t.id} className="checkbox">
                    <input type="checkbox" checked={s.focus.includes(t.id)} onChange={() => toggleFocus(t.id)} />
                    <span>
                      <b style={{ fontWeight: 600 }}>{t.title}</b> <span className="muted">— {t.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Appearance" />
          <div className="card__body stack gap-4">
            <Field label="Theme">
              <Segmented<ThemePref>
                value={s.theme}
                onChange={(v) => s.set({ theme: v })}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                ]}
              />
            </Field>
            <label className="checkbox">
              <input type="checkbox" checked={s.denseTables} onChange={(e) => s.set({ denseTables: e.target.checked })} />
              Compact data tables
            </label>
            <Field label="Preferred language tab in code examples">
              <Segmented
                value={s.codeTab}
                onChange={(v) => s.set({ codeTab: v })}
                options={['SAS', 'R', 'Python', 'SQL'].map((x) => ({ value: x, label: x }))}
              />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="In-browser Python" subtitle={`Pyodide ${PYODIDE_VERSION} from the jsDelivr CDN`} />
          <div className="card__body stack gap-3">
            <p className="subtle" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              Some Python exercises can run directly in your browser with Pyodide (CPython compiled to WebAssembly, with pandas, NumPy and SciPy). The first run
              downloads roughly 25 MB and needs an internet connection; everything else in the app works offline. Every Python exercise also has a local
              <code> .py</code> companion in the repository.
            </p>
            <label className="checkbox">
              <input type="checkbox" checked={s.allowPyodide} onChange={(e) => s.set({ allowPyodide: e.target.checked })} />
              Allow in-browser Python
            </label>
          </div>
        </Card>
        <Card>
          <CardHeader title="Danger zone" />
          <div className="card__body stack gap-3">
            <p className="subtle" style={{ fontSize: 13.5 }}>Export your progress from the Progress page before resetting.</p>
            <div>
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm('Reset all progress, notes and bookmarks on this device? This cannot be undone.')) {
                    reset();
                    toast('Progress reset', 'info');
                  }
                }}
              >
                Reset all progress
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
