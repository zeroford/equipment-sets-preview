/**
 * Google Apps Script Web App — คืน JSON ให้ equipment-sets-preview
 *
 * Deploy: Deploy → New deployment → Web app
 * - Execute as: Me
 * - Who has access: Anyone (อ่านอย่างเดียว)
 *
 * อ่าน 3 แท็บ (header row บรรทัดแรก, ชื่อคอลัมน์ไม่สนตัวพิมพ์/ช่องว่าง/ขีด):
 *   Sets      — setKey | title | order
 *   Items     — setKey | slot | level | grade | name | power | stat1Label | stat1Value | …
 *   BestStats — setKey | row | bestStats | label
 *
 * NOTE: ใช้ getDisplayValues() ไม่ใช่ getValues() — ค่าอย่าง "8.53%" / "+6,043" ต้องคงรูปตามที่เห็นในชีต
 * ถ้าอ่านเป็นตัวเลขดิบจะกลายเป็น 0.0853 / 6043 แล้วการ์ดจะแสดงผิด
 */

var SHEET_SETS = 'Sets';
var SHEET_ITEMS = 'Items';
var SHEET_BEST = 'BestStats';

var SLOT_COUNT = 12; // grid 3×4
var BEST_ROW_COUNT = 4;
var MAX_STATS_PER_ITEM = 6; // stat1..stat6 (stat1 = base stat)

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
  var bestBySet = groupBySetKey(readTable(SHEET_BEST), SHEET_BEST);
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

      var best = buildBest(bestBySet[key] || [], key);
      return {
        setKey: key,
        title: field(row, 'title'),
        items: buildItems(itemsBySet[key] || [], key),
        bestStatsByRow: best.stats,
        bestSubstatLabels: best.labels,
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
    slots[slot - 1] = {
      level: Math.round(toNumber(field(row, 'level'))),
      grade: field(row, 'grade').toLowerCase(),
      name: field(row, 'name'),
      stats: readStats(row),
      power: field(row, 'power'),
    };
  }

  return slots;
}

/** [[label, value], …] — stat แรกคือ base stat, ที่เหลือเป็น substat */
function readStats(row) {
  var stats = [];
  for (var i = 1; i <= MAX_STATS_PER_ITEM; i += 1) {
    var label = field(row, 'stat' + i + 'Label');
    var value = field(row, 'stat' + i + 'Value');
    if (label === '' && value === '') {
      continue;
    }
    stats.push([label, value]);
  }
  return stats;
}

function buildBest(rows, setKey) {
  var stats = [];
  var labels = [];
  var i;
  for (i = 0; i < BEST_ROW_COUNT; i += 1) {
    stats.push([]);
    labels.push('');
  }

  for (i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    var raw = field(row, 'row');
    var index = Math.round(toNumber(raw));
    if (!(index >= 1 && index <= BEST_ROW_COUNT)) {
      throw new Error(
        SHEET_BEST + ' (' + setKey + '): row ต้องเป็น 1–' + BEST_ROW_COUNT + ' แต่ได้ "' + raw + '"',
      );
    }
    stats[index - 1] = splitStatList(field(row, 'bestStats'));
    labels[index - 1] = field(row, 'label');
  }

  return { stats: stats, labels: labels };
}

/** "Skill AMP · Crit DMG / Accuracy" → ['Skill AMP', 'Crit DMG', 'Accuracy'] */
function splitStatList(raw) {
  return String(raw)
    .split(/[,·\/|]/)
    .map(function (part) {
      return part.trim();
    })
    .filter(function (part) {
      return part !== '';
    });
}

/** อ่านทั้งแท็บเป็น array ของ object โดยใช้ header row เป็น key */
function readTable(name) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error('ไม่พบแท็บ: ' + name);
  }

  var values = sheet.getDataRange().getDisplayValues();
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
  var num = parseFloat(String(raw).replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
}

function jsonResponse(obj) {
  // NOTE: ContentService ตั้ง HTTP status ไม่ได้ — error จึงอยู่ในตัว payload
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
