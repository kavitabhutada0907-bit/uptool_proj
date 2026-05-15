import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRFQ, generateQuote } from '../api/client';
import { useToast } from '../components/Toast';
import axios from 'axios';

export default function RFQDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const toast        = useToast();
  const [rfq, setRfq]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGen]        = useState(false);
  const [missingItems, setMissing]  = useState([]);
  const [prices, setPrices]         = useState({});
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    getRFQ(id)
      .then(r => setRfq(r.data))
      .catch(() => toast('RFQ not found', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGenerate = async () => {
    setGen(true);
    try {
      const res = await generateQuote(id);
      if (res.data?.status === 'missing_items') {
        // Show popup with missing items
        setMissing(res.data.missing_items);
        setPrices(
          Object.fromEntries(res.data.missing_items.map(i => [i.name, '']))
        );
        setShowModal(true);
      } else {
        toast('Quote generated!', 'success');
        navigate(`/quotes/${res.data?.id}`);
      }
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed to generate quote', 'error');
    } finally {
      setGen(false);
    }
  };

  const handleSaveAndGenerate = async () => {
    // Validate all prices filled
    const missing = missingItems.filter(i => !prices[i.name] || prices[i.name] === '');
    if (missing.length > 0) {
      toast('Please fill all prices or mark as unavailable', 'error');
      return;
    }

    setSaving(true);
    try {
      const priceList = missingItems
        .filter(i => prices[i.name] !== 'unavailable')
        .map(i => ({ name: i.name, price: parseFloat(prices[i.name]) }));

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/quotes/generate/${id}/with-prices`,
        { prices: priceList }
      );
      toast('Quote generated!', 'success');
      setShowModal(false);
      navigate(`/quotes/${res.data?.id}`);
    } catch (e) {
      toast(e.response?.data?.detail || 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="content empty-state"><div className="spinner" /><h3>Loading RFQ…</h3></div>
  );
  if (!rfq) return (
    <div className="content empty-state"><div className="empty-icon">✕</div><h3>RFQ not found</h3></div>
  );

  const items = rfq.items || rfq.parts || [];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">RFQ <span>#{rfq.id}</span></div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>
            From {rfq.sender_email || rfq.sender || 'Unknown'}
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Back</button>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={generating || rfq.status === 'sent'}
          >
            {generating
              ? <><div className="spinner" /> Generating…</>
              : rfq.status === 'sent' ? '✓ Quote Sent' : '⚡ Generate Quote'
            }
          </button>
        </div>
      </div>

      <div className="content">
        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="section-header">Email Details</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['From',    rfq.sender_email || rfq.sender || '—'],
                ['Subject', rfq.subject || 'Quotation Request'],
                ['Date',    rfq.date || '—'],
                ['Status',  null],
              ].map(([label, value]) => (
                <div key={label} className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                  <span className="text-muted">{label}</span>
                  {label === 'Status'
                    ? <span className={`status status-${rfq.status || 'new'}`}>{rfq.status || 'new'}</span>
                    : <span className="mono" style={{ fontSize: 13 }}>{value}</span>
                  }
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-header">Email Body</div>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 16, fontSize: 13,
              fontFamily: 'var(--font-mono)', color: 'var(--text2)',
              minHeight: 120, maxHeight: 200, overflowY: 'auto',
              lineHeight: 1.6, whiteSpace: 'pre-wrap'
            }}>
              {rfq.body || rfq.email_body || 'No body content available.'}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex-between mb-16">
            <div className="section-header" style={{ margin: 0, flex: 1 }}>
              Extracted Parts ({items.length})
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Part Name</th><th>Quantity</th></tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ color: 'var(--muted)' }}>{String(i+1).padStart(2,'0')}</td>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td className="mono">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Missing Items Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>⚠️ Missing Parts Found</span>
              <span className="modal-close" onClick={() => setShowModal(false)}>×</span>
            </div>

            <p className="text-muted mb-16" style={{ fontSize: 13, lineHeight: 1.6 }}>
              The following parts were not found in your database. Add a price to include them in the quote, or mark as unavailable to skip them.
            </p>

            <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
              {missingItems.map(item => (
                <div key={item.name} style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>Qty: {item.quantity}</div>
                  </div>
                  <div className="flex gap-8" style={{ alignItems: 'center' }}>
                    {prices[item.name] === 'unavailable' ? (
                      <span className="status status-failed">Not Available</span>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <span style={{
                          position: 'absolute', left: 10, top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: 13, color: 'var(--text2)'
                        }}>₹</span>
                        <input
                          type="number"
                          placeholder="Enter price"
                          className="form-input"
                          style={{ width: 140, paddingLeft: 24 }}
                          value={prices[item.name] || ''}
                          onChange={e => setPrices(p => ({ ...p, [item.name]: e.target.value }))}
                        />
                      </div>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPrices(p => ({
                        ...p,
                        [item.name]: p[item.name] === 'unavailable' ? '' : 'unavailable'
                      }))}
                    >
                      {prices[item.name] === 'unavailable' ? 'Add Price' : 'Not Available'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-8">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveAndGenerate} disabled={saving} style={{ flex: 2 }}>
                {saving
                  ? <><div className="spinner" /> Saving & Generating…</>
                  : '✓ Save Prices & Generate Quote'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}