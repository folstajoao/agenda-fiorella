// lib/sheets.js
// All interactions with Google Sheets via Apps Script Web App

const SCRIPT_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;

export async function sheetsRequest(action, payload = {}) {
  const url = `${SCRIPT_URL}?action=${action}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error('Falha ao conectar com o servidor');
  return res.json();
}

export async function getConfig() {
  return sheetsRequest('getConfig');
}

export async function getSlots(date) {
  return sheetsRequest('getSlots', { date });
}

export async function createBooking(data) {
  return sheetsRequest('createBooking', data);
}

export async function cancelBooking(cancelToken) {
  return sheetsRequest('cancelBooking', { cancelToken });
}

export async function getAdminBookings(date) {
  return sheetsRequest('getAdminBookings', { date });
}

export async function adminAction(bookingId, action, note = '') {
  return sheetsRequest('adminAction', { bookingId, action, note });
}

export async function setDayBlocked(date, blocked) {
  return sheetsRequest('setDayBlocked', { date, blocked });
}

export async function updateConfig(config) {
  return sheetsRequest('updateConfig', config);
}
