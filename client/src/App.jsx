import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RecordsProvider } from './contexts/RecordsContext';
import AppShell from './components/Layout/AppShell';
import TimelinePage from './pages/TimelinePage';
import GalleryPage from './pages/GalleryPage';
import UploadPage from './pages/UploadPage';
import RecordDetailPage from './pages/RecordDetailPage';

const GraphPage = lazy(() => import('./pages/GraphPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TVModePage = lazy(() => import('./pages/TVModePage'));

function Loading() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">🌱</div>
      <div className="empty-state-title">正在加载...</div>
      <div className="empty-state-desc">请稍候，页面资源正在准备中</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RecordsProvider>
        <AppShell>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<TimelinePage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/record/:uuid" element={<RecordDetailPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tv" element={<TVModePage />} />
            </Routes>
          </Suspense>
        </AppShell>
      </RecordsProvider>
    </BrowserRouter>
  );
}
