import { useState } from 'react';
import { useToast } from '../components/Toast';

export default function Settings() {
  const toast = useToast();
  const [form, setForm] = useState({
    gmail_address:    localStorage.getItem('cfg_gmail') || '',
    company_name:     localStorage.getItem('cfg_company') || '',
    default_markup:   localStorage.getItem('cfg_markup') || '15',
    check_interval:   localStorage.getItem('cfg_interval') || '30',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    localStorage.setItem('cfg_gmail',    form.gmail_address);
    localStorage.setItem('cfg_company',  form.company_name);
    localStorage.setItem('cfg_markup',   form.default_markup);
    localStorage.setItem('cfg_interval', form.check_interval);
    toast('Settings saved locally', 'success');
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Settings <span>_</span></div>
      </div>

      <div className="content" style={{ maxWidth: 600 }}>
        {/* Email config */}
        <div className="card mb-24">
          <div className="section-header">Email Configuration</div>
          <div className="form-group">
            <label className="form-label">Gmail Address</label>
            <input className="form-input" placeholder="you@gmail.com"
              value={form.gmail_address} onChange={e => set('gmail_address', e.target.value)} />
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(232,255,71,.05)', border: '1px solid rgba(232,255,71,.2)', borderRadius: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            <span className="text-accent" style={{ fontWeight: 700 }}>Note:</span> Gmail credentials and OAuth tokens are configured in your backend's <span className="mono">credentials.json</span> & <span className="mono">token.json</span> files. This field is for display only.
          </div>
        </div>

        {/* Quote defaults */}
        <div className="card mb-24">
          <div className="section-header">Quote Defaults</div>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input className="form-input" placeholder="Your Company Name"
              value={form.company_name} onChange={e => set('company_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Default Markup %</label>
            <input className="form-input" type="number" min="0" max="100"
              value={form.default_markup} onChange={e => set('default_markup', e.target.value)} />
            <div className="text-muted" style={{ marginTop: 6, fontSize: 12 }}>
              Applied on top of base part price when generating quotes
            </div>
          </div>
        </div>

        {/* Watcher config */}
        <div className="card mb-24">
          <div className="section-header">Email Watcher</div>
          <div className="form-group">
            <label className="form-label">Check Interval (seconds)</label>
            <input className="form-input" type="number" min="10"
              value={form.check_interval} onChange={e => set('check_interval', e.target.value)} />
            <div className="text-muted" style={{ marginTop: 6, fontSize: 12 }}>
              Backend polls inbox every {form.check_interval}s — configure in <span className="mono">main.py</span> as <span className="mono">CHECK_INTERVAL</span>
            </div>
          </div>
        </div>

        {/* Backend info */}
        <div className="card mb-24" style={{ borderColor: 'rgba(71,255,232,.2)' }}>
          <div className="section-header">Backend Connection</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['API URL',   import.meta.env.VITE_API_URL || 'http://localhost:8000 (proxy)'],
              ['Database',  'Railway MySQL — turntable.proxy.rlwy.net:44790'],
              ['Auth',      'Gmail OAuth2 (credentials.json)'],
            ].map(([k, v]) => (
              <div key={k} className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <span className="text-muted">{k}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--accent2)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" onClick={save} style={{ width: '100%' }}>
          Save Settings
        </button>
      </div>
    </>
  );
}
