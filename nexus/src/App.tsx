import { useState } from 'react';
import { SceneBackdrop } from './components/SceneBackdrop';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { UnavailableView } from './components/UnavailableView';
import { findSection, type SectionId } from './navigation';
import { OverviewPage } from './pages/OverviewPage';
import { CalibrationPage } from './pages/CalibrationPage';
import { MotionNudgePage } from './pages/MotionNudgePage';
import { ImuPage } from './pages/ImuPage';
import { TelemetrySourceProvider } from './telemetry/source';
import './App.css';

export default function App() {
  const [sectionId, setSectionId] = useState<SectionId>('overview');
  const section = findSection(sectionId);

  return (
    // The source provider owns both adapters and decides which one the UI
    // reads. Components below this point cannot tell the difference.
    <TelemetrySourceProvider>
      <SceneBackdrop />
      <div className="nx-app">
        <Sidebar active={sectionId} onSelect={setSectionId} />
        <StatusBar />

        {/*
         * One scroll container for the whole application.
         *
         * The shell (sidebar, status bar, alert strip) stays put; everything
         * a route renders scrolls inside here. The document body never
         * scrolls — it is globally overflow:hidden — so a page that manages
         * its own overflow would simply clip its last card, which is exactly
         * the bug this replaces. The `key` restarts the enter transition on
         * every route change.
         */}
        <main className="nx-main" key={sectionId}>
          {sectionId === 'overview' ? (
            <OverviewPage />
          ) : sectionId === 'joints' ? (
            <CalibrationPage />
          ) : sectionId === 'motion' ? (
            <MotionNudgePage />
          ) : sectionId === 'imu' ? (
            <ImuPage />
          ) : (
            <UnavailableView section={section} />
          )}
        </main>
      </div>
    </TelemetrySourceProvider>
  );
}
