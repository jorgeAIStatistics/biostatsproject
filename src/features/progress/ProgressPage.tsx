import { useRef } from 'react';
import { Link } from 'react-router';
import { Download, Upload, Info } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useMastery } from '../../lib/useMastery';
import { LEVELS } from '../../lib/mastery';
import { DOMAINS } from '../../content/labs';
import { skills } from '../../content/registry';
import { Button, Card, CardHeader, ProgressBar, toast } from '../../components/ui';
import { MasteryMeter } from '../../components/progress/MasteryMeter';
import { exportProgress, useProgress } from '../../state/progress';
import { Markdown } from '../../components/content/Markdown';
import './progress.css';

const RULES = `
| Level | What it takes |
|---|---|
| **0 Not started** | Nothing opened or attempted for this skill. |
| **1 Learning** | A lesson for the skill was opened, or any exercise attempted. |
| **2 Practicing** | At least 3 distinct exercises answered correctly. |
| **3 Competent** | ≥ 5 distinct correct exercises, recent accuracy ≥ 70%, at least one *applied* exercise (code, SQL, calculation, mapping…) and — when the skill has any — a debug or QC exercise solved. |
| **4 Strong** | Competent, recent accuracy ≥ 80%, at least two intermediate-or-harder exercises solved with no hints and no reveal, and an explanation/interview question passed (when available). |
| **5 Mastered** | Strong, plus an advanced/expert, case-study or boss exercise (or a linked capstone step), **and** a correct answer at least 7 days after first demonstrating the skill. |
`;

export default function ProgressPage() {
  usePage('Progress & Skills');
  const mastery = useMastery();
  const importState = useProgress((s) => s.importState);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cbmos-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'clinical-biometrics-mastery-os') throw new Error('Not a progress export from this app.');
      importState(data);
      toast('Progress imported');
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'warning');
    }
  };

  const counts = [0, 0, 0, 0, 0, 0];
  for (const s of mastery.bySkill.values()) counts[s.level]++;

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">Competency map</div>
        <h1 className="page-title">Progress & skills</h1>
        <p className="page-lede">
          {skills.length} skills across {DOMAINS.length} competency domains. Levels move only with demonstrated performance — reading three lessons does not
          make you competent at joins; solving join exercises, debugging broken joins, explaining join behavior and applying joins in a project does.
        </p>
      </div>

      <div className="progress-top">
        <Card pad="md">
          <div className="level-summary">
            {LEVELS.map((l, i) => (
              <div key={l} className="level-summary__item">
                <span className="level-summary__count num">{counts[i]}</span>
                <span className="level-summary__label">
                  <span className="level-summary__swatch" style={{ background: `var(--mastery-${i})` }} />
                  {l}
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card pad="md">
          <div className="stack gap-3">
            <span className="card__title">Career readiness</span>
            {mastery.roles.map((r) => (
              <div key={r.id} className="stack gap-1">
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{r.title}</span>
                  <span className="num muted">{Math.round(r.readiness * 100)}%</span>
                </div>
                <ProgressBar value={r.readiness} thin />
              </div>
            ))}
          </div>
        </Card>
        <Card pad="md">
          <div className="stack gap-2">
            <span className="card__title">Your data</span>
            <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              Progress lives only in this browser. Export regularly (e.g., to your course folder) and import on another machine.
            </p>
            <div className="row gap-2 wrap">
              <Button size="sm" icon={<Download />} onClick={doExport}>
                Export JSON
              </Button>
              <Button size="sm" icon={<Upload />} onClick={() => fileRef.current?.click()}>
                Import
              </Button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <CardHeader title="How mastery is computed" icon={<Info size={15} />} subtitle="Transparent rules — no XP, no streak bonuses" />
        <div className="card__body">
          <Markdown source={RULES} compact />
        </div>
      </Card>

      <div className="domain-grid">
        {DOMAINS.map((d) => {
          const list = [...mastery.bySkill.values()].filter((s) => s.skill.domain === d.id).sort((a, b) => b.skill.weight - a.skill.weight);
          if (!list.length) return null;
          return (
            <Card key={d.id} id={d.id} className="domain-card">
              <div className="card__header">
                <div>
                  <div className="card__title">{d.title}</div>
                  <div className="card__subtitle">{list.length} skills</div>
                </div>
                <span className="num" style={{ fontWeight: 650 }}>
                  {Math.round((mastery.byDomain.get(d.id) ?? 0) * 100)}%
                </span>
              </div>
              <ul className="list-reset" style={{ padding: '6px 8px' }}>
                {list.map((s) => (
                  <li key={s.skill.id}>
                    <Link to={`/progress/skill/${s.skill.id}`} className="skill-row">
                      <span className="grow">
                        {s.skill.name}
                        {s.skill.weight === 3 && <span className="skill-row__core" title="Critical for employability"> ●</span>}
                      </span>
                      <MasteryMeter level={s.level} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
