import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './routes/HomePage';
import { LevelsPage } from './routes/LevelsPage';
import { GamePage } from './routes/GamePage';
import { SettingsPage } from './routes/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/levels" element={<LevelsPage />} />
        <Route path="/play/:levelId" element={<GamePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
