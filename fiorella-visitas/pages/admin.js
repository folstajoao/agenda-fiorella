import { useState, useEffect } from 'react';
import Head from 'next/head';

const SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234';

async function apiCall(action, payload = {}) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...payload }),
    redirect: 'follow',
  });
  return res.json();
}

function safeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function toYMD(val) {
  const s = safeStr(val);
  if (!s) return '';
  if (s.includes('T')) return s.split('T')[0];
  return s;
}

function formatShort(ymd) {
  const s = toYMD(ymd);
  if (!s || !s.includes('-')) return s;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function getTodayYMD() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function getNextDates(n) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + i);
    dates.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
  }
  return dates;
}

const DAY_NAMES = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const DAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function statusBadge(status) {
  const map = {
    pending:   { label: 'Aguardando',  cls: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    confirmed: { label: 'Confirmado',  cls: 'text-green-600 bg-green-50 border-green-200' },
    refused:   { label: 'Recusado',    cls: 'text-red-600 bg-red-50 border-red-200' },
    cancelled: { label: 'Cancelado',   cls: 'text-gray-500 bg-gray-50 border-gray-200' },
  };
  return map[status] || map.pending;
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [tab, setTab] = useState('bookings');
  const [selectedDate, setSelectedDate] = useState(getTodayYMD());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    welcomeMessage: '',
    startTime: '09:00',
    endTime: '20:00',
    slotDuration: 25,
    slotBreak: 5,
    maxPerDay: 5,
    adminPhone: '',
    blockedWeekdays: [],
    blockedDates: [],
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [actionNote, setActionNote] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('fiorella_admin_authed') === 'true') setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      loadConfig();
      loadBookings('');
    }
  }, [authed]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handlePin = () => {
    if (pin === ADMIN_PIN) {
      setAuthed(true);
      sessionStorage.setItem('fiorella_admin_authed', 'true');
    } else {
      setPinError('PIN incorreto. Tente novamente.');
      setPin('');
    }
  };

  const loadConfig = async () => {
    try {
      const r = await apiCall('getConfig');
      if (r && r.success && r.data) {
        setConfig(prev => ({
          ...prev,
          welcomeMessage: safeStr(r.data.welcomeMessage),
          startTime: safeStr(r.data.startTime) || '09:00',
          endTime: safeStr(r.data.endTime) || '20:00',
          slotDuration: Number(r.data.slotDuration) || 25,
          slotBreak: Number(r.data.slotBreak) || 5,
          maxPerDay: Number(r.data.maxPerDay) || 5,
          adminPhone: safeStr(r.data.adminPhone),
          blockedWeekdays: Array.isArray(r.data.blockedWeekdays) ? r.data.blockedWeekdays.map(Number) : [],
          blockedDates: Array.isArray(r.data.blockedDates) ? r.data.blockedDates.map(toYMD) : [],
        }));
      }
    } catch(e) { showToast('Erro ao carregar configurações'); }
  };

  const fixSlot = (val) => {
    if (!val) return '';
    const s = String(val);
    // If it's a full ISO date string like 1899-12-30T13:26:28.000Z, extract HH:MM
    if (s.includes('T')) {
      const timePart = s.split('T')[1] || '';
      const [h, m] = timePart.split(':');
      return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    }
    return s;
  };

  const loadBookings = async (date) => {
    setLoading(true);
    try {
      const r = await apiCall('getAdminBookings', { date: date || '' });
      if (r && r.success) {
        setBookings((r.bookings || []).map(b => ({
          ...b,
          date: toYMD(b.date),
          slot: fixSlot(b.slot),
          name: safeStr(b.name),
          phone: safeStr(b.phone),
          status: safeStr(b.status) || 'pending',
          adminNote: safeStr(b.adminNote),
          notes: safeStr(b.notes),
        })));
      }
    } catch(e) { showToast('Erro ao carregar agendamentos'); }
    setLoading(false);
  };

  const handleAction = async (bookingId, action) => {
    setProcessingId(bookingId);
    try {
      const note = safeStr(actionNote[bookingId]);
      const r = await apiCall('adminAction', { bookingId, adminAction: action, note });
      if (r && r.success) {
        showToast(action === 'confirm' ? '✅ Visita confirmada!' : '❌ Visita recusada.');
        loadBookings(selectedDate);
      } else {
        showToast('Erro ao processar. Tente novamente.');
      }
    } catch(e) { showToast('Erro de conexão.'); }
    setProcessingId(null);
  };

  const toggleWeekday = async (dow) => {
    const current = Array.isArray(config.blockedWeekdays) ? config.blockedWeekdays : [];
    const updated = current.includes(dow) ? current.filter(d => d !== dow) : [...current, dow];
    setConfig(c => ({ ...c, blockedWeekdays: updated }));
    try {
      await apiCall('updateConfig', { blockedWeekdays: updated });
      showToast('Dia atualizado!');
    } catch(e) { showToast('Erro ao salvar.'); }
  };

  const toggleDateBlocked = async (date) => {
    const current = Array.isArray(config.blockedDates) ? config.blockedDates : [];
    const normalized = current.map(toYMD);
    const isBlocked = normalized.includes(date);
    const updated = isBlocked ? normalized.filter(d => d !== date) : [...normalized, date];
    setConfig(c => ({ ...c, blockedDates: updated }));
    try {
      await apiCall('updateConfig', { blockedDates: updated });
      showToast(isBlocked ? 'Data liberada!' : 'Data bloqueada!');
    } catch(e) { showToast('Erro ao salvar.'); }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const r = await apiCall('updateConfig', {
        welcomeMessage: config.welcomeMessage,
        startTime: config.startTime,
        endTime: config.endTime,
        slotDuration: config.slotDuration,
        slotBreak: config.slotBreak,
        maxPerDay: config.maxPerDay,
        adminPhone: config.adminPhone,
        blockedWeekdays: config.blockedWeekdays,
        blockedDates: config.blockedDates,
      });
      if (r && r.success) showToast('✅ Configurações salvas!');
      else showToast('Erro ao salvar.');
    } catch(e) { showToast('Erro de conexão.'); }
    setSavingConfig(false);
  };

  const whatsappConfirm = (b) => {
    const clean = safeStr(b.phone).replace(/\D/g,'');
    if (!clean) return null;
    const msg = `Olá ${b.name}! 🌸 Sua visita para a Fiorella foi confirmada!\n\n📅 ${formatShort(b.date)} às ${b.slot}\n👥 ${b.guests} pessoa(s)\n\nNos vemos em breve! 💕`;
    return `https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`;
  };

  // PIN screen
  if (!authed) {
    return (
      <>
        <Head><title>Admin — Fiorella 🌸</title></Head>
        <div className="min-h-screen bg-cream flex items-center justify-center px-4">
          <div className="card w-full max-w-sm text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="font-display text-xl text-gray-700 mb-2">Área dos papais</h1>
            <p className="text-gray-400 text-sm mb-6">Digite o PIN de acesso</p>
            <input type="password" inputMode="numeric" maxLength={4}
              className="input-field text-center text-2xl tracking-widest mb-2"
              placeholder="••••" value={pin}
              onChange={e => { setPin(e.target.value); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePin()} />
            {pinError && <p className="text-red-500 text-sm mb-3">{pinError}</p>}
            <button onClick={handlePin} className="btn-primary w-full mt-2">Entrar</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Admin — Fiorella 🌸</title></Head>
      <div className="min-h-screen bg-cream">

        {/* Header */}
        <div className="bg-white border-b border-rose-100 shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-lg text-rose-500 font-bold">🌸 Admin Fiorella</h1>
              <p className="text-xs text-gray-400">Painel dos papais</p>
            </div>
            <button onClick={() => { sessionStorage.removeItem('fiorella_admin_authed'); setAuthed(false); }} className="text-xs text-gray-400 hover:text-gray-600">Sair</button>
          </div>
          <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-3">
            {[{ id:'bookings', label:'📅 Agendamentos' }, { id:'config', label:'⚙️ Configurações' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-rose-400 text-white' : 'text-gray-500 hover:bg-rose-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-2xl shadow-lg z-50 text-sm whitespace-nowrap">
            {toast}
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* BOOKINGS */}
          {tab === 'bookings' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display text-gray-700 font-semibold">Pendentes de aprovação</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Toque para aprovar ou recusar</p>
                </div>
                <button onClick={() => loadBookings('')} className="btn-secondary text-sm whitespace-nowrap">🔄 Atualizar</button>
              </div>

              {loading ? (
                <div className="text-center text-rose-400 py-12">Carregando...</div>
              ) : bookings.filter(b => b.status === 'pending').length === 0 ? (
                <div className="card text-center text-gray-400">
                  <div className="text-3xl mb-2">✨</div>
                  <p>Nenhuma visita pendente!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.filter(b => b.status === 'pending').map(b => {
                    const waUrl = whatsappConfirm(b);
                    return (
                      <div key={safeStr(b.id)} className="card">
                        {/* Summary */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="bg-rose-100 rounded-2xl p-3 text-2xl">🌸</div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-700">{b.name}</div>
                            <div className="text-rose-500 font-semibold text-sm">{formatShort(b.date)} às {b.slot}</div>
                            <div className="text-gray-400 text-xs">{b.guests} pessoa(s) · {b.phone}</div>
                          </div>
                        </div>

                        {b.notes ? (
                          <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-500 mb-3">💬 {b.notes}</div>
                        ) : null}

                        <input className="input-field text-sm mb-3"
                          placeholder="Observação (opcional)"
                          value={safeStr(actionNote[b.id])}
                          onChange={e => setActionNote(n => ({ ...n, [b.id]: e.target.value }))} />

                        <div className="flex gap-2">
                          <button onClick={() => handleAction(b.id, 'confirm')} disabled={processingId === b.id}
                            className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 font-bold py-3 rounded-2xl transition-all text-sm active:scale-95">
                            ✅ Confirmar
                          </button>
                          <button onClick={() => handleAction(b.id, 'refuse')} disabled={processingId === b.id}
                            className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-3 rounded-2xl transition-all text-sm active:scale-95">
                            ❌ Recusar
                          </button>
                          {waUrl && (
                            <a href={waUrl} target="_blank" rel="noopener noreferrer"
                              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-3 rounded-2xl transition-all flex items-center active:scale-95">
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CONFIG */}
          {tab === 'config' && (
            <div className="space-y-6">

              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">💬 Mensagem de boas-vindas</h3>
                <input className="input-field" placeholder="Ex: Bem-vindos para conhecer a Fiorella! 💕"
                  value={config.welcomeMessage}
                  onChange={e => setConfig(c => ({ ...c, welcomeMessage: e.target.value }))} />
              </div>

              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">🕐 Horários de atendimento</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Início</label>
                    <input type="time" className="input-field" value={config.startTime}
                      onChange={e => setConfig(c => ({ ...c, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Fim</label>
                    <input type="time" className="input-field" value={config.endTime}
                      onChange={e => setConfig(c => ({ ...c, endTime: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Duração (min)</label>
                    <input type="number" className="input-field" value={config.slotDuration}
                      onChange={e => setConfig(c => ({ ...c, slotDuration: parseInt(e.target.value) || 25 }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Intervalo entre visitas (min)</label>
                    <input type="number" className="input-field" value={config.slotBreak}
                      onChange={e => setConfig(c => ({ ...c, slotBreak: parseInt(e.target.value) || 5 }))} />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">📊 Limite de visitas por dia</h3>
                <input type="number" min={1} max={20} className="input-field" value={config.maxPerDay}
                  onChange={e => setConfig(c => ({ ...c, maxPerDay: parseInt(e.target.value) || 5 }))} />
              </div>

              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">📱 WhatsApp dos papais</h3>
                <input className="input-field" placeholder="11999999999 (só números, sem +55)"
                  value={config.adminPhone}
                  onChange={e => setConfig(c => ({ ...c, adminPhone: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Aparece no botão WhatsApp para os visitantes</p>
              </div>

              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">🗓️ Dias da semana — bloquear/liberar</h3>
                <div className="grid grid-cols-4 gap-2">
                  {DAY_NAMES.map((name, dow) => {
                    const blocked = (config.blockedWeekdays || []).map(Number).includes(dow);
                    return (
                      <button key={dow} onClick={() => toggleWeekday(dow)}
                        className={`py-2 px-1 rounded-xl text-xs font-semibold border-2 transition-all ${blocked ? 'bg-red-100 border-red-300 text-red-500' : 'bg-green-50 border-green-300 text-green-600'}`}>
                        {DAY_SHORT[dow]}
                        <div className="text-lg mt-0.5">{blocked ? '🚫' : '✅'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">📅 Bloquear datas específicas</h3>
                <p className="text-xs text-gray-400 mb-3">Toque para bloquear ou liberar</p>
                <div className="grid grid-cols-4 gap-2">
                  {getNextDates(28).map(date => {
                    const blocked = (config.blockedDates || []).map(toYMD).includes(date);
                    const parts = date.split('-');
                    const d = parts[2];
                    const m = parts[1];
                    const dow = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2])).getDay();
                    return (
                      <button key={date} onClick={() => toggleDateBlocked(date)}
                        className={`py-2 px-1 rounded-xl text-xs font-medium border-2 transition-all text-center ${blocked ? 'bg-red-100 border-red-300 text-red-500' : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300'}`}>
                        <div className="text-gray-400 text-xs">{DAY_SHORT[dow]}</div>
                        <div className="font-bold">{d}/{m}</div>
                        {blocked && <div>🚫</div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={saveConfig} disabled={savingConfig} className="btn-primary w-full">
                {savingConfig ? 'Salvando...' : '💾 Salvar configurações'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
