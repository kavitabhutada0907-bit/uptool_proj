import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getQuotes } from '../api/client';
import { useToast } from '../components/Toast';

export function QuoteList() {
  const toast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuotes()
      .then(r => setQuotes(r.data || []))
      .catch(() => toast('Could not load quotes', 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">All <span>Quotes</span></div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>{quotes.length} generated</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /><h3>Loading…</h3></div>
          ) : quotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <h3>No quotes yet</h3>
              <p className="text-muted">Generate a quote from an RFQ to see it here</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quote #</th>
                    <th>Recipient</th>
                    <th>Items</th>
                    <th>Grand Total</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q, i) => (
                    <tr key={q.id || i}>
                      <td className="mono text-accent">#{q.id || String(i+1).padStart(4,'0')}</td>
                      <td>{q.recipient || q.sent_to || '—'}</td>
                      <td className="mono">{q.items?.length ?? q.item_count ?? '—'}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        ₹{Number(q.grand_total || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {q.created_at ? new Date(q.created_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td><span className={`status status-${q.status || 'sent'}`}>{q.status || 'sent'}</span></td>
                      <td>
                        <Link to={`/quotes/${q.id}`} className="btn btn-secondary btn-sm">Open →</Link>
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

// ── Quote Detail ─────────────────────────────────────────────
import { useParams, useNavigate } from 'react-router-dom';
import { getQuote, sendQuote, downloadQuotePDF } from '../api/client';

export function QuoteDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const toast    = useToast();
  const [quote, setQuote]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDL]  = useState(false);

  useEffect(() => {
    getQuote(id)
      .then(r => setQuote(r.data))
      .catch(() => toast('Quote not found', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSend = async () => {
    setSending(true);
    try {
      await sendQuote(id);
      toast('Quote emailed successfully!', 'success');
      setQuote(q => ({ ...q, status: 'sent' }));
    } catch {
      toast('Failed to send quote', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async () => {
    setDL(true);
    try {
      const res = await downloadQuotePDF(id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `quote_${id}.csv`;
      a.click();
      toast('Downloaded!', 'success');
    } catch {
      toast('Download failed', 'error');
    } finally {
      setDL(false);
    }
  };

  if (loading) return <div className="content empty-state"><div className="spinner" /><h3>Loading…</h3></div>;
  if (!quote)  return <div className="content empty-state"><div className="empty-icon">✕</div><h3>Quote not found</h3></div>;

  const items     = quote.items || [];
  const grandTotal = items.reduce((s, i) => s + (i.total || (i.unit_price * i.quantity) || 0), 0);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Quote <span>#{quote.id}</span></div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>
            {quote.recipient || quote.sent_to || 'No recipient'}
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
          <button className="btn btn-secondary" onClick={handleDownload} disabled={downloading}>
            {downloading ? <><div className="spinner" /> Downloading…</> : '↓ Download CSV'}
          </button>
          <button className="btn btn-primary" onClick={handleSend} disabled={sending || quote.status === 'sent'}>
            {sending
              ? <><div className="spinner" /> Sending…</>
              : quote.status === 'sent' ? '✓ Already Sent' : '✉ Send Quote'
            }
          </button>
        </div>
      </div>

      <div className="content">
        {/* Header info */}
        <div className="grid-3 mb-24">
          {[
            ['Quote ID',  `#${quote.id}`],
            ['Recipient', quote.recipient || quote.sent_to || '—'],
            ['Date',      quote.created_at ? new Date(quote.created_at).toLocaleDateString('en-IN') : '—'],
          ].map(([label, value]) => (
            <div key={label} className="card card-sm">
              <div className="stat-label">{label}</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Line items */}
        <div className="card mb-24">
          <div className="section-header">Line Items</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Part Name</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ color: 'var(--muted)' }}>{String(i+1).padStart(2,'0')}</td>
                    <td style={{ fontWeight: 600 }}>{item.name || item.part_name}</td>
                    <td className="mono">{item.quantity}</td>
                    <td className="mono">₹{Number(item.unit_price || 0).toLocaleString('en-IN')}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{Number(item.total || item.unit_price * item.quantity || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grand total */}
        <div className="card" style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div className="text-muted">Grand Total</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '-1px' }}>
              ₹{Number(quote.grand_total || grandTotal).toLocaleString('en-IN')}
            </div>
            <span className={`status status-${quote.status || 'sent'}`}>{quote.status || 'sent'}</span>
          </div>
        </div>
      </div>
    </>
  );
}
