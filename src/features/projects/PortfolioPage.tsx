import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import JSZip from 'jszip';
import { Download, Copy, ShieldAlert, FolderGit2 } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { capstones, capstoneById, skillById } from '../../content/registry';
import { useProgress } from '../../state/progress';
import { Button, Card, EmptyState, toast } from '../../components/ui';
import { CodeBlock } from '../../components/code/CodeBlock';
import type { Capstone } from '../../content/schema';
import './projects.css';

const starterFiles = import.meta.glob<string>('/capstones/**/*.{md,sas,R,r,py,sql,txt,yaml,yml,csv,gitignore}', { query: '?raw', import: 'default' });

/** Phrases that overclaim; the portfolio generator refuses to include them. */
const FORBIDDEN = [/fda[- ]ready/i, /submission[- ]ready/i, /certified/i, /expert (sas|statistical) programmer/i, /validated for regulatory/i];

function buildReadme(cap: Capstone, doneSteps: string[], author: string): string {
  const skills = cap.skills.map((s) => skillById.get(s)?.name ?? s);
  const lines = [
    `# ${cap.portfolio.repoName}`,
    '',
    `> ${cap.portfolio.tagline}`,
    '',
    '**Educational project using synthetic data only.** No real patient data, sponsor, or product is involved. This is not an actual regulatory submission and has not been reviewed by any regulatory authority.',
    '',
    '## Objective',
    '',
    cap.objective.trim(),
    '',
    '## Data',
    '',
    cap.datasets.length
      ? cap.datasets.map((d) => `- \`${d}\` — synthetic dataset generated deterministically by *Clinical Biometrics Mastery OS* (fictional study).`).join('\n')
      : '- Synthetic datasets generated for this project (see `data/README.md`).',
    '',
    '## Methods',
    '',
    cap.portfolio.methods.trim(),
    '',
    '## Repository structure',
    '',
    '```text',
    `${cap.portfolio.repoName}/`,
    '├── README.md',
    '├── data/            # input datasets (synthetic) — see data/README.md',
    '├── programs/        # SAS / R / Python programs, numbered in run order',
    '├── outputs/         # generated tables, listings, figures (not hand-edited)',
    '├── qc/              # independent QC programs and QC findings log',
    '└── docs/            # specifications, derivation notes, decisions',
    '```',
    '',
    '## Deliverables',
    '',
    ...cap.deliverables.map((d) => `- ${d.replace(/\n/g, ' ')}`),
    '',
    '## Validation',
    '',
    'Key outputs were independently re-derived (double programming) and differences investigated and documented in `qc/qc_log.md`. Record here which outputs were QC’d, by what method, and what was found.',
    '',
    '## Results',
    '',
    '_Summarize the main results with the exact numbers from `outputs/` — estimates with confidence intervals, not bare p-values._',
    '',
    '## Limitations',
    '',
    cap.portfolio.limitations.trim(),
    '',
    '## Skills demonstrated',
    '',
    skills.map((s) => `- ${s}`).join('\n'),
    '',
    `## Progress log`,
    '',
    doneSteps.length ? doneSteps.map((s) => `- [x] ${s}`).join('\n') : '- [ ] (no steps completed yet)',
    '',
    '---',
    `Author: ${author || 'Your Name'} · Built with Clinical Biometrics Mastery OS (educational training environment).`,
    '',
  ];
  return lines.join('\n');
}

export default function PortfolioPage() {
  usePage('Portfolio');
  const [params] = useSearchParams();
  const initial = params.get('capstone') ?? capstones[0]?.id ?? '';
  const [capId, setCapId] = useState(initial);
  const [author, setAuthor] = useState('');
  const steps = useProgress((s) => s.steps);
  const cap = capstoneById.get(capId);
  const doneSteps = useMemo(() => (cap ? cap.steps.filter((s) => steps[`${cap.id}:${s.id}`]).map((s) => s.title) : []), [cap, steps]);
  const readme = cap ? buildReadme(cap, doneSteps, author) : '';
  const overclaims = FORBIDDEN.filter((re) => re.test(readme));

  const download = async () => {
    if (!cap) return;
    const zip = new JSZip();
    const root = zip.folder(cap.portfolio.repoName)!;
    root.file('README.md', readme);
    root.file('.gitignore', ['.DS_Store', '*.log', '*.lst', '__pycache__/', '.Rhistory', '.RData', 'outputs/tmp/', '.venv/', ''].join('\n'));
    for (const d of ['data', 'programs', 'outputs', 'qc', 'docs']) root.folder(d)!.file('.gitkeep', '');
    root.folder('qc')!.file('qc_log.md', '# QC log\n\n| Output | QC method | Programmer | QC programmer | Finding | Resolution | Date |\n|---|---|---|---|---|---|---|\n');
    root.folder('data')!.file('README.md', '# Data\n\nSynthetic datasets from Clinical Biometrics Mastery OS (fictional study). No real patient data.\n');
    if (cap.starter) {
      const prefix = `/${cap.starter.replace(/^\/+|\/+$/g, '')}/`;
      const entries = Object.entries(starterFiles).filter(([p]) => p.startsWith(prefix));
      for (const [path, load] of entries) root.file(path.slice(prefix.length), await load());
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cap.portfolio.repoName}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!capstones.length)
    return (
      <div className="page">
        <EmptyState icon={<FolderGit2 />} title="No capstones yet">Portfolio artifacts are generated from capstones.</EmptyState>
      </div>
    );

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">Portfolio mode</div>
        <h1 className="page-title">Turn projects into credible repositories</h1>
        <p className="page-lede">
          Generate a GitHub-ready project structure and README for any capstone. The language is deliberately accurate —
          “educational implementation of a CDISC-style workflow using synthetic data” — because credibility is the point. Overclaims such as
          “FDA submission-ready” or “certified programmer” are blocked.
        </p>
      </div>
      <div className="portfolio-layout">
        <Card pad="md">
          <div className="stack gap-4">
            <label className="field">
              <span className="field__label">Capstone</span>
              <select className="select" value={capId} onChange={(e) => setCapId(e.target.value)}>
                {capstones.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.number}. {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Author name (shown in the README footer)</span>
              <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
            </label>
            {cap && (
              <div className="stack gap-2" style={{ fontSize: 13 }}>
                <span>
                  <b className="num">{doneSteps.length}</b> of {cap.steps.length} steps completed — completed steps are listed in the README’s progress log.
                </span>
              </div>
            )}
            {overclaims.length > 0 && (
              <div className="callout callout--danger" style={{ margin: 0 }}>
                <span className="callout__icon">
                  <ShieldAlert />
                </span>
                <div className="callout__body">
                  <div className="callout__title">Overclaiming language detected</div>
                  Remove it before publishing.
                </div>
              </div>
            )}
            <div className="row gap-2 wrap">
              <Button variant="primary" icon={<Download />} onClick={() => void download()} disabled={!cap || overclaims.length > 0}>
                Download project (.zip)
              </Button>
              <Button
                icon={<Copy />}
                onClick={() => {
                  void navigator.clipboard.writeText(readme).then(() => toast('README copied'));
                }}
              >
                Copy README
              </Button>
            </div>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
              Before publishing: replace the Results placeholder with your real numbers, commit your programs, and make sure every figure in outputs/ is
              produced by code, not edited by hand.
            </p>
          </div>
        </Card>
        <div style={{ minWidth: 0 }}>
          <CodeBlock code={readme} lang="text" title="README.md" maxHeight={680} download={false} />
        </div>
      </div>
    </div>
  );
}
