import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import OSForm from './components/OSForm';
import OSPrintView from './components/OSPrintView';
import OSSearch from './components/OSSearch';
import SettingsPage from './components/Settings';
import OSTracking from './components/OSTracking';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/os" element={<OSForm />} />
          <Route path="/search" element={<OSSearch />} />
          <Route path="/print" element={<OSPrintView />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/track/:osNumber" element={<OSTracking />} />
          <Route path="/status/:id" element={<OSTracking />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
