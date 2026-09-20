/**
 * Google Apps Script Web App — คืน JSON ให้ equipment-sets-preview
 *
 * Deploy: Deploy → New deployment → Web app
 * - Execute as: Me
 * - Who has access: Anyone (อ่านอย่างเดียว)
 *
 * อ่าน 2 แท็บ (header row บรรทัดแรก, ชื่อคอลัมน์ไม่สนตัวพิมพ์/ช่องว่าง/ขีด):
 *   Sets  — setKey | title | order
 *   Items — setKey | slot | level | grade | sub1Type | sub1Value | sub2Type | sub2Value
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
 * item: { level, grade, subs: [[statId, value, format], …] }
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
      clearSlot(body.setKey, body.slot, body.row);
    } else if (body.action === 'setMain') {
      setMain(body.setKey, body.slot, body.row);
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
  var sheet = getSheet(SHEET_ITEMS);
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

/** แถวที่ยังใช้งานอยู่ (1-based) ของ setKey+slot นั้น, ไม่เจอคืน 0 */
function findItemRow(layout, setKey, slot) {
  var setCol = columnIndex(layout, 'setKey');
  var slotCol = columnIndex(layout, 'slot');
  if (setCol < 0 || slotCol < 0) {
    throw new Error(SHEET_ITEMS + ': needs setKey and slot columns');
  }
  var activeCol = columnIndex(layout, 'isActive');

  var values = layout.sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r += 1) {
    if (activeCol >= 0 && isInactive(values[r][activeCol])) {
      continue;
    }
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

  /*
   * "Add" = ต่อแถวใหม่อย่างเดียว ไม่ไปแตะของเก่า — ช่องนั้นจะมีหลายใบซ้อนกัน
   * ให้เทียบ แล้วค่อยกดกากบาทลบใบที่ไม่เอาเอง
   *
   * NOTE: ชีตที่ไม่มีคอลัมน์ isActive ต่อแถวใหม่ไม่ได้ (จะกลายเป็น slot ซ้ำที่ปิดไม่ได้)
   * เลยต้องเขียนทับแถวเดิมแทน
   */
  var row = 0;
  if (columnIndex(layout, 'isActive') < 0) {
    row = findItemRow(layout, setKey, slotNumber);
  }

  if (!row) {
    row = layout.sheet.getLastRow() + 1;
    setCell(layout, row, 'setKey', setKey, '');
    setCell(layout, row, 'slot', slotNumber, '');
    setCell(layout, row, 'isActive', true, '');
  }

  setCell(layout, row, 'level', Math.round(toNumber(item.level)), '');
  setCell(layout, row, 'grade', item.grade, '');
  // เพิ่งเพิ่มเข้าไป = ตั้งเป็นตัวหลักของช่องนั้นเลย ใบเก่าเลิกเป็นหลัก
  clearMainFlags(layout, setKey, slotNumber, row);
  setCell(layout, row, 'isMain', true, '');

  var subs = item.subs || [];
  for (var i = 1; i <= MAX_SUBSTATS; i += 1) {
    var sub = subs[i - 1];
    setCell(layout, row, 'sub' + i + 'Type', sub ? sub[0] : '', '');
    setCell(layout, row, 'sub' + i + 'Value', sub ? toNumber(sub[1]) : '', sub ? sub[2] : '');
  }
}

/**
 * เอาออกจากกริด — มีคอลัมน์ isActive ก็แค่ปิดแถวไว้ ไม่ลบข้อมูลทิ้ง
 *
 * NOTE: รับเลขแถวมาด้วยได้ ตอน slot มีหลายใบจะได้ลบถูกใบ ไม่ใช่ใบแรกที่เจอ
 */
function clearSlot(setKey, slot, targetRow) {
  var layout = itemsSheetLayout();
  var row = Math.round(toNumber(targetRow)) || findItemRow(layout, setKey, Math.round(toNumber(slot)));
  if (!row) {
    return;
  }
  if (columnIndex(layout, 'isActive') >= 0) {
    setCell(layout, row, 'isActive', false, '');
    setCell(layout, row, 'isMain', false, '');
  } else {
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
  var sheet = getSheet(SHEET_BEST);
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

/**
 * 12 ช่องเรียงตาม grid — แต่ละช่องเป็น "รายการ" ของที่ยังใช้งานอยู่
 *
 * NOTE: ปกติมีใบเดียว แต่ถ้าชีตมีหลายแถว active ใน slot เดียวกันจะส่งไปทั้งหมด
 * ให้หน้าเว็บเรียงให้เห็นครบ — ดีกว่าเลือกมาใบเดียวแล้วอีกใบหายไปเงียบๆ
 */
function buildItems(rows, setKey) {
  var slots = [];
  var i;
  for (i = 0; i < SLOT_COUNT; i += 1) {
    slots.push([]);
  }

  for (i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    // ของเก่าที่ถูกแทนที่/ลบไปแล้ว ยังอยู่ในชีตแต่ไม่เอามาแสดง
    if (isInactive(field(row, 'isActive'))) {
      continue;
    }
    var raw = field(row, 'slot');
    var slot = Math.round(toNumber(raw));
    if (!(slot >= 1 && slot <= SLOT_COUNT)) {
      throw new Error(
        SHEET_ITEMS + ' (' + setKey + '): slot must be 1-' + SLOT_COUNT + ' but got "' + raw + '"',
      );
    }
    var item = {
      row: row.__row,
      level: Math.round(toNumber(field(row, 'level'))),
      grade: field(row, 'grade'),
      isMain: isTruthy(field(row, 'isMain') || field(row, 'isNew')),
      subs: readSubStats(row),
    };
    var name = field(row, 'name');
    if (name !== '') {
      item.name = name;
    }
    // แถวล่าสุดขึ้นก่อน — เพิ่งเพิ่มเข้าไปย่อมเป็นตัวที่สนใจที่สุด
    slots[slot - 1].unshift(item);
  }

  /*
   * ใบที่ปักหมุดไว้ขึ้นก่อนเสมอ — หน้าเว็บใช้ใบแรกเป็นตัวหลัก (ยอดรวม stat, หน้า Compare)
   * NOTE: ไม่ใช้ sort() เพราะ Apps Script ไม่การันตีว่า sort เสถียร — ลำดับที่เหลือจะเพี้ยน
   */
  for (i = 0; i < slots.length; i += 1) {
    var main = [];
    var rest = [];
    slots[i].forEach(function (it) {
      (it.isMain ? main : rest).push(it);
    });
    slots[i] = main.concat(rest);
  }

  return slots;
}

/** ปักหมุดแถวนี้เป็นตัวหลักของช่อง แถวอื่นในช่องเดียวกันเลิกเป็นหลัก */
function setMain(setKey, slot, targetRow) {
  var layout = itemsSheetLayout();
  var row = Math.round(toNumber(targetRow));
  if (!row) {
    throw new Error('setMain needs a row');
  }
  clearMainFlags(layout, setKey, slot, row);
  setCell(layout, row, 'isMain', true, '');
}

/** ล้างหมุดของทุกแถวที่ยัง active ใน (setKey, slot) นั้น ยกเว้นแถวที่ยกเว้นไว้ */
function clearMainFlags(layout, setKey, slot, exceptRow) {
  var setCol = columnIndex(layout, 'setKey');
  var slotCol = columnIndex(layout, 'slot');
  var activeCol = columnIndex(layout, 'isActive');
  if (setCol < 0 || slotCol < 0) {
    return;
  }

  var values = layout.sheet.getDataRange().getValues();
  for (var r = 1; r < values.length; r += 1) {
    if (r + 1 === exceptRow) {
      continue;
    }
    if (activeCol >= 0 && isInactive(values[r][activeCol])) {
      continue;
    }
    if (
      String(values[r][setCol]).trim() === String(setKey).trim() &&
      Math.round(toNumber(values[r][slotCol])) === Math.round(toNumber(slot))
    ) {
      setCell(layout, r + 1, 'isMain', false, '');
    }
  }
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
  var sheet = getSheet(name);
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
    .map(function (row, index) {
      var obj = {};
      for (var i = 0; i < headers.length; i += 1) {
        if (headers[i]) {
          obj[headers[i]] = String(row[i] == null ? '' : row[i]).trim();
        }
      }
      // NOTE: ขึ้นต้น __ กันชนกับชื่อคอลัมน์จริง — field() มองไม่เห็นเพราะ normalizeKey ตัด _ ทิ้ง
      obj.__row = index + 2;
      return obj;
    })
    .filter(function (obj) {
      return Object.keys(obj).some(function (key) {
        return key !== '__row' && obj[key] !== '';
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

/**
 * หาแท็บโดยไม่สนช่องว่าง/ตัวพิมพ์ — `Best Stats` = `BestStats` = `best_stats`
 *
 * NOTE: ชื่อคอลัมน์ยืดหยุ่นอยู่แล้ว ชื่อแท็บก็ควรเหมือนกัน ไม่งั้นพิมพ์เว้นวรรคเข้าไป
 * แล้วสคริปต์หาไม่เจอโดยไม่มีอะไรบอก
 */
function getSheet(name) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var exact = book.getSheetByName(name);
  if (exact) {
    return exact;
  }
  var target = normalizeKey(name);
  var sheets = book.getSheets();
  for (var i = 0; i < sheets.length; i += 1) {
    if (normalizeKey(sheets[i].getName()) === target) {
      return sheets[i];
    }
  }
  return null;
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

/** ชีตพิมพ์ได้หลายแบบ — TRUE/true/1/yes/y ถือว่าใช่ทั้งหมด */
function isTruthy(raw) {
  var text = String(raw == null ? '' : raw).trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'y';
}

/**
 * ปิดอยู่หรือเปล่า — ต้องเขียน FALSE ชัดๆ เท่านั้น
 *
 * NOTE: ช่องว่างถือว่ายังใช้งานอยู่ ไม่งั้นแค่เพิ่มคอลัมน์ isActive เข้าไปเฉยๆ
 * ของทั้งชีตจะหายจากหน้าเว็บทันที
 */
function isInactive(raw) {
  var text = String(raw == null ? '' : raw).trim().toLowerCase();
  return text === 'false' || text === '0' || text === 'no' || text === 'n';
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
