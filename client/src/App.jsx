import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RecordsProvider } from './contexts/RecordsContext';
import AppShell from './components/Layout/AppShell';
import TimelinePage from './pages/TimelinePage';
import GalleryPage from './pages/GalleryPage';
import UploadPage from './pages/UploadPage';
import RecordDetailPage from './pages/RecordDetailPage';
import GraphPage from './pages/GraphPage';
import ExportPage from './pages/ExportPage';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
import TVModePage from './pages/TVModePage';

export default function App() {
  return (
    <BrowserRouter>
      <RecordsProvider>
        <AppShell>
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
        </AppShell>
      </RecordsProvider>
    </BrowserRouter>
  );
}
