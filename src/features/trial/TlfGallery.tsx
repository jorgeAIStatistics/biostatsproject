import { useState } from 'react';
import clsx from 'clsx';
import { TLF_CATALOGUE } from '../../lib/tlf/catalogue';
import { WidgetHost } from '../../components/widgets/registry';
import '../reference/reference.css';

/** TLF gallery: every output is computed live from the ADaM datasets. */
export default function TlfGallery() {
  const [active, setActive] = useState(TLF_CATALOGUE[0]?.id);
  return (
    <div className="ref-layout">
      <nav className="ref-nav" aria-label="Outputs">
        {(['table', 'figure', 'listing'] as const).map((kind) => (
          <div key={kind} style={{ marginBottom: 8 }}>
            <div className="eyebrow" style={{ padding: '6px 10px 2px' }}>
              {kind === 'table' ? 'Tables' : kind === 'figure' ? 'Figures' : 'Listings'}
            </div>
            {TLF_CATALOGUE.filter((t) => t.kind === kind).map((t) => (
              <button key={t.id} type="button" className={clsx('ref-nav__item', t.id === active && 'is-active')} style={{ border: 0, background: 'none', width: '100%', textAlign: 'left' }} onClick={() => setActive(t.id)}>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                  {t.number}
                </span>
                <span className="grow">{t.title}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ minWidth: 0 }}>{active && <WidgetHost key={active} name="tlf" props={{ id: active }} />}</div>
    </div>
  );
}
