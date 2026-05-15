import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRFQs, triggerMailFetch } from '../api/client';
import { useToast } from '../components/Toast';

export default function RFQList() {
  const toast = useToast();
  const [rfqs, setRfqs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [filter, setFilter]   = useState('all');

  const load = async () => {
    try {
      const res = await getRFQs();
      setRfqs([...(res.data || [])].reverse());
    } catch {
      toast('Could not load RFQs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const res = await triggerMailFetch();
      toast(`${res.data?.new_emails ?? 0} new email(s) found`, 'success');
      await load();
    } catch {
      toast('Mail fetch failed', 'error');
    } finally {
      setFetching(false);
    }
  };

  const filtered = filter === 'all' ? rfqs : rfqs.filter(r => r.status === filter);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">RFQ <span>Inbox</span></div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>
            {rfqs.length} total request{rfqs.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleFetch} disabled={fetching}>
          {fetching ? <><div className="spinner" /> Fetching...</> : '⟳  Fetch Emails'}
        </button>
      </div>

      <div className="content">
        {/* Filter tabs */}
        <div className="flex gap-8 mb-24">
          {['all', 'new', 'pending', 'sent'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="btn btn-secondary btn-sm"
              style={filter === f ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /><h3>Loading…</h3></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✉</div>
              <h3>No RFQs found</h3>
              <p className="text-muted">Try clicking "Fetch Emails" to pull new requests</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Sender</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Parts</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id || i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.sender_name || r.sender?.split('@')[0] || 'Unknown'}</div>
                        <div className="text-muted" style={{ fontSize: 12 }}>{r.sender_email || r.sender || '—'}</div>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                          {r.subject || 'Quotation Request'}
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {r.received_at ? new Date(r.received_at).toLocaleDateString('en-IN') : r.date || '—'}
                      </td>
                      <td className="mono">{r.parts_count ?? r.items?.length ?? '—'}</td>
                      <td><span className={`status status-${r.status || 'new'}`}>{r.status || 'new'}</span></td>
                      <td>
                        <Link to={`/rfqs/${r.id}`} className="btn btn-secondary btn-sm">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
