import { useState, useEffect } from 'react';
import Head from 'next/head';
import { getTodayStr, formatDate, formatDateShort, getDayOfWeek } from '../lib/utils';

const DAYS_AHEAD = 14;

function getDatesAhead(n) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dates.push(str);
  }
  return dates;
}

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

export default function Home() {
  const [step, setStep] = useState('calendar'); // calendar | slots | form | success | cancel
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', guests: 1, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);
  const [cancelToken, setCancelToken] = useState('');
  const [cancelResult, setCancelResult] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState('');

  const dates = getDatesAhead(DAYS_AHEAD);

  useEffect(() => {
    apiCall('getConfig').then(r => {
      if (r.success) setConfig(r.data);
    }).catch(() => {});
  }, []);

  // Check if arriving via cancel link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('cancel');
    if (token) {
      setCancelToken(token);
      setStep('cancel');
    }
  }, []);

  const selectDate = async (date) => {
    setSelectedDate(date);
    setLoadingSlots(true);
    setError('');
    try {
      const r = await apiCall('getSlots', { date });
      if (r.success) {
        setSlots(r.slots);
        setStep('slots');
      } else {
        setError(r.message || 'Erro ao carregar horários');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    }
    setLoadingSlots(false);
  };

  const selectSlot = (slot) => {
    setSelectedSlot(slot);
    setStep('form');
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
      if (r.success) {
        setBooking(r.booking);
        setStep('success');
      } else {
        setError(r.message || 'Não foi possível agendar. Tente outro horário.');
      }
    } catch {
      setError('Erro de conexão. Tente novamente.');
    }
    setSubmitting(false);
  };

  const doCancel = async () => {
    setCancelLoading(true);
    try {
      const r = await apiCall('cancelBooking', { cancelToken });
      setCancelResult(r);
    } catch {
      setCancelResult({ success: false, message: 'Erro de conexão.' });
    }
    setCancelLoading(false);
  };

  const isBlocked = (date) => {
    if (!config) return false;
    const dow = getDayOfWeek(date);
    const blockedDays = config.blockedWeekdays || [];
    if (blockedDays.includes(dow)) return true;
    const blockedDates = config.blockedDates || [];
    return blockedDates.includes(date);
  };

  const whatsappUrl = (adminPhone) => {
    if (!booking || !adminPhone) return null;
    const msg = `Olá! Acabei de agendar uma visita para a Fiorella 🌸\n\n👤 Nome: ${booking.name}\n📅 Data: ${formatDateShort(booking.date)}\n🕐 Horário: ${booking.slot}\n👶 Pessoas: ${booking.guests}`;
    return `https://wa.me/55${adminPhone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`;
  };

  const cancelUrl = booking ? `${typeof window !== 'undefined' ? window.location.origin : ''}?cancel=${booking.cancelToken}` : '';

  return (
    <>
      <Head>
        <title>Visitas para Fiorella 🌸</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Agende sua visita para conhecer a Fiorella!" />
      </Head>

      <div className="min-h-screen bg-cream">
        {/* Header */}
        <div className="bg-white border-b border-rose-100 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-6 text-center">
            <div className="text-4xl mb-2">🌸</div>
            <h1 className="font-display text-2xl text-rose-500 font-bold">
              Fiorella chegou!
            </h1>
            {config?.welcomeMessage && (
              <p className="text-gray-500 text-sm mt-1">{config.welcomeMessage}</p>
            )}
            {!config?.welcomeMessage && (
              <p className="text-gray-500 text-sm mt-1">
                Agende sua visita para nos conhecer 💕
              </p>
            )}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6">

          {/* CANCEL FLOW */}
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
                  <button onClick={() => { setStep('calendar'); setCancelToken(''); window.history.replaceState({}, '', '/'); }} className="btn-secondary w-full mt-3">
                    Voltar
                  </button>
                </>
              ) : cancelResult.success ? (
                <div>
                  <div className="text-3xl mb-3">✅</div>
                  <p className="text-green-600 font-semibold">Visita cancelada com sucesso.</p>
                  <button onClick={() => { setStep('calendar'); setCancelToken(''); window.history.replaceState({}, '', '/'); }} className="btn-primary w-full mt-4">
                    Ver outros horários
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-red-500">{cancelResult.message || 'Não foi possível cancelar.'}</p>
                  <button onClick={() => { setStep('calendar'); setCancelToken(''); window.history.replaceState({}, '', '/'); }} className="btn-secondary w-full mt-4">
                    Voltar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CALENDAR */}
          {step === 'calendar' && (
            <div>
              <h2 className="font-display text-lg text-gray-600 mb-4">Escolha um dia</h2>
              <div className="grid grid-cols-2 gap-3">
                {dates.map(date => {
                  const blocked = isBlocked(date);
                  const dow = getDayOfWeek(date);
                  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
                  const [y,m,d] = date.split('-');
                  return (
                    <button
                      key={date}
                      onClick={() => !blocked && selectDate(date)}
                      disabled={blocked || loadingSlots}
                      className={`card text-left transition-all duration-200 ${
                        blocked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:border-rose-300 hover:shadow-md active:scale-95 cursor-pointer'
                      }`}
                    >
                      <div className="text-xs text-gray-400 uppercase tracking-wide">{dayNames[dow]}</div>
                      <div className="text-2xl font-bold text-gray-700">{d}</div>
                      <div className="text-sm text-gray-500">{new Date(y, m-1, d).toLocaleDateString('pt-BR', { month: 'long' })}</div>
                      {blocked && <div className="text-xs text-red-400 mt-1">Indisponível</div>}
                    </button>
                  );
                })}
              </div>
              {loadingSlots && <p className="text-center text-rose-400 mt-4">Carregando horários...</p>}
              {error && <p className="text-red-500 text-center mt-4">{error}</p>}
            </div>
          )}

          {/* SLOTS */}
          {step === 'slots' && (
            <div>
              <button onClick={() => setStep('calendar')} className="flex items-center text-rose-400 mb-4 hover:text-rose-600">
                ← Voltar
              </button>
              <h2 className="font-display text-lg text-gray-600 mb-1">Horários disponíveis</h2>
              <p className="text-sm text-gray-400 mb-4 capitalize">{formatDate(selectedDate)}</p>
              {slots.length === 0 ? (
                <div className="card text-center text-gray-400">
                  <div className="text-3xl mb-2">😔</div>
                  <p>Nenhum horário disponível neste dia.</p>
                  <button onClick={() => setStep('calendar')} className="btn-secondary mt-4">Escolher outro dia</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {slots.map(slot => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && selectSlot(slot.time)}
                      disabled={!slot.available}
                      className={`card text-center py-4 transition-all duration-200 ${
                        slot.available
                          ? 'hover:border-rose-300 hover:shadow-md active:scale-95 cursor-pointer'
                          : 'opacity-40 cursor-not-allowed bg-gray-50'
                      }`}
                    >
                      <div className="text-xl font-bold text-gray-700">{slot.time}</div>
                      <div className={`text-xs mt-1 font-medium ${slot.available ? 'text-green-500' : 'text-red-400'}`}>
                        {slot.available ? 'Disponível' : 'Ocupado'}
                      </div>
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
              <button onClick={() => { setStep('slots'); setError(''); }} className="flex items-center text-rose-400 mb-4 hover:text-rose-600">
                ← Voltar
              </button>
              <div className="card mb-4 flex items-center gap-3">
                <div className="text-2xl">📅</div>
                <div>
                  <div className="font-semibold text-gray-700 capitalize">{formatDate(selectedDate)}</div>
                  <div className="text-rose-500 font-bold">{selectedSlot} — 25 minutos</div>
                </div>
              </div>

              <div className="card">
                <h2 className="font-display text-lg text-gray-700 mb-4">Seus dados</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Nome completo *</label>
                    <input
                      className="input-field"
                      placeholder="Seu nome"
                      value={form.name}
                      onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">WhatsApp *</label>
                    <input
                      className="input-field"
                      placeholder="(11) 99999-9999"
                      value={form.phone}
                      onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                      type="tel"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Quantas pessoas virão? (máx. 4) *</label>
                    <div className="flex gap-2">
                      {[1,2,3,4].map(n => (
                        <button
                          key={n}
                          onClick={() => setForm(f => ({...f, guests: n}))}
                          className={`flex-1 py-3 rounded-2xl font-bold text-lg border-2 transition-all ${
                            form.guests === n
                              ? 'bg-rose-400 text-white border-rose-400'
                              : 'bg-white text-gray-600 border-rose-200 hover:border-rose-300'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Observações (opcional)</label>
                    <textarea
                      className="input-field resize-none"
                      rows={3}
                      placeholder="Alguma informação importante?"
                      value={form.notes}
                      onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                    />
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

                <button
                  onClick={submit}
                  disabled={submitting}
                  className="btn-primary w-full mt-6"
                >
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
              <p className="text-gray-500 mb-6">
                Aguarde a confirmação dos papais da Fiorella. Você receberá uma resposta em breve!
              </p>

              <div className="bg-petal rounded-2xl p-4 text-left space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Data</span>
                  <span className="font-semibold text-gray-700 capitalize text-sm">{formatDate(booking.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Horário</span>
                  <span className="font-semibold text-gray-700 text-sm">{booking.slot}</span>
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

              {/* WhatsApp button */}
              {config?.adminPhone && (
                <a
                  href={whatsappUrl(config.adminPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md w-full mb-3"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Avisar pelo WhatsApp
                </a>
              )}

              <div className="bg-gray-50 rounded-2xl p-3 mb-4">
                <p className="text-xs text-gray-400 mb-1">Guarde este link para cancelar, se precisar:</p>
                <p className="text-xs text-rose-400 break-all font-mono">{cancelUrl}</p>
              </div>

              <button onClick={() => { setStep('calendar'); setBooking(null); setForm({ name: '', phone: '', guests: 1, notes: '' }); }} className="btn-secondary w-full">
                Voltar ao início
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="text-center py-6 text-xs text-gray-300">
          Feito com 💕 para a Fiorella
        </div>
      </div>
    </>
  );
}
