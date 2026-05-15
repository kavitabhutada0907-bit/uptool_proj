import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getStats, getRFQs, getQuotes, triggerMailFetch } from '../api/client';
import { useToast } from '../components/Toast';

export default function Dashboard() {
  const toast = useToast();
  const [stats, setStats]     = useState({ total_rfqs: 0, quotes_sent: 0, pending: 0, grand_total: 0 });
  const [rfqs, setRfqs]       = useState([]);
  const [quotes, setQuotes]   = useState([]);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading]   = useState(true);

  const loadData = async () => {
    const [r, q, s] = await Promise.all([
      getRFQs().catch(() => ({ data: [] })),
      getQuotes().catch(() => ({ data: [] })),
      getStats().catch(() => ({ data: {} })),
    ]);

    const allRfqs   = r.data || [];
    const allQuotes = q.data || [];

    // Newest first — reverse the array
    const sortedRfqs = [...allRfqs].reverse();

    // Pending = RFQs whose status is NOT 'sent'
    const pendingCount = allRfqs.filter(x => x.status !== 'sent').length;

    setRfqs(sortedRfqs.slice(0, 5));
    setQuotes([...allQuotes].reverse().slice(0, 5));
    setStats(prev => ({
      ...prev,
      ...(s.data || {}),
      total_rfqs:  allRfqs.length,
      quotes_sent: allQuotes.length,
      pending:     pendingCount,
    }));
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const res = await triggerMailFetch();
      toast(`${res.data?.new_emails ?? 0} new email(s) processed`, 'success');
      await loadData();
    } catch {
      toast('Failed to fetch emails', 'error');
    } finally {
      setFetching(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard <span>_</span></div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>
            Real-time quoting overview
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleFetch} disabled={fetching}>
          {fetching ? <><div className="spinner" /> Checking...</> : '⟳  Fetch New Emails'}
        </button>
      </div>

      <div className="content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total RFQs</div>
            <div className="stat-value accent mono">{loading ? '—' : stats.total_rfqs ?? rfqs.length}</div>
            <div className="stat-sub">All time</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Quotes Sent</div>
            <div className="stat-value success mono">{loading ? '—' : stats.quotes_sent ?? quotes.length}</div>
            <div className="stat-sub">Responded</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value warning mono">{loading ? '—' : stats.pending ?? 0}</div>
            <div className="stat-sub">Awaiting quote</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Revenue Quoted</div>
            <div className="stat-value mono">
              ₹{loading ? '—' : Number(stats.grand_total ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="stat-sub">This month</div>
          </div>
        </div>

        <div className="grid-2">
          {/* Recent RFQs */}
          <div className="card">
            <div className="flex-between mb-16">
              <div className="section-header" style={{ margin: 0, flex: 1 }}>Recent RFQs</div>
              <Link to="/rfqs" className="btn btn-secondary btn-sm">View all →</Link>
            </div>
            {rfqs.length === 0 && !loading ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">✉</div>
                <h3>No RFQs yet</h3>
                <p className="text-muted">Click "Fetch New Emails" to start</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>From</th><th>Parts</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {rfqs.map((r, i) => (
                      <tr key={r.id || i}>
                        <td>
                          <Link to={`/rfqs/${r.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                            <div style={{ fontWeight: 600 }}>{r.sender_name || r.sender?.split('@')[0] || 'Unknown'}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>{r.sender_email || r.sender || '—'}</div>
                          </Link>
                        </td>
                        <td className="mono">{r.parts_count ?? r.items?.length ?? '—'}</td>
                        <td><span className={`status status-${r.status || 'new'}`}>{r.status || 'new'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Quotes */}
          <div className="card">
            <div className="flex-between mb-16">
              <div className="section-header" style={{ margin: 0, flex: 1 }}>Recent Quotes</div>
              <Link to="/quotes" className="btn btn-secondary btn-sm">View all →</Link>
            </div>
            {quotes.length === 0 && !loading ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">◈</div>
                <h3>No quotes yet</h3>
                <p className="text-muted">Quotes appear here after generation</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Quote #</th><th>Total</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {quotes.map((q, i) => (
                      <tr key={q.id || i}>
                        <td>
                          <Link to={`/quotes/${q.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                            #{q.id || String(i + 1).padStart(4, '0')}
                          </Link>
                        </td>
                        <td className="mono">₹{Number(q.grand_total || 0).toLocaleString('en-IN')}</td>
                        <td><span className={`status status-${q.status || 'sent'}`}>{q.status || 'sent'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
