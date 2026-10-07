import { useState } from 'react';
import { Link, useParams } from 'react-router';
import clsx from 'clsx';
import { GraduationCap, Building, Stethoscope, MessagesSquare } from 'lucide-react';
import { usePage } from '../../components/layout/page';
import { useCompanion, lessonById } from '../../content/registry';
import { Card, EmptyState, Loading, Tabs, Disclosure } from '../../components/ui';
import { Markdown } from '../../components/content/Markdown';
import { CodeBlock } from '../../components/code/CodeBlock';
import '../reference/reference.css';

const COURSES: Record<string, string> = {
  probability: 'Probability',
  inference: 'Statistical inference',
  regression: 'Regression',
  categorical: 'Categorical data',
  survival: 'Survival analysis',
  longitudinal: 'Longitudinal analysis',
  'clinical-trials': 'Clinical trials',
  design: 'Experimental design',
  computing: 'Statistical computing',
};

export default function CompanionPage() {
  const { topicId } = useParams<{ topicId?: string }>();
  const topics = useCompanion();
  const topic = topics?.find((t) => t.id === topicId);
  const [lang, setLang] = useState<'sas' | 'r' | 'python'>('sas');
  usePage(topic?.title ?? 'MS Companion', topic ? [{ label: 'MS Companion', to: '/companion' }] : [], 'companion');
  if (!topics) return <div className="page"><Loading /></div>;

  const courses = Object.keys(COURSES).filter((c) => topics.some((t) => t.course === c));

  return (
    <div className="page page--wide">
      <div className="page-header">
        <div className="eyebrow">Master's degree companion</div>
        <h1 className="page-title">MS Companion</h1>
        <p className="page-lede">
          Pick what your courses cover this semester. For each topic: the academic version (how your professor frames it), the industry version (how it
          shows up in a trial), a clinical example, SAS and R implementations, and the interview question it turns into.
        </p>
      </div>
      <div className="ref-layout">
        <nav className="ref-nav" aria-label="Topics">
          {courses.map((c) => (
            <div key={c} style={{ marginBottom: 8 }}>
              <div className="eyebrow" style={{ padding: '6px 10px 2px' }}>
                {COURSES[c]}
              </div>
              {topics
                .filter((t) => t.course === c)
                .map((t) => (
                  <Link key={t.id} to={`/companion/${t.id}`} className={clsx('ref-nav__item', t.id === topicId && 'is-active')}>
                    {t.title}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div style={{ minWidth: 0 }}>
          {!topic && topics.length === 0 && (
            <Card pad="md">
              <EmptyState icon={<GraduationCap />} title="No companion topics yet">Topics live in content/companion/*.yaml.</EmptyState>
            </Card>
          )}
          {!topic && topics.length > 0 && (
            <div className="grid grid-auto">
              {courses.map((c) => (
                <Card key={c} pad="md">
                  <div style={{ fontWeight: 650, marginBottom: 8 }}>{COURSES[c]}</div>
                  <ul className="list-reset">
                    {topics
                      .filter((t) => t.course === c)
                      .map((t) => (
                        <li key={t.id}>
                          <Link to={`/companion/${t.id}`} className="link-row" style={{ fontSize: 13.5 }}>
                            {t.title}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
          {topic && (
            <div className="stack gap-4">
              <h2 style={{ fontSize: 24, letterSpacing: '-0.02em' }}>{topic.title}</h2>
              <div className="grid grid-2" style={{ alignItems: 'start' }}>
                <Card pad="md">
                  <div className="row gap-2 eyebrow" style={{ marginBottom: 8 }}>
                    <GraduationCap size={14} /> Academic version
                  </div>
                  <Markdown source={topic.academic} compact />
                </Card>
                <Card pad="md">
                  <div className="row gap-2 eyebrow" style={{ marginBottom: 8 }}>
                    <Building size={14} /> Industry version
                  </div>
                  <Markdown source={topic.industry} compact />
                </Card>
              </div>
              <Card pad="md">
                <div className="row gap-2 eyebrow" style={{ marginBottom: 8 }}>
                  <Stethoscope size={14} /> Clinical example
                </div>
                <Markdown source={topic.clinicalExample} compact />
              </Card>
              <Card pad="md">
                <Tabs
                  value={lang}
                  onChange={setLang}
                  tabs={[
                    { id: 'sas', label: 'SAS' },
                    { id: 'r', label: 'R' },
                    ...(topic.python ? [{ id: 'python' as const, label: 'Python' }] : []),
                  ]}
                />
                <CodeBlock code={lang === 'sas' ? topic.sas : lang === 'r' ? topic.r : topic.python ?? ''} lang={lang} compact />
              </Card>
              <Disclosure kind="interview" icon={<MessagesSquare />} label={<Markdown source={topic.interview.question} inline compact />}>
                <Markdown source={topic.interview.answer} compact />
              </Disclosure>
              {topic.lessons.length > 0 && (
                <div className="row gap-2 wrap">
                  <span className="muted" style={{ fontSize: 13 }}>
                    Go deeper:
                  </span>
                  {topic.lessons.map((id) => {
                    const l = lessonById.get(id);
                    return l ? (
                      <Link key={id} to={`/learn/${l.lab}/${l.id}`} className="tag">
                        {l.title}
                      </Link>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
