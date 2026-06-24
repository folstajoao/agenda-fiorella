// ============================================================
// FIORELLA VISITAS — Google Apps Script Backend
// Cole este código em: script.google.com → Novo projeto
// ============================================================

// ⚠️ CONFIGURE AQUI antes de publicar:
const SPREADSHEET_ID = 'COLE_O_ID_DA_SUA_PLANILHA_AQUI';

// ============================================================
// ESTRUTURA DA PLANILHA:
// Aba "bookings": id | date | slot | name | phone | guests | notes | status | adminNote | cancelToken | createdAt
// Aba "config":   key | value
// Aba "blockedDates": date
// ============================================================

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'bookings') {
      sheet.appendRow(['id','date','slot','name','phone','guests','notes','status','adminNote','cancelToken','createdAt']);
    } else if (name === 'config') {
      sheet.appendRow(['key','value']);
      // defaults
      sheet.appendRow(['welcomeMessage', 'Agende sua visita para conhecer a Fiorella! 💕']);
      sheet.appendRow(['startTime', '09:00']);
      sheet.appendRow(['endTime', '20:00']);
      sheet.appendRow(['slotDuration', '25']);
      sheet.appendRow(['slotBreak', '5']);
      sheet.appendRow(['maxPerDay', '5']);
      sheet.appendRow(['adminPhone', '']);
      sheet.appendRow(['blockedWeekdays', '0']); // Sunday blocked by default
    } else if (name === 'blockedDates') {
      sheet.appendRow(['date']);
    }
  }
  return sheet;
}

// ============================================================
// CORS + Router
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    let result;

    switch (action) {
      case 'getConfig':      result = getConfig(); break;
      case 'getSlots':       result = getSlots(body.date); break;
      case 'createBooking':  result = createBooking(body); break;
      case 'cancelBooking':  result = cancelBooking(body.cancelToken); break;
      case 'getAdminBookings': result = getAdminBookings(body.date); break;
      case 'adminAction':    result = adminAction(body.bookingId, body.action, body.note); break;
      case 'updateConfig':   result = updateConfig(body); break;
      default: result = { success: false, message: 'Ação desconhecida' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return doPost({ postData: { contents: JSON.stringify({ action: e.parameter.action || 'getConfig' }) } });
}

// ============================================================
// CONFIG
// ============================================================
function getConfig() {
  const sheet = getSheet('config');
  const rows = sheet.getDataRange().getValues();
  const cfg = {};
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][0];
    let val = rows[i][1];
    if (key === 'blockedWeekdays') {
      val = val ? String(val).split(',').map(Number).filter(n => !isNaN(n)) : [];
    } else if (key === 'slotDuration' || key === 'slotBreak' || key === 'maxPerDay') {
      val = parseInt(val) || 0;
    }
    cfg[key] = val;
  }

  // blocked dates
  const bdSheet = getSheet('blockedDates');
  const bdRows = bdSheet.getDataRange().getValues();
  cfg.blockedDates = bdRows.slice(1).map(r => r[0]).filter(Boolean);

  return { success: true, data: cfg };
}

function updateConfig(body) {
  const sheet = getSheet('config');
  const rows = sheet.getDataRange().getValues();
  const keyMap = {};
  for (let i = 1; i < rows.length; i++) {
    keyMap[rows[i][0]] = i + 1; // 1-indexed row
  }

  const keys = ['welcomeMessage','startTime','endTime','slotDuration','slotBreak','maxPerDay','adminPhone','blockedWeekdays'];
  for (const key of keys) {
    if (body[key] === undefined) continue;
    let val = body[key];
    if (key === 'blockedWeekdays') val = Array.isArray(val) ? val.join(',') : val;
    if (keyMap[key]) {
      sheet.getRange(keyMap[key], 2).setValue(val);
    } else {
      sheet.appendRow([key, val]);
    }
  }

  // Update blocked dates separately
  if (body.blockedDates !== undefined) {
    const bdSheet = getSheet('blockedDates');
    bdSheet.clearContents();
    bdSheet.appendRow(['date']);
    for (const d of body.blockedDates) {
      bdSheet.appendRow([d]);
    }
  }

  return { success: true };
}

// ============================================================
// SLOTS
// ============================================================
function getSlots(date) {
  if (!date) return { success: false, message: 'Data inválida' };

  const cfg = getConfig().data;

  // Check if day is blocked
  if (cfg.blockedDates && cfg.blockedDates.includes(date)) {
    return { success: true, slots: [] };
  }
  const dow = new Date(date + 'T12:00:00').getDay();
  if (cfg.blockedWeekdays && cfg.blockedWeekdays.includes(dow)) {
    return { success: true, slots: [] };
  }

  const startTime = cfg.startTime || '09:00';
  const endTime = cfg.endTime || '20:00';
  const duration = parseInt(cfg.slotDuration) || 25;
  const breakTime = parseInt(cfg.slotBreak) || 5;
  const step = duration + breakTime;

  // Generate all slots
  const allSlots = [];
  let [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let currentMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  while (currentMins + duration <= endMins) {
    const hh = String(Math.floor(currentMins / 60)).padStart(2, '0');
    const mm = String(currentMins % 60).padStart(2, '0');
    allSlots.push(`${hh}:${mm}`);
    currentMins += step;
  }

  // Get booked slots for this date
  const sheet = getSheet('bookings');
  const rows = sheet.getDataRange().getValues();
  const bookedSlots = new Set();
  let confirmedCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[1] === date && (r[7] === 'pending' || r[7] === 'confirmed')) {
      bookedSlots.add(r[2]);
      confirmedCount++;
    }
  }

  const maxPerDay = parseInt(cfg.maxPerDay) || 99;

  const slots = allSlots.map(time => ({
    time,
    available: !bookedSlots.has(time) && confirmedCount < maxPerDay,
  }));

  return { success: true, slots };
}

// ============================================================
// CREATE BOOKING
// ============================================================
function createBooking(body) {
  const { date, slot, name, phone, guests, notes } = body;
  if (!date || !slot || !name) return { success: false, message: 'Dados incompletos' };

  // Double-check availability
  const slotsResult = getSlots(date);
  const slotInfo = slotsResult.slots.find(s => s.time === slot);
  if (!slotInfo || !slotInfo.available) {
    return { success: false, message: 'Este horário não está mais disponível. Por favor, escolha outro.' };
  }

  const id = Utilities.getUuid();
  const cancelToken = Utilities.getUuid();
  const createdAt = new Date().toISOString();

  const sheet = getSheet('bookings');
  sheet.appendRow([id, date, slot, name, phone || '', guests || 1, notes || '', 'pending', '', cancelToken, createdAt]);

  return {
    success: true,
    booking: { id, date, slot, name, phone, guests, notes, status: 'pending', cancelToken }
  };
}

// ============================================================
// CANCEL BOOKING (by visitor)
// ============================================================
function cancelBooking(cancelToken) {
  if (!cancelToken) return { success: false, message: 'Token inválido' };

  const sheet = getSheet('bookings');
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][9] === cancelToken) {
      const status = rows[i][7];
      if (status === 'cancelled') {
        return { success: false, message: 'Esta visita já foi cancelada.' };
      }
      sheet.getRange(i + 1, 8).setValue('cancelled');
      return { success: true, message: 'Visita cancelada com sucesso.' };
    }
  }
  return { success: false, message: 'Agendamento não encontrado.' };
}

// ============================================================
// ADMIN: GET BOOKINGS FOR A DATE
// ============================================================
function getAdminBookings(date) {
  const sheet = getSheet('bookings');
  const rows = sheet.getDataRange().getValues();
  const bookings = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!date || r[1] === date) {
      bookings.push({
        id: r[0],
        date: r[1],
        slot: r[2],
        name: r[3],
        phone: r[4],
        guests: r[5],
        notes: r[6],
        status: r[7],
        adminNote: r[8],
        cancelToken: r[9],
        createdAt: r[10],
      });
    }
  }

  // Sort by slot time
  bookings.sort((a, b) => a.slot.localeCompare(b.slot));
  return { success: true, bookings };
}

// ============================================================
// ADMIN: CONFIRM OR REFUSE
// ============================================================
function adminAction(bookingId, action, note) {
  if (!bookingId || !action) return { success: false, message: 'Parâmetros inválidos' };

  const sheet = getSheet('bookings');
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === bookingId) {
      const newStatus = action === 'confirm' ? 'confirmed' : 'refused';
      sheet.getRange(i + 1, 8).setValue(newStatus);
      if (note) sheet.getRange(i + 1, 9).setValue(note);
      return { success: true };
    }
  }
  return { success: false, message: 'Agendamento não encontrado.' };
}
