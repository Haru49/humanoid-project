import { useEffect, useMemo, useState } from 'react';
import { formatClock } from '../telemetry/format';
import { useSnapshot } from '../telemetry/store';
import type { EventLevel } from '../telemetry/types';
import './eventPanel.css';

/*
 * Connection, scan and calibration events as a chronological timeline.
 *
 * A quiet robot produces few events, so the panel carries its own context —
 * counts by level, how long the session has run, how long since the last
 * entry — rather than leaving a near-empty list to speak for itself. None of
 * that is invented: every number is derived from events that really happened.
 */

type Filter = 'all' | EventLevel;

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'ERROR', label: 'ERROR' },
  { id: 'WARN', label: 'WARN' },
  { id: 'OK', label: 'OK' },
  { id: 'INFO', label: 'INFO' },
];

export function EventPanel() {
  const { events } = useSnapshot();
  const [filter, setFilter] = useState<Filter>('all');
  const now = useNow(10_000);

  const newestFirst = useMemo(
    () => [...events].sort((a, b) => b.timestampMs - a.timestampMs),
    [events],
  );

  const counts = useMemo(() => {
    const tally: Record<EventLevel, number> = { ERROR: 0, WARN: 0, OK: 0, INFO: 0 };
    for (const event of events) {
      tally[event.level] += 1;
    }
    return tally;
  }, [events]);

  const shown = filter === 'all'
    ? newestFirst
    : newestFirst.filter((event) => event.level === filter);

  const newest = newestFirst[0];
  const oldest = newestFirst[newestFirst.length - 1];

  return (
    <section className="nx-events nx-panel nx-glass nx-glass--2" aria-label="Event stream">
      <header className="nx-panel__head">
        <span className="nx-panel__title">Events</span>
        <span className="nx-panel__meta nx-mono">
          {events.length} {events.length === 1 ? 'entry' : 'entries'}
        </span>
      </header>

      {events.length > 0 && (
        <div className="nx-events__filters">
          {FILTERS.map((entry) => {
            const count = entry.id === 'all' ? events.length : counts[entry.id];
            return (
              <button
                key={entry.id}
                type="button"
                className="nx-events__filter nx-mono"
                data-active={filter === entry.id || undefined}
                data-level={entry.id === 'all' ? undefined : entry.id.toLowerCase()}
                data-empty={count === 0 || undefined}
                disabled={count === 0 && entry.id !== 'all'}
                onClick={() => setFilter(entry.id)}
              >
                {entry.label}
                <span className="nx-events__filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="nx-panel__body">
        {events.length === 0 ? (
          <EmptyState />
        ) : shown.length === 0 ? (
          <p className="nx-events__empty-filter nx-mono">
            NO {filter} ENTRIES IN THIS SESSION
          </p>
        ) : (
          <ol className="nx-events__list">
            {shown.map((event) => (
              <li
                className="nx-events__item"
                key={event.id}
                data-level={event.level.toLowerCase()}
              >
                <span className="nx-events__marker" aria-hidden="true" />
                <time className="nx-events__time nx-mono">
                  {formatClock(event.timestampMs)}
                </time>
                <span className="nx-events__channel nx-mono">{event.channel}</span>
                <span className="nx-events__message">{event.message}</span>
                <span className="nx-events__ago nx-mono">
                  {formatAgo(now - event.timestampMs)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {newest !== undefined && oldest !== undefined && (
        <footer className="nx-events__foot nx-mono">
          <span>SPAN {formatDuration(newest.timestampMs - oldest.timestampMs)}</span>
          <span className="nx-events__foot-dot" aria-hidden="true" />
          <span>LAST {formatAgo(now - newest.timestampMs)}</span>
        </footer>
      )}
    </section>
  );
}

/**
 * What the panel says before anything has happened. It explains what will
 * appear here rather than leaving a blank rectangle.
 */
function EmptyState() {
  return (
    <div className="nx-events__empty">
      <p className="nx-events__empty-title nx-mono">NO EVENTS YET</p>
      <p className="nx-events__empty-note">
        接続・バススキャン・キャリブレーション・障害がここに時系列で並びます。
      </p>
      <ul className="nx-events__empty-legend">
        <li data-level="ok">
          <span className="nx-events__marker" aria-hidden="true" />6台すべて応答
        </li>
        <li data-level="warn">
          <span className="nx-events__marker" aria-hidden="true" />注意が必要な状態
        </li>
        <li data-level="error">
          <span className="nx-events__marker" aria-hidden="true" />
          サーボ無応答・リンク切断
        </li>
      </ul>
    </div>
  );
}

/** A slow clock, so "3 min ago" does not silently go stale. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function formatAgo(deltaMs: number): string {
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatDuration(deltaMs: number): string {
  const seconds = Math.max(0, Math.round(deltaMs / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(
    Math.floor((seconds % 3600) / 60),
  )}:${pad(seconds % 60)}`;
}
