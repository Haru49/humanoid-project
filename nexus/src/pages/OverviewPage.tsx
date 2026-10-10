import { useState } from 'react';
import { EventPanel } from '../components/EventPanel';
import { ImuCard } from '../components/ImuCard';
import { JointDetailPanel } from '../components/JointDetailPanel';
import { PowerPanel } from '../components/PowerPanel';
import { RobotStage } from '../components/RobotStage';
import { useJointRows, useSnapshot } from '../telemetry/store';
import type { JointId } from '../telemetry/types';
import './overviewPage.css';

/**
 * The overview screen: robot, six joint callouts, selected-joint detail,
 * attitude, power and events. Read-only by construction — nothing here can
 * command a servo.
 */
export function OverviewPage() {
  const rows = useJointRows();
  const snapshot = useSnapshot();
  const [selectedId, setSelectedId] = useState<JointId>(11);

  const selected = rows.find((row) => row.definition.id === selectedId) ?? rows[0];
  const busSampled = snapshot.servoBus === 'SAMPLED';

  return (
    <div className="nx-overview">
      <RobotStage
        rows={rows}
        selectedId={selected.definition.id}
        busSampled={busSampled}
        onSelect={setSelectedId}
      />

      <aside className="nx-overview__rail" aria-label="Telemetry detail">
        <JointDetailPanel row={selected} busSampled={busSampled} />
        <ImuCard />
        <PowerPanel />
        <EventPanel />
      </aside>
    </div>
  );
}
