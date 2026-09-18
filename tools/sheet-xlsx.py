#!/usr/bin/env python3
"""สร้าง .xlsx 3 แท็บจาก TSV ที่ sheet-seed.mjs export ไว้ — สำหรับ import เข้า Google Sheets ทีเดียวจบ

    ./render.sh && node tools/sheet-seed.mjs && python3 tools/sheet-xlsx.py
    → google-apps-script/seed/equipment-sets.xlsx

NOTE: ทุกเซลล์ตั้ง number_format เป็น text ('@') — กัน Sheets แปลง "8.53%" เป็น 0.0853
      และ "+6,043" เป็น 6043 ตอน import (ปัญหาเดียวกับตอน paste TSV ตรงๆ)
"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

SEED = Path(__file__).resolve().parent.parent / 'google-apps-script' / 'seed'
TABS = ['Sets', 'Items', 'BestStats']
OUT = SEED / 'equipment-sets.xlsx'

HEADER_FILL = PatternFill('solid', fgColor='1F2937')
HEADER_FONT = Font(color='FFFFFF', bold=True)

wb = Workbook()
wb.remove(wb.active)

for tab in TABS:
    rows = [line.split('\t') for line in (SEED / f'{tab}.tsv').read_text().rstrip('\n').split('\n')]
    ws = wb.create_sheet(tab)
    widths = {}

    for r, row in enumerate(rows, start=1):
        for c, value in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.number_format = '@'
            if r == 1:
                cell.fill = HEADER_FILL
                cell.font = HEADER_FONT
                cell.alignment = Alignment(horizontal='center')
            widths[c] = max(widths.get(c, 0), len(value))

    for c, width in widths.items():
        ws.column_dimensions[ws.cell(row=1, column=c).column_letter].width = min(max(width + 2, 8), 34)
    ws.freeze_panes = 'A2'

wb.save(OUT)
print(f'{OUT}  ({", ".join(f"{t}={wb[t].max_row - 1} rows" for t in TABS)})')
