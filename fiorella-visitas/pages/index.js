import { useState, useEffect } from 'react';
import Head from 'next/head';

const SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

async function apiCall(action, payload = {}) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...payload }),
    redirect: 'follow',
  });
  return res.json();
}

// Safe date helpers — never crash
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

function formatDatePtBR(ymd) {
  const s = toYMD(ymd);
  if (!s || !s.includes('-')) return s;
  const [y, m, d] = s.split('-');
  const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const DAYS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  try {
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return `${DAYS[dt.getDay()]}, ${d} de ${MONTHS[Number(m)-1]} de ${y}`;
  } catch(e) {
    return s;
  }
}

function formatShort(ymd) {
  const s = toYMD(ymd);
  if (!s || !s.includes('-')) return s;
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function getDOW(ymd) {
  const s = toYMD(ymd);
  if (!s || !s.includes('-')) return -1;
  const [y, m, d] = s.split('-');
  try {
    return new Date(Number(y), Number(m) - 1, Number(d)).getDay();
  } catch(e) { return -1; }
}

function getTodayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNextDates(n) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + i);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }
  return dates;
}

const DAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTH_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export default function Home() {
  const [step, setStep] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [slots, setSlots] = useState([]);
  const [config, setConfig] = useState({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', guests: 1, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [cancelToken, setCancelToken] = useState('');
  const [cancelResult, setCancelResult] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState('');

  const [calPage, setCalPage] = useState(0);
  const DATES_ALL = getNextDates(28); // 4 pages x 7 days
  const dates = DATES_ALL.slice(calPage * 7, calPage * 7 + 7);

  useEffect(() => {
    apiCall('getConfig').then(r => {
      if (r && r.success && r.data) setConfig(r.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('cancel');
    if (token) { setCancelToken(token); setStep('cancel'); }
  }, []);

  const isBlocked = (ymd) => {
    const dow = getDOW(ymd);
    const blockedDays = Array.isArray(config.blockedWeekdays) ? config.blockedWeekdays : [];
    if (blockedDays.includes(dow)) return true;
    const blockedDates = Array.isArray(config.blockedDates) ? config.blockedDates : [];
    return blockedDates.map(toYMD).includes(toYMD(ymd));
  };

  const selectDate = async (ymd) => {
    setSelectedDate(ymd);
    setLoadingSlots(true);
    setError('');
    try {
      const r = await apiCall('getSlots', { date: ymd });
      if (r && r.success) {
        setSlots(r.slots || []);
        setStep('slots');
      } else {
        setError((r && r.message) || 'Erro ao carregar horários');
      }
    } catch { setError('Erro de conexão. Tente novamente.'); }
    setLoadingSlots(false);
  };

  const submit = async () => {
    if (!form.name.trim()) { setError('Por favor, informe seu nome.'); return; }
    if (!form.phone.trim()) { setError('Por favor, informe seu WhatsApp.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const r = await apiCall('createBooking', {
        date: selectedDate,
        slot: selectedSlot,
        name: form.name.trim(),
        phone: form.phone.trim(),
        guests: form.guests,
        notes: form.notes.trim(),
      });
      if (r && r.success) {
        setBooking(r.booking);
        setStep('success');
      } else {
        setError((r && r.message) || 'Não foi possível agendar. Tente outro horário.');
      }
    } catch { setError('Erro de conexão. Tente novamente.'); }
    setSubmitting(false);
  };

  const doCancel = async () => {
    setCancelLoading(true);
    try {
      const r = await apiCall('cancelBooking', { cancelToken });
      setCancelResult(r);
    } catch { setCancelResult({ success: false, message: 'Erro de conexão.' }); }
    setCancelLoading(false);
  };

  const bookingDate = booking ? toYMD(safeStr(booking.date)) : '';
  const cancelUrl = booking
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}?cancel=${safeStr(booking.cancelToken)}`
    : '';

  const adminPhone = safeStr(config.adminPhone);
  const whatsappHref = booking && adminPhone ? (() => {
    const clean = adminPhone.replace(/\D/g, '');
    const msg = `Olá! Acabei de agendar uma visita para conhecer a Fiorella 🌸\n\n👤 ${safeStr(booking.name)}\n📅 ${formatShort(bookingDate)}\n🕐 ${safeStr(booking.slot)}\n👥 ${booking.guests} pessoa(s)\n\n---\nGuarde este link para cancelar se precisar: ${cancelUrl}`;
    return `https://wa.me/55${clean}?text=${encodeURIComponent(msg)}`;
  })() : null;

  return (
    <>
      <Head>
        <title>Visitas para Fiorella 🌸</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-cream">
        <div className="bg-white border-b border-rose-100 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-6 text-center">
            <div className="text-4xl mb-2">🌸</div>
            <h1 className="font-display text-2xl text-rose-500 font-bold">Fiorella chegou!</h1>
            <p className="text-gray-500 text-sm mt-1">
              {safeStr(config.welcomeMessage) || 'Agende sua visita para nos conhecer 💕'}
            </p>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6">

          {/* CANCEL */}
          {step === 'cancel' && (
            <div className="card text-center">
              <div className="text-3xl mb-4">🗓️</div>
              <h2 className="font-display text-xl text-gray-700 mb-2">Cancelar visita</h2>
              {!cancelResult ? (
                <>
                  <p className="text-gray-500 mb-6">Deseja cancelar sua visita agendada?</p>
                  <button onClick={doCancel} disabled={cancelLoading} className="btn-danger w-full">
                    {cancelLoading ? 'Cancelando...' : 'Sim, cancelar minha visita'}
                  </button>
                  <button onClick={() => { setStep('calendar'); setCancelToken(''); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/'); }} className="btn-secondary w-full mt-3">
                    Voltar
                  </button>
                </>
              ) : cancelResult.success ? (
                <div>
                  <div className="text-3xl mb-3">✅</div>
                  <p className="text-green-600 font-semibold">Visita cancelada com sucesso.</p>
                  <button onClick={() => { setStep('calendar'); setCancelToken(''); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/'); }} className="btn-primary w-full mt-4">
                    Ver outros horários
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-red-500">{safeStr(cancelResult.message) || 'Não foi possível cancelar.'}</p>
                  <button onClick={() => { setStep('calendar'); setCancelToken(''); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/'); }} className="btn-secondary w-full mt-4">Voltar</button>
                </div>
              )}
            </div>
          )}

          {/* CALENDAR */}
          {step === 'calendar' && (
            <div>
              {/* Page navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalPage(p => Math.max(0, p - 1))}
                  disabled={calPage === 0}
                  className={`flex items-center gap-1 px-4 py-2 rounded-2xl font-semibold text-sm transition-all ${calPage === 0 ? 'opacity-30 cursor-not-allowed text-gray-400' : 'text-rose-400 hover:bg-rose-50 active:scale-95'}`}
                >
                  ← Anterior
                </button>
                <span className="text-xs text-gray-400">
                  Semana {calPage + 1} de 4
                </span>
                <button
                  onClick={() => setCalPage(p => Math.min(3, p + 1))}
                  disabled={calPage === 3}
                  className={`flex items-center gap-1 px-4 py-2 rounded-2xl font-semibold text-sm transition-all ${calPage === 3 ? 'opacity-30 cursor-not-allowed text-gray-400' : 'text-rose-400 hover:bg-rose-50 active:scale-95'}`}
                >
                  Próxima →
                </button>
              </div>

              {/* Date grid */}
              <div className="grid grid-cols-2 gap-3">
                {dates.map(ymd => {
                  const blocked = isBlocked(ymd);
                  const dow = getDOW(ymd);
                  const parts = ymd.split('-');
                  const d = parts[2];
                  const m = Number(parts[1]) - 1;
                  return (
                    <button key={ymd} onClick={() => !blocked && !loadingSlots && selectDate(ymd)} disabled={blocked || loadingSlots}
                      className={`card text-left transition-all duration-200 ${blocked ? 'opacity-40 cursor-not-allowed' : 'hover:border-rose-300 hover:shadow-md active:scale-95 cursor-pointer'}`}>
                      <div className="text-xs text-gray-400 uppercase tracking-wide">{DAY_SHORT[dow]}</div>
                      <div className="text-2xl font-bold text-gray-700">{d}</div>
                      <div className="text-sm text-gray-500">{MONTH_SHORT[m]}</div>
                      {blocked && <div className="text-xs text-red-400 mt-1">Indisponível</div>}
                    </button>
                  );
                })}
              </div>

              {/* Dot indicators */}
              <div className="flex justify-center gap-2 mt-5">
                {[0,1,2,3].map(i => (
                  <button key={i} onClick={() => setCalPage(i)}
                    className={`w-2 h-2 rounded-full transition-all ${calPage === i ? 'bg-rose-400 w-4' : 'bg-rose-200'}`} />
                ))}
              </div>

              {loadingSlots && <p className="text-center text-rose-400 mt-4">Carregando horários...</p>}
              {error && <p className="text-red-500 text-center mt-4">{error}</p>}
            </div>
          )}

          {/* SLOTS */}
          {step === 'slots' && (
            <div>
              <button onClick={() => setStep('calendar')} className="flex items-center text-rose-400 mb-4 hover:text-rose-600">← Voltar</button>
              <h2 className="font-display text-lg text-gray-600 mb-1">Horários disponíveis</h2>
              <p className="text-sm text-gray-400 mb-4 capitalize">{formatDatePtBR(selectedDate)}</p>
              {slots.length === 0 ? (
                <div className="card text-center text-gray-400">
                  <div className="text-3xl mb-2">😔</div>
                  <p>Nenhum horário disponível neste dia.</p>
                  <button onClick={() => setStep('calendar')} className="btn-secondary mt-4">Escolher outro dia</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {slots.map(slot => (
                    <button key={safeStr(slot.time)} onClick={() => slot.available && (setSelectedSlot(safeStr(slot.time)), setStep('form'))} disabled={!slot.available}
                      className={`card text-center py-4 transition-all duration-200 ${slot.available ? 'hover:border-rose-300 hover:shadow-md active:scale-95 cursor-pointer' : 'opacity-40 cursor-not-allowed bg-gray-50'}`}>
                      <div className="text-xl font-bold text-gray-700">{safeStr(slot.time)}</div>
                      <div className={`text-xs mt-1 font-medium ${slot.available ? 'text-green-500' : 'text-red-400'}`}>{slot.available ? 'Disponível' : 'Ocupado'}</div>
                      {slot.available && <div className="text-xs text-gray-400 mt-1">25 min</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FORM */}
          {step === 'form' && (
            <div>
              <button onClick={() => { setStep('slots'); setError(''); }} className="flex items-center text-rose-400 mb-4 hover:text-rose-600">← Voltar</button>
              <div className="card mb-4 flex items-center gap-3">
                <div className="text-2xl">📅</div>
                <div>
                  <div className="font-semibold text-gray-700 capitalize">{formatDatePtBR(selectedDate)}</div>
                  <div className="text-rose-500 font-bold">{selectedSlot} — 25 minutos</div>
                </div>
              </div>
              <div className="card">
                <h2 className="font-display text-lg text-gray-700 mb-4">Seus dados</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Nome completo *</label>
                    <input className="input-field" placeholder="Seu nome" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">WhatsApp *</label>
                    <input className="input-field" placeholder="(11) 99999-9999" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} type="tel" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Quantas pessoas virão? (máx. 4) *</label>
                    <div className="flex gap-2">
                      {[1,2,3,4].map(n => (
                        <button key={n} onClick={() => setForm(f => ({...f, guests: n}))}
                          className={`flex-1 py-3 rounded-2xl font-bold text-lg border-2 transition-all ${form.guests === n ? 'bg-rose-400 text-white border-rose-400' : 'bg-white text-gray-600 border-rose-200 hover:border-rose-300'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Observações (opcional)</label>
                    <textarea className="input-field resize-none" rows={3} placeholder="Alguma informação importante?" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
                <button onClick={submit} disabled={submitting} className="btn-primary w-full mt-6">
                  {submitting ? 'Agendando...' : '🌸 Confirmar visita'}
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS */}
          {step === 'success' && booking && (
            <div className="card text-center">
              <div className="text-5xl mb-4">🌸</div>
              <h2 className="font-display text-2xl text-rose-500 mb-2">Visita solicitada!</h2>
              <p className="text-gray-500 mb-6">Aguarde a confirmação dos papais da Fiorella. Você receberá uma resposta em breve!</p>
              <div className="bg-petal rounded-2xl p-4 text-left space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Data</span>
                  <span className="font-semibold text-gray-700 text-sm capitalize">{formatDatePtBR(bookingDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Horário</span>
                  <span className="font-semibold text-gray-700 text-sm">{safeStr(booking.slot)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Duração</span>
                  <span className="font-semibold text-gray-700 text-sm">25 minutos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Pessoas</span>
                  <span className="font-semibold text-gray-700 text-sm">{booking.guests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Status</span>
                  <span className="font-semibold text-yellow-600 text-sm">Aguardando confirmação</span>
                </div>
              </div>
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all w-full mb-3">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Avisar pelo WhatsApp
                </a>
              )}
              <button onClick={() => { setStep('calendar'); setBooking(null); setForm({ name: '', phone: '', guests: 1, notes: '' }); }} className="btn-secondary w-full mt-2">
                Voltar ao início
              </button>
            </div>
          )}
        </div>
        <div className="text-center py-6 text-xs text-gray-300">Feito com 💕 para a Fiorella</div>
      </div>
    </>
  );
}
