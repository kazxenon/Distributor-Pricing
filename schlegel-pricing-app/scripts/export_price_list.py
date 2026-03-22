#!/usr/bin/env python3

import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def load_shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    strings = []
    for item in root.findall("main:si", NS):
        strings.append("".join(node.text or "" for node in item.iterfind(".//main:t", NS)))
    return strings


def read_cell(cell, shared_strings):
    cell_type = cell.attrib.get("t")
    value = cell.find("main:v", NS)

    if cell_type == "inlineStr":
        inline = cell.find("main:is", NS)
        if inline is None:
            return ""
        return "".join(node.text or "" for node in inline.iterfind(".//main:t", NS))

    if value is None:
        return ""

    raw = value.text or ""
    if cell_type == "s" and raw.isdigit():
        return shared_strings[int(raw)]
    return raw


def parse_number(value):
    if value in ("", None):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def extract_rows(workbook_path):
    with zipfile.ZipFile(workbook_path) as archive:
        shared_strings = load_shared_strings(archive)
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in relationships.findall("pkgrel:Relationship", NS)
        }

        first_sheet = workbook.find("main:sheets", NS)[0]
        target = rel_map[
            first_sheet.attrib[
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            ]
        ]
        sheet_path = f"xl/{target}" if not target.startswith("xl/") else target
        sheet = ET.fromstring(archive.read(sheet_path))
        rows = sheet.find("main:sheetData", NS).findall("main:row", NS)

        headers = {}
        for cell in rows[0].findall("main:c", NS):
            column = re.match(r"[A-Z]+", cell.attrib["r"]).group(0)
            headers[column] = read_cell(cell, shared_strings).strip()

        products = []
        for row in rows[1:]:
            raw = {}
            for cell in row.findall("main:c", NS):
                column = re.match(r"[A-Z]+", cell.attrib["r"]).group(0)
                key = headers.get(column, column)
                raw[key] = read_cell(cell, shared_strings).strip()

            type_number = raw.get("Type number", "")
            if not type_number:
                continue

            scale_breaks = []
            for index in range(1, 5):
                quantity = parse_number(raw.get(f"Scale quantity {index}", ""))
                price = parse_number(raw.get(f"Scale price {index}", ""))
                if quantity and price:
                    scale_breaks.append({"quantity": quantity, "price": price})

            price_unit = parse_number(raw.get("Price unit", "")) or 1
            product = {
                "typeNumber": type_number,
                "basePrice": parse_number(raw.get("Price", "")) or 0,
                "priceUnit": price_unit,
                "quantityUnit": raw.get("Quantity unit", "") or "PCE",
                "discountable": raw.get("Discountable", "").upper() == "YES",
                "scaleBreaks": scale_breaks,
                "weightPerPiece": parse_number(raw.get("Weight/pce.", "")),
                "customsTariffNo": raw.get("Customs tariff no.", ""),
                "countryOfOrigin": raw.get("Country of origin", ""),
                "regionOfOrigin": raw.get("Region of origin", ""),
            }
            products.append(product)

        return products


def main():
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("Schlegel 2023 Price List.xlsx")
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("data/products.json")

    products = extract_rows(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(products, separators=(",", ":")), encoding="utf-8")

    print(f"Exported {len(products)} products to {output}")


if __name__ == "__main__":
    main()
