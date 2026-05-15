import { useState, useEffect } from 'react';
import { getParts, createPart, updatePart, deletePart } from '../api/client';
import { useToast } from '../components/Toast';

export default function Pricing() {
  const toast = useToast();
  const [parts, setParts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'add' | {id, name, price}
  const [form, setForm]       = useState({ name: '', price: '' });
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState('');

  const load = async () => {
    try {
      const res = await getParts();
      setParts(res.data || []);
    } catch {
      toast('Could not load parts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd  = ()    => { setForm({ name: '', price: '' }); setModal('add'); };
  const openEdit = (part) => { setForm({ name: part.name, price: String(part.price) }); setModal(part); };
  const close    = ()    => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return toast('Fill all fields', 'error');
    setSaving(true);
    try {
      if (modal === 'add') {
        const res = await createPart({ name: form.name.trim(), price: parseFloat(form.price) });
        setParts(p => [...p, res.data]);
        toast('Part added!', 'success');
      } else {
        const res = await updatePart(modal.id, { name: form.name.trim(), price: parseFloat(form.price) });
        setParts(p => p.map(x => x.id === modal.id ? res.data : x));
        toast('Part updated!', 'success');
      }
      close();
    } catch {
      toast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this part?')) return;
    try {
      await deletePart(id);
      setParts(p => p.filter(x => x.id !== id));
      toast('Deleted', 'info');
    } catch {
      toast('Delete failed', 'error');
    }
  };

  const filtered = parts.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Parts <span>Database</span></div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 3 }}>{parts.length} parts in database</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Part</button>
      </div>

      <div className="content">
        {/* Search */}
        <div className="mb-16">
          <input
            className="form-input"
            placeholder="🔍  Search parts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /><h3>Loading…</h3></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⊞</div>
              <h3>{search ? 'No parts match your search' : 'No parts in database'}</h3>
              <p className="text-muted">Add parts to start generating quotes</p>
              {!search && <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 12 }}>+ Add First Part</button>}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Part Name</th>
                    <th>Unit Price (₹)</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((part, i) => (
                    <tr key={part.id || i}>
                      <td className="mono" style={{ color: 'var(--muted)' }}>{String(i+1).padStart(2,'0')}</td>
                      <td style={{ fontWeight: 600 }}>{part.name}</td>
                      <td className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        ₹{Number(part.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(part)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(part.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal !== null && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {modal === 'add' ? 'Add New Part' : 'Edit Part'}
              <span className="modal-close" onClick={close}>×</span>
            </div>
            <div className="form-group">
              <label className="form-label">Part Name</label>
              <input
                className="form-input"
                placeholder="e.g. Steel Shaft 10mm"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price (₹)</label>
              <input
                className="form-input"
                type="number"
                placeholder="e.g. 250.00"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                step="0.01"
              />
            </div>
            <div className="flex gap-8 mt-24">
              <button className="btn btn-secondary" onClick={close} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
                {saving ? <><div className="spinner" /> Saving…</> : modal === 'add' ? 'Add Part' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
