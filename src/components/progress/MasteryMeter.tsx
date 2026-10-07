import clsx from 'clsx';
import { LEVELS, type Level } from '../../lib/mastery';
import { Tooltip } from '../ui';

/** Six-step mastery indicator: Not started → Mastered. */
export function MasteryMeter({ level, large, showLabel }: { level: Level; large?: boolean; showLabel?: boolean }) {
  return (
    <Tooltip content={`${LEVELS[level]} (${level}/5)`}>
      <span className="row gap-2">
        <span className={clsx('mastery', large && 'mastery--lg')} aria-label={`Mastery: ${LEVELS[level]}`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="mastery__seg" style={i <= level ? { background: `var(--mastery-${Math.min(5, level)})` } : undefined} />
          ))}
        </span>
        {showLabel && <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 550 }}>{LEVELS[level]}</span>}
      </span>
    </Tooltip>
  );
}
