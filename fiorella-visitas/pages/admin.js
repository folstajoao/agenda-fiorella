import { useState, useEffect } from 'react';
import Head from 'next/head';
import { formatDate, formatDateShort, getTodayStr, getDayOfWeek, getStatusLabel } from '../lib/utils';

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

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [tab, setTab] = useState('bookings'); // bookings | config
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [actionNote, setActionNote] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState('');
  const [blockedDates, setBlockedDates] = useState([]);

  // Check session storage for auth
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('fiorella_admin_authed');
      if (stored === 'true') setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) {
      loadConfig();
      loadBookings(selectedDate);
    }
  }, [authed]);

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
    const r = await apiCall('getConfig');
    if (r.success) {
      setConfig(r.data);
      setBlockedDates(r.data.blockedDates || []);
    }
  };

  const loadBookings = async (date) => {
    setLoading(true);
    const r = await apiCall('getAdminBookings', { date });
    if (r.success) setBookings(r.bookings);
    setLoading(false);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    loadBookings(date);
  };

  const handleAction = async (bookingId, action) => {
    setProcessingId(bookingId);
    const note = actionNote[bookingId] || '';
    const r = await apiCall('adminAction', { bookingId, action, note });
    if (r.success) {
      showMessage(action === 'confirm' ? '✅ Visita confirmada!' : '❌ Visita recusada.');
      loadBookings(selectedDate);
    } else {
      showMessage('Erro ao processar. Tente novamente.');
    }
    setProcessingId(null);
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const toggleWeekday = async (dow) => {
    if (!config) return;
    const current = config.blockedWeekdays || [];
    const updated = current.includes(dow)
      ? current.filter(d => d !== dow)
      : [...current, dow];
    const newConfig = { ...config, blockedWeekdays: updated };
    setConfig(newConfig);
    await apiCall('updateConfig', { blockedWeekdays: updated });
  };

  const toggleDateBlocked = async (date) => {
    const isBlocked = blockedDates.includes(date);
    const updated = isBlocked
      ? blockedDates.filter(d => d !== date)
      : [...blockedDates, date];
    setBlockedDates(updated);
    await apiCall('updateConfig', { blockedDates: updated });
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    const r = await apiCall('updateConfig', config);
    if (r.success) showMessage('✅ Configurações salvas!');
    else showMessage('Erro ao salvar.');
    setSavingConfig(false);
  };

  const getDatesForConfig = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dates.push(str);
    }
    return dates;
  };

  const whatsappUrl = (phone, booking) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    const msg = `Olá ${booking.name}! 🌸 Sua visita para a Fiorella foi confirmada!\n\n📅 ${formatDateShort(booking.date)} às ${booking.slot}\n👶 ${booking.guests} pessoa(s)\n\nNos vemos em breve! 💕`;
    return `https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`;
  };

  // PIN SCREEN
  if (!authed) {
    return (
      <>
        <Head><title>Admin — Fiorella 🌸</title></Head>
        <div className="min-h-screen bg-cream flex items-center justify-center px-4">
          <div className="card w-full max-w-sm text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="font-display text-xl text-gray-700 mb-2">Área dos papais</h1>
            <p className="text-gray-400 text-sm mb-6">Digite o PIN de acesso</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              className="input-field text-center text-2xl tracking-widest mb-2"
              placeholder="••••"
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePin()}
            />
            {pinError && <p className="text-red-500 text-sm mb-3">{pinError}</p>}
            <button onClick={handlePin} className="btn-primary w-full mt-2">
              Entrar
            </button>
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
            <button
              onClick={() => { sessionStorage.removeItem('fiorella_admin_authed'); setAuthed(false); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Sair
            </button>
          </div>
          {/* Tabs */}
          <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-3">
            {[
              { id: 'bookings', label: '📅 Agendamentos' },
              { id: 'config', label: '⚙️ Configurações' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id ? 'bg-rose-400 text-white' : 'text-gray-500 hover:bg-rose-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-2xl shadow-lg z-50 text-sm">
            {message}
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* BOOKINGS TAB */}
          {tab === 'bookings' && (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <input
                  type="date"
                  className="input-field flex-1"
                  value={selectedDate}
                  onChange={e => handleDateChange(e.target.value)}
                />
                <button onClick={() => loadBookings(selectedDate)} className="btn-secondary whitespace-nowrap">
                  🔄 Atualizar
                </button>
              </div>

              {loading ? (
                <div className="text-center text-rose-400 py-12">Carregando...</div>
              ) : bookings.length === 0 ? (
                <div className="card text-center text-gray-400">
                  <div className="text-3xl mb-2">📭</div>
                  <p>Nenhum agendamento neste dia.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map(b => {
                    const status = getStatusLabel(b.status);
                    return (
                      <div key={b.id} className="card">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-bold text-gray-700 text-lg">{b.slot}</div>
                            <div className="text-gray-600 font-semibold">{b.name}</div>
                            <div className="text-gray-400 text-sm">{b.guests} pessoa(s) · {b.phone}</div>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${status.color}`}>
                            {status.label}
                          </span>
                        </div>

                        {b.notes && (
                          <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-500 mb-3">
                            💬 {b.notes}
                          </div>
                        )}

                        {b.adminNote && (
                          <div className="bg-rose-50 rounded-xl px-3 py-2 text-sm text-rose-500 mb-3">
                            📝 Obs: {b.adminNote}
                          </div>
                        )}

                        {b.status === 'pending' && (
                          <div className="space-y-3">
                            <input
                              className="input-field text-sm"
                              placeholder="Observação para a visita (opcional)"
                              value={actionNote[b.id] || ''}
                              onChange={e => setActionNote(n => ({ ...n, [b.id]: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAction(b.id, 'confirm')}
                                disabled={processingId === b.id}
                                className="flex-1 bg-sage-100 hover:bg-sage-200 text-sage-600 font-semibold py-2 px-4 rounded-xl transition-all text-sm"
                              >
                                ✅ Confirmar
                              </button>
                              <button
                                onClick={() => handleAction(b.id, 'refuse')}
                                disabled={processingId === b.id}
                                className="flex-1 btn-danger text-sm"
                              >
                                ❌ Recusar
                              </button>
                              {b.phone && (
                                <a
                                  href={whatsappUrl(b.phone, b)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-green-100 hover:bg-green-200 text-green-600 font-semibold py-2 px-3 rounded-xl transition-all text-sm flex items-center"
                                >
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {b.status === 'confirmed' && b.phone && (
                          <a
                            href={whatsappUrl(b.phone, b)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-600 font-semibold py-2 px-4 rounded-xl transition-all text-sm w-full mt-2"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Avisar confirmação no WhatsApp
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CONFIG TAB */}
          {tab === 'config' && config && (
            <div className="space-y-6">

              {/* Welcome message */}
              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">💬 Mensagem de boas-vindas</h3>
                <input
                  className="input-field"
                  placeholder="Ex: Bem-vindos para conhecer a Fiorella! 💕"
                  value={config.welcomeMessage || ''}
                  onChange={e => setConfig(c => ({ ...c, welcomeMessage: e.target.value }))}
                />
              </div>

              {/* Horários */}
              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">🕐 Horários de atendimento</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Início</label>
                    <input type="time" className="input-field" value={config.startTime || '09:00'} onChange={e => setConfig(c => ({ ...c, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Fim</label>
                    <input type="time" className="input-field" value={config.endTime || '20:00'} onChange={e => setConfig(c => ({ ...c, endTime: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Duração (min)</label>
                    <input type="number" className="input-field" value={config.slotDuration || 25} onChange={e => setConfig(c => ({ ...c, slotDuration: parseInt(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Intervalo entre visitas (min)</label>
                    <input type="number" className="input-field" value={config.slotBreak || 5} onChange={e => setConfig(c => ({ ...c, slotBreak: parseInt(e.target.value) }))} />
                  </div>
                </div>
              </div>

              {/* Limite diário */}
              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">📊 Limite de visitas por dia</h3>
                <input type="number" min={1} max={20} className="input-field" value={config.maxPerDay || 5} onChange={e => setConfig(c => ({ ...c, maxPerDay: parseInt(e.target.value) }))} />
              </div>

              {/* WhatsApp */}
              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">📱 WhatsApp dos papais</h3>
                <input
                  className="input-field"
                  placeholder="(11) 99999-9999 (sem o +55)"
                  value={config.adminPhone || ''}
                  onChange={e => setConfig(c => ({ ...c, adminPhone: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Este número aparece no botão WhatsApp para os visitantes</p>
              </div>

              {/* Dias da semana bloqueados */}
              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">🗓️ Dias da semana — bloquear/liberar</h3>
                <div className="grid grid-cols-4 gap-2">
                  {DAY_NAMES.map((name, dow) => {
                    const blocked = (config.blockedWeekdays || []).includes(dow);
                    return (
                      <button
                        key={dow}
                        onClick={() => toggleWeekday(dow)}
                        className={`py-2 px-1 rounded-xl text-xs font-semibold border-2 transition-all ${
                          blocked
                            ? 'bg-red-100 border-red-300 text-red-500'
                            : 'bg-green-50 border-green-300 text-green-600'
                        }`}
                      >
                        {name.slice(0,3)}
                        <div className="text-lg mt-0.5">{blocked ? '🚫' : '✅'}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Datas específicas bloqueadas */}
              <div className="card">
                <h3 className="font-display text-gray-700 font-semibold mb-3">📅 Bloquear/liberar datas específicas</h3>
                <p className="text-xs text-gray-400 mb-3">Toque na data para bloquear ou liberar</p>
                <div className="grid grid-cols-3 gap-2">
                  {getDatesForConfig().map(date => {
                    const blocked = blockedDates.includes(date);
                    const [y,m,d] = date.split('-');
                    const dt = new Date(y, m-1, d);
                    const dayName = DAY_NAMES[dt.getDay()].slice(0,3);
                    return (
                      <button
                        key={date}
                        onClick={() => toggleDateBlocked(date)}
                        className={`py-2 px-1 rounded-xl text-xs font-medium border-2 transition-all text-center ${
                          blocked
                            ? 'bg-red-100 border-red-300 text-red-500'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-rose-300'
                        }`}
                      >
                        <div className="text-gray-400">{dayName}</div>
                        <div className="font-bold text-sm">{d}/{m}</div>
                        {blocked && <div className="text-xs">🚫</div>}
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
