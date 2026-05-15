import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { ToastProvider } from './components/Toast';
import Dashboard from './pages/Dashboard';
import RFQList from './pages/RFQList';
import RFQDetail from './pages/RFQDetail';
import { QuoteList, QuoteDetail } from './pages/Quotes';
import Pricing from './pages/Pricing';
// import Settings from './pages/Settings';
import { getRFQs } from './api/client';

function AppShell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    getRFQs()
      .then(r => setUnread((r.data || []).filter(x => x.status === 'new').length))
      .catch(() => {});
    // Refresh badge every 60s
    const t = setInterval(() => {
      getRFQs()
        .then(r => setUnread((r.data || []).filter(x => x.status === 'new').length))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="layout">
      <Sidebar unreadCount={unread} />
      <div className="main">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/rfqs"       element={<RFQList />} />
          <Route path="/rfqs/:id"   element={<RFQDetail />} />
          <Route path="/quotes"     element={<QuoteList />} />
          <Route path="/quotes/:id" element={<QuoteDetail />} />
          <Route path="/pricing"    element={<Pricing />} />
          {/* <Route path="/settings"   element={<Settings />} /> */}
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}
