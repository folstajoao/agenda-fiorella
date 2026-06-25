// lib/utils.js

function toDateStr(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (s.includes('T')) return s.split('T')[0];
  return s;
}

export function formatDate(dateStr) {
  const s = toDateStr(dateStr);
  if (!s) return '';
  const [year, month, day] = s.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  const s = toDateStr(dateStr);
  if (!s) return '';
  const [year, month, day] = s.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function generateToken() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function buildWhatsAppUrl(phone, message) {
  const clean = String(phone).replace(/\D/g, '');
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function getStatusLabel(status) {
  const map = {
    pending:   { label: 'Aguardando',  color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    confirmed: { label: 'Confirmado',  color: 'text-green-600 bg-green-50 border-green-200' },
    refused:   { label: 'Recusado',    color: 'text-red-600 bg-red-50 border-red-200' },
    cancelled: { label: 'Cancelado',   color: 'text-gray-500 bg-gray-50 border-gray-200' },
  };
  return map[status] || map.pending;
}

export function getDayOfWeek(dateStr) {
  const s = toDateStr(dateStr);
  if (!s) return 0;
  const [year, month, day] = s.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day)).getDay();
}
