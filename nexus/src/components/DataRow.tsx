import type { ReactNode } from 'react';
import { NO_VALUE } from '../telemetry/format';
import './dataRow.css';

interface DataRowProps {
  label: string;
  value?: ReactNode;
  /** Set when no source produces this field. Renders the reason, not a number. */
  unavailableReason?: string;
  emphasise?: boolean;
  tone?: 'default' | 'ok';
}

/** One label / value line. The single place a missing value is rendered. */
export function DataRow({
  label,
  value,
  unavailableReason,
  emphasise,
  tone = 'default',
}: DataRowProps) {
  const missing = unavailableReason !== undefined;

  return (
    <div className="nx-row" data-missing={missing || undefined}>
      <div className="nx-row__label nx-label">{label}</div>
      <div
        className="nx-row__value nx-mono"
        data-emphasis={emphasise || undefined}
        data-tone={tone !== 'default' ? tone : undefined}
      >
        {missing ? NO_VALUE : value}
      </div>
      {missing && <div className="nx-row__reason">{unavailableReason}</div>}
    </div>
  );
}
