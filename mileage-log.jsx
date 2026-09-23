import React, { useState, useEffect, useMemo } from 'react';

const PURPOSES = [
  'Shipping / Post Office',
  'Sourcing / Card Show',
  'Storage Unit',
  'Other',
];

const RATE_2026 = 0.67; // IRS standard mileage rate, business use — confirm at filing

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function MileageLog() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState('miles'); // 'miles' | 'odometer'
  const [date, setDate] = useState(todayISO());
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [customPurpose, setCustomPurpose] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [miles, setMiles] = useState('');
  const [odoStart, setOdoStart] = useState('');
  const [odoEnd, setOdoEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [filterYear, setFilterYear] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('trips', false);
        if (res && res.value) {
          setEntries(JSON.parse(res.value));
        }
      } catch (e) {
        // no entries yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function persist(next) {
    setSaving(true);
    try {
      await window.storage.set('trips', JSON.stringify(next), false);
    } catch (e) {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setDate(todayISO());
    setPurpose(PURPOSES[0]);
    setCustomPurpose('');
    setFrom('');
    setTo('');
    setMiles('');
    setOdoStart('');
    setOdoEnd('');
    setNotes('');
    setError('');
  }

  function computeMiles() {
    if (mode === 'miles') {
      const m = parseFloat(miles);
      return isFinite(m) && m > 0 ? m : null;
    }
    const s = parseFloat(odoStart);
    const e = parseFloat(odoEnd);
    if (isFinite(s) && isFinite(e) && e > s) return e - s;
    return null;
  }

  async function addTrip() {
    const m = computeMiles();
    if (!m) {
      setError(mode === 'miles' ? 'Enter miles greater than 0.' : 'End odometer must be greater than start.');
      return;
    }
    if (!date) {
      setError('Pick a date.');
      return;
    }
    const finalPurpose = purpose === 'Other' && customPurpose.trim() ? customPurpose.trim() : purpose;

    const entry = {
      id: uid(),
      date,
      purpose: finalPurpose,
      from: from.trim(),
      to: to.trim(),
      miles: Math.round(m * 10) / 10,
      odoStart: mode === 'odometer' ? odoStart : '',
      odoEnd: mode === 'odometer' ? odoEnd : '',
      notes: notes.trim(),
      loggedAt: new Date().toISOString(),
    };

    const next = [entry, ...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
    setEntries(next);
    resetForm();
    await persist(next);
  }

  async function deleteTrip(id) {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    await persist(next);
  }

  const years = useMemo(() => {
    const s = new Set(entries.map((e) => e.date.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [entries]);

  const filtered = useMemo(() => {
    if (filterYear === 'all') return entries;
    return entries.filter((e) => e.date.slice(0, 4) === filterYear);
  }, [entries, filterYear]);

  const totals = useMemo(() => {
    const totalMiles = filtered.reduce((s, e) => s + e.miles, 0);
    const deduction = totalMiles * RATE_2026;
    return { totalMiles, deduction, count: filtered.length };
  }, [filtered]);

  const byPurpose = useMemo(() => {
    const m = {};
    filtered.forEach((e) => {
      m[e.purpose] = (m[e.purpose] || 0) + e.miles;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function exportCSV() {
    const header = 'Date,Purpose,From,To,Miles,Odometer Start,Odometer End,Notes\n';
    const rows = filtered
      .slice()
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((e) =>
        [e.date, e.purpose, e.from, e.to, e.miles, e.odoStart, e.odoEnd, e.notes]
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mileage-log-${filterYear === 'all' ? 'all' : filterYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const mono = { fontFamily: "'SF Mono', 'Roboto Mono', 'Courier New', monospace" };

  return (
    <div style={{ minHeight: '100vh', background: '#2B2E33', color: '#F7F5F1', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 18px 100px' }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.3, color: '#8A9099', marginBottom: 4 }}>
            SproutShell
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0, color: '#F7F5F1' }}>
            Mileage log
          </h1>
        </div>

        {/* Quick entry ticket */}
        <div style={{
          background: '#F7F5F1',
          color: '#2B2E33',
          borderRadius: 4,
          padding: '20px 18px',
          marginBottom: 24,
          borderLeft: '4px solid #E8A33D',
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => setMode('miles')}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 3, border: '1px solid #2B2E33',
                background: mode === 'miles' ? '#2B2E33' : 'transparent',
                color: mode === 'miles' ? '#F7F5F1' : '#2B2E33',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              Total miles
            </button>
            <button
              onClick={() => setMode('odometer')}
              style={{
                flex: 1, padding: '8px 0', fontSize: 13, borderRadius: 3, border: '1px solid #2B2E33',
                background: mode === 'odometer' ? '#2B2E33' : 'transparent',
                color: mode === 'odometer' ? '#F7F5F1' : '#2B2E33',
                cursor: 'pointer', fontWeight: 500,
              }}
            >
              Odometer start/end
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Purpose</label>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={inputStyle}>
                {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {purpose === 'Other' && (
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Describe purpose</label>
              <input
                type="text"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                placeholder="e.g. Bank deposit"
                style={inputStyle}
              />
            </div>
          )}

          {mode === 'miles' ? (
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Miles</label>
              <input
                type="number"
                inputMode="decimal"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                placeholder="0.0"
                style={{ ...inputStyle, ...mono, fontSize: 18 }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Odometer start</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={odoStart}
                  onChange={(e) => setOdoStart(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, ...mono }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Odometer end</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={odoEnd}
                  onChange={(e) => setOdoEnd(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, ...mono }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>From (optional)</label>
              <input type="text" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Home" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>To (optional)</label>
              <input type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder="USPS" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reconstructed from PirateShip label date"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#B23A2E', marginBottom: 10 }}>{error}</div>
          )}

          <button
            onClick={addTrip}
            style={{
              width: '100%', padding: '12px 0', background: '#E8A33D', color: '#2B2E33',
              border: 'none', borderRadius: 3, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Log trip
          </button>
        </div>

        {/* Totals bar */}
        {loaded && entries.length > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            padding: '14px 4px', marginBottom: 8, borderBottom: '1px solid #40454C',
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#8A9099', marginBottom: 2 }}>
                {filterYear === 'all' ? 'All time' : filterYear} · {totals.count} trip{totals.count === 1 ? '' : 's'}
              </div>
              <div style={{ ...mono, fontSize: 24, fontWeight: 600 }}>
                {totals.totalMiles.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 400, color: '#8A9099' }}>mi</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#8A9099', marginBottom: 2 }}>Est. deduction</div>
              <div style={{ ...mono, fontSize: 20, color: '#E8A33D', fontWeight: 600 }}>
                ${totals.deduction.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {loaded && entries.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{ ...inputStyle, background: '#2B2E33', color: '#F7F5F1', border: '1px solid #40454C', width: 'auto', padding: '6px 10px', fontSize: 13 }}
            >
              <option value="all">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={exportCSV}
              style={{
                marginLeft: 'auto', fontSize: 13, padding: '6px 12px', background: 'transparent',
                color: '#E8A33D', border: '1px solid #E8A33D', borderRadius: 3, cursor: 'pointer',
              }}
            >
              Export CSV
            </button>
          </div>
        )}

        {/* By purpose */}
        {loaded && byPurpose.length > 0 && (
          <div style={{ fontSize: 12, color: '#8A9099', margin: '10px 4px 18px', lineHeight: 1.6 }}>
            {byPurpose.map(([p, m]) => (
              <span key={p} style={{ marginRight: 14 }}>
                {p}: <span style={mono}>{m.toFixed(1)}</span> mi
              </span>
            ))}
          </div>
        )}

        {/* Entry list */}
        <div>
          {!loaded && (
            <div style={{ color: '#8A9099', fontSize: 14, padding: '20px 4px' }}>Loading log…</div>
          )}
          {loaded && filtered.length === 0 && (
            <div style={{ color: '#8A9099', fontSize: 14, padding: '20px 4px', borderTop: '1px dashed #40454C' }}>
              No trips logged yet. Add your first one above — or backfill trips you can reconstruct from shipping dates, card show dates, or receipts.
            </div>
          )}
          {filtered.map((e) => (
            <div key={e.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '12px 4px', borderTop: '1px dashed #40454C', gap: 10,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#8A9099', ...mono }}>{e.date}</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{e.purpose}</div>
                {(e.from || e.to) && (
                  <div style={{ fontSize: 13, color: '#B7BCC3' }}>
                    {e.from || '—'} → {e.to || '—'}
                  </div>
                )}
                {e.notes && (
                  <div style={{ fontSize: 12, color: '#8A9099', marginTop: 2, fontStyle: 'italic' }}>{e.notes}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ ...mono, fontSize: 16, fontWeight: 600 }}>{e.miles.toFixed(1)} mi</div>
                <button
                  onClick={() => deleteTrip(e.id)}
                  aria-label="Delete trip"
                  style={{
                    background: 'transparent', border: 'none', color: '#8A9099', cursor: 'pointer',
                    fontSize: 16, padding: 4, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#63686F', marginTop: 28, lineHeight: 1.6 }}>
          Rate shown uses the {RATE_2026 * 100}¢/mile 2026 IRS standard mileage rate — confirm the final rate at filing. This log stays on this device/session; export CSV regularly to keep your own copy.
          {saving && ' Saving…'}
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: 11, color: '#6B7178', marginBottom: 4, fontWeight: 500,
};

const inputStyle = {
  width: '100%', padding: '9px 10px', fontSize: 14, border: '1px solid #D8D4CB',
  borderRadius: 3, background: '#FFFFFF', color: '#2B2E33', boxSizing: 'border-box',
};
