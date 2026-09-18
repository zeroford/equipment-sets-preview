/**
 * Google Apps Script Web App — คืน JSON ให้ equipment-sets-preview
 *
 * Deploy: Deploy → New deployment → Web app
 * - Execute as: Me
 * - Who has access: Anyone (อ่านอย่างเดียว)
 *
 * อ่าน 2 แท็บ (header row บรรทัดแรก, ชื่อคอลัมน์ไม่สนตัวพิมพ์/ช่องว่าง/ขีด):
 *   Sets  — setKey | title | order
 *   Items — setKey | slot | level | grade | power | base | sub1Type | sub1Value | sub2Type | sub2Value
 *
 * เก็บเท่าที่จำเป็น ที่เหลือ derive ฝั่ง JS:
 *   grade    9 = legendary, 10 = eternal (พิมพ์ 'eternal' ก็ได้)
 *   base     ค่า base stat เฉยๆ — ชนิดผูกกับ slot อยู่แล้ว (assets/js/catalog.mjs)
 *   sub*Type stat code/id (2 หรือ skillAmp หรือ 'Skill AMP' — assets/js/stats.mjs)
 *   ชื่อของ  ไม่ต้องเก็บ ผูกกับ (slot, grade); ใส่คอลัมน์ name เพื่อ override ได้
 *
 * NOTE: ใช้ getValues() ไม่ใช่ getDisplayValues() — stat แบบ % เก็บเป็นเศษส่วน
 * พิมพ์ 8.53% ชีตเก็บ 0.0853 ซึ่งเป็นค่าที่เราต้องการ ส่วน display จะได้ "8.53%" ซึ่งผิดรูป
 */

var SHEET_SETS = 'Sets';
var SHEET_ITEMS = 'Items';

var SLOT_COUNT = 12; // grid 3×4
var MAX_SUBSTATS = 5;

function doGet() {
  try {
    return jsonResponse({ sets: buildSets() });
  } catch (err) {
    return jsonResponse({ error: String((err && err.message) || err) });
  }
}

function buildSets() {
  var setRows = readTable(SHEET_SETS);
  if (!setRows.length) {
    throw new Error(SHEET_SETS + ' ว่าง (ต้องมีอย่างน้อย 1 set)');
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
        throw new Error(SHEET_SETS + ': setKey ซ้ำ "' + key + '"');
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
        SHEET_ITEMS + ' (' + setKey + '): slot ต้องเป็น 1–' + SLOT_COUNT + ' แต่ได้ "' + raw + '"',
      );
    }
    if (slots[slot - 1]) {
      throw new Error(SHEET_ITEMS + ' (' + setKey + '): slot ' + slot + ' ซ้ำ');
    }

    var item = {
      level: Math.round(toNumber(field(row, 'level'))),
      grade: field(row, 'grade'),
      power: toNumber(field(row, 'power')),
      base: toNumber(field(row, 'base')),
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
    throw new Error('ไม่พบแท็บ: ' + name);
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
      throw new Error(sheetName + ': มีแถวที่ setKey ว่าง');
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
