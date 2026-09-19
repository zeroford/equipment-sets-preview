/**
 * Google Apps Script Web App — คืน JSON ให้ equipment-sets-preview
 *
 * Deploy: Deploy → New deployment → Web app
 * - Execute as: Me
 * - Who has access: Anyone (อ่านอย่างเดียว)
 *
 * อ่าน 2 แท็บ (header row บรรทัดแรก, ชื่อคอลัมน์ไม่สนตัวพิมพ์/ช่องว่าง/ขีด):
 *   Sets  — setKey | title | order
 *   Items — setKey | slot | level | grade | power | sub1Type | sub1Value | sub2Type | sub2Value
 *
 * เก็บเท่าที่จำเป็น ที่เหลือ derive ฝั่ง JS:
 *   grade    9 = legendary, 10 = eternal (พิมพ์ 'eternal' ก็ได้)
 *   base stat ไม่ต้องเก็บ — คำนวณจาก slot + grade + level (assets/js/base-stat.mjs)
 *   sub*Type stat id เช่น skillAmp (พิมพ์ 'Skill AMP' ก็ได้ — assets/js/stats.mjs)
 *   ชื่อของ  ไม่ต้องเก็บ ผูกกับ (slot, grade); ใส่คอลัมน์ name เพื่อ override ได้
 *
 * NOTE: ใช้ getValues() ไม่ใช่ getDisplayValues() — stat แบบ % เก็บเป็นเศษส่วน
 * พิมพ์ 8.53% ชีตเก็บ 0.0853 ซึ่งเป็นค่าที่เราต้องการ ส่วน display จะได้ "8.53%" ซึ่งผิดรูป
 *
 * ── เขียนกลับ ──────────────────────────────────────────────────
 * ต้องตั้ง Script Property ชื่อ EDIT_KEY (Project Settings → Script Properties)
 * ไม่ตั้ง = ปิดการเขียนทั้งหมด
 *
 * ‼️ Web App นี้เปิด public (Anyone) — EDIT_KEY คือสิ่งเดียวที่กันคนอื่นเขียนชีต
 *    ตัว key เดินทางไปฝั่ง browser ด้วย เลยไม่ใช่ความลับระดับ production
 *    ถ้าหลุด: เปลี่ยนค่าใน Script Properties ได้ทันที ไม่ต้อง redeploy
 */

var SHEET_SETS = 'Sets';
var SHEET_ITEMS = 'Items';
var SHEET_BEST = 'BestStats'; // ไม่บังคับ — ไม่มีแท็บนี้ก็ใช้ค่าตั้งต้นในโค้ดหน้าเว็บ

var SLOT_COUNT = 12; // grid 3×4
var MAX_SUBSTATS = 5;

function doGet() {
  try {
    return jsonResponse({ sets: buildSets(), bestStats: buildBestStats() });
  } catch (err) {
    return jsonResponse({ error: String((err && err.message) || err) });
  }
}

/**
 * เขียนกลับลงแท็บ Items — ส่งเป็น text/plain เท่านั้น
 *
 * NOTE: ห้ามส่ง Content-Type: application/json — จะโดน CORS preflight
 * ซึ่ง Apps Script ไม่ตอบ OPTIONS เลย request ตายก่อนถึงที่นี่
 *
 * body: { key, action: 'updateItem' | 'clearSlot', setKey, slot, item? }
 * item: { level, grade, power, subs: [[statId, value, format], …] }
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    requireEditKey(body.key);

    if (!lock.tryLock(15000)) {
      throw new Error('Another edit is in progress — try again');
    }

    if (body.action === 'clearSlot') {
      clearSlot(body.setKey, body.slot);
    } else if (body.action === 'updateItem') {
      writeItem(body.setKey, body.slot, body.item || {});
    } else {
      throw new Error('Unknown action: ' + body.action);
    }

    // คืน sets ชุดใหม่ไปเลย หน้าเว็บจะได้ไม่ต้องยิง GET ตามอีกรอบ
    return jsonResponse({ ok: true, sets: buildSets() });
  } catch (err) {
    return jsonResponse({ error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function requireEditKey(given) {
  var expected = PropertiesService.getScriptProperties().getProperty('EDIT_KEY');
  if (!expected) {
    throw new Error('EDIT_KEY is not set in Script Properties — writing is disabled');
  }
  if (String(given || '') !== expected) {
    throw new Error('Wrong edit key');
  }
}

var NUMBER_FORMATS = {
  percent: '0.00%',
  int: '#,##0',
  decimal: '0.00',
};

/** { header ที่ normalize แล้ว → index คอลัมน์ (0-based) } */
function itemsSheetLayout() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ITEMS);
  if (!sheet) {
    throw new Error('Sheet tab not found: ' + SHEET_ITEMS);
  }
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeKey);
  var columns = {};
  headers.forEach(function (key, i) {
    if (key && !(key in columns)) {
      columns[key] = i;
    }
  });
  return { sheet: sheet, columns: columns };
}

function columnIndex(layout, name) {
  var index = layout.columns[normalizeKey(name)];
  return index === undefined ? -1 : index;
}

/** แถวในชีต (1-based) ของ setKey+slot นั้น, ไม่เจอคืน 0 */
function findItemRow(layout, setKey, slot) {
  var setCol = columnIndex(layout, 'setKey');
  var slotCol = columnIndex(layout, 'slot');
  if (setCol < 0 || slotCol < 0) {
    throw new Error(SHEET_ITEMS + ': needs setKey and slot columns');
  }

  var values = layout.sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r += 1) {
    if (
      String(values[r][setCol]).trim() === String(setKey).trim() &&
      Math.round(toNumber(values[r][slotCol])) === Math.round(toNumber(slot))
    ) {
      return r + 1;
    }
  }
  return 0;
}

function writeItem(setKey, slot, item) {
  if (!setKey) {
    throw new Error('setKey is missing');
  }
  var slotNumber = Math.round(toNumber(slot));
  if (!(slotNumber >= 1 && slotNumber <= SLOT_COUNT)) {
    throw new Error('slot must be 1-' + SLOT_COUNT);
  }

  var layout = itemsSheetLayout();
  var row = findItemRow(layout, setKey, slotNumber);
  if (!row) {
    row = layout.sheet.getLastRow() + 1;
    setCell(layout, row, 'setKey', setKey, '');
    setCell(layout, row, 'slot', slotNumber, '');
  }

  setCell(layout, row, 'level', Math.round(toNumber(item.level)), '');
  setCell(layout, row, 'grade', item.grade, '');
  setCell(layout, row, 'power', toNumber(item.power), '');

  var subs = item.subs || [];
  for (var i = 1; i <= MAX_SUBSTATS; i += 1) {
    var sub = subs[i - 1];
    setCell(layout, row, 'sub' + i + 'Type', sub ? sub[0] : '', '');
    setCell(layout, row, 'sub' + i + 'Value', sub ? toNumber(sub[1]) : '', sub ? sub[2] : '');
  }
}

function clearSlot(setKey, slot) {
  var layout = itemsSheetLayout();
  var row = findItemRow(layout, setKey, Math.round(toNumber(slot)));
  if (row) {
    layout.sheet.deleteRow(row);
  }
}

/** คอลัมน์ที่ชีตไม่มีก็ข้ามไป — ไม่พังถ้าชีตมีคอลัมน์น้อยกว่าที่ส่งมา */
function setCell(layout, row, name, value, format) {
  var col = columnIndex(layout, name);
  if (col < 0) {
    return;
  }
  var cell = layout.sheet.getRange(row, col + 1);
  cell.setValue(value);
  if (NUMBER_FORMATS[format]) {
    cell.setNumberFormat(NUMBER_FORMATS[format]);
  }
}

/**
 * แท็บ BestStats (ไม่บังคับ): mode | row | stats
 *   mode  = pve | boss
 *   row   = 1-4 (แถวของกริด: 1 = slot 1-3, 2 = 4-6, 3 = 7-9, 4 = 10-12)
 *   stats = ชื่อ stat คั่นด้วยจุลภาค เช่น "skillAmp, accuracy" หรือ "Skill AMP, Accuracy"
 *
 * แถวไหนไม่ได้เขียนไว้ = ว่าง (ไม่ highlight อะไรในแถวนั้น)
 * ไม่มีแท็บนี้เลย = หน้าเว็บใช้ค่าตั้งต้นของมันเอง
 */
function buildBestStats() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BEST);
  if (!sheet) {
    return null;
  }

  var profiles = {};
  readTable(SHEET_BEST).forEach(function (row) {
    var mode = field(row, 'mode').toLowerCase();
    var index = Number(field(row, 'row')) - 1;
    if (!mode || !(index >= 0 && index < 4)) {
      return;
    }
    if (!profiles[mode]) {
      profiles[mode] = { rows: [[], [], [], []] };
    }
    profiles[mode].rows[index] = field(row, 'stats')
      .split(',')
      .map(function (part) {
        return part.trim();
      })
      .filter(function (part) {
        return part !== '';
      });
  });

  return Object.keys(profiles).length ? profiles : null;
}

function buildSets() {
  var setRows = readTable(SHEET_SETS);
  if (!setRows.length) {
    throw new Error(SHEET_SETS + ' is empty (needs at least 1 set)');
  }

  var itemsBySet = groupBySetKey(readTable(SHEET_ITEMS), SHEET_ITEMS);
  var seen = {};

  return setRows
    .filter(function (row) {
      return field(row, 'setKey') !== '';
    })
    .sort(function (a, b) {
      return toNumber(field(a, 'order')) - toNumber(field(b, 'order'));
    })
    .map(function (row) {
      var key = field(row, 'setKey');
      if (seen[key]) {
        throw new Error(SHEET_SETS + ': duplicate setKey "' + key + '"');
      }
      seen[key] = true;

      return {
        setKey: key,
        title: field(row, 'title'),
        items: buildItems(itemsBySet[key] || [], key),
      };
    });
}

/** 12 ช่องเรียงตาม grid, ช่องที่ไม่มีแถวในชีต = null */
function buildItems(rows, setKey) {
  var slots = [];
  var i;
  for (i = 0; i < SLOT_COUNT; i += 1) {
    slots.push(null);
  }

  for (i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var raw = field(row, 'slot');
    var slot = Math.round(toNumber(raw));
    if (!(slot >= 1 && slot <= SLOT_COUNT)) {
      throw new Error(
        SHEET_ITEMS + ' (' + setKey + '): slot must be 1-' + SLOT_COUNT + ' but got "' + raw + '"',
      );
    }
    if (slots[slot - 1]) {
      throw new Error(SHEET_ITEMS + ' (' + setKey + '): slot ' + slot + ' is duplicated');
    }

    var item = {
      level: Math.round(toNumber(field(row, 'level'))),
      grade: field(row, 'grade'),
      power: toNumber(field(row, 'power')),
      subs: readSubStats(row),
    };
    var name = field(row, 'name');
    if (name !== '') {
      item.name = name;
    }
    slots[slot - 1] = item;
  }

  return slots;
}

/** [[stat code/id, ค่า], …] */
function readSubStats(row) {
  var subs = [];
  for (var i = 1; i <= MAX_SUBSTATS; i += 1) {
    // รับทั้ง sub1Type และ subStat1Type
    var type = field(row, 'sub' + i + 'Type') || field(row, 'subStat' + i + 'Type');
    var value = field(row, 'sub' + i + 'Value') || field(row, 'subStat' + i + 'Value');
    if (type === '' && value === '') {
      continue;
    }
    subs.push([type, toNumber(value)]);
  }
  return subs;
}

/** อ่านทั้งแท็บเป็น array ของ object โดยใช้ header row เป็น key */
function readTable(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('Sheet tab not found: ' + name);
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headers = values[0].map(normalizeKey);
  return values
    .slice(1)
    .map(function (row) {
      var obj = {};
      for (var i = 0; i < headers.length; i += 1) {
        if (headers[i]) {
          obj[headers[i]] = String(row[i] == null ? '' : row[i]).trim();
        }
      }
      return obj;
    })
    .filter(function (obj) {
      return Object.keys(obj).some(function (key) {
        return obj[key] !== '';
      });
    });
}

function groupBySetKey(rows, sheetName) {
  var grouped = {};
  for (var i = 0; i < rows.length; i += 1) {
    var key = field(rows[i], 'setKey');
    if (key === '') {
      throw new Error(sheetName + ': a row has an empty setKey');
    }
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(rows[i]);
  }
  return grouped;
}

function normalizeKey(header) {
  return String(header == null ? '' : header)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function field(row, name) {
  var value = row[normalizeKey(name)];
  return value == null ? '' : value;
}

function toNumber(raw) {
  var num = parseFloat(String(raw).replace(/[,+\s]/g, ''));
  return isNaN(num) ? 0 : num;
}

function jsonResponse(obj) {
  // NOTE: ContentService ตั้ง HTTP status ไม่ได้ — error จึงอยู่ในตัว payload
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
