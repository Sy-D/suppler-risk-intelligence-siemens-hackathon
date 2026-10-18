import { riskDimensionGroups, type DimensionKey } from "@/lib/risk"
import type { Supplier } from "@/lib/supplier-data"

type Cell = string | number | null | undefined
type Row = Cell[]

const DIMENSIONS: { label: string; key: DimensionKey }[] = []
for (const group of riskDimensionGroups)
  for (const dimension of group.dimensions) DIMENSIONS.push(dimension)

export function supplierRows(suppliers: Supplier[]): Row[] {
  const dimensions = DIMENSIONS
  return [
    [
      "Supplier ID",
      "Name",
      "Risk level",
      "Sourcing risk",
      "Total risk index",
      ...dimensions.map((d) => d.label),
      "Delivery rating (%)",
      "PO exposure (EUR)",
      "HQ city",
      "HQ country",
      "Region",
      "Website",
      "Contact email",
      "Researched",
      "Last modified",
    ],
    ...suppliers.map((s) => [
      s.id,
      s.name,
      s.level,
      s.sourcing,
      s.risk,
      // SAFETY: every dimension key names a numeric score field on Supplier.
      ...dimensions.map((d) => s[d.key] as number),
      s.researched ? null : s.delivery,
      s.researched ? null : s.exposure,
      s.hqCity ?? null,
      s.hqCountry ?? null,
      s.region,
      s.website ?? null,
      s.contactEmail ?? null,
      s.researched ? "yes" : "no",
      s.lastModified ?? null,
    ]),
  ]
}

export function toCsv(rows: Row[]): string {
  const escape = (cell: Cell) => {
    if (cell === null || cell === undefined) return ""
    const text = String(cell)
    return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return "﻿" + rows.map((row) => row.map(escape).join(";")).join("\r\n")
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function columnRef(index: number): string {
  let ref = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    ref = String.fromCharCode(65 + ((n - 1) % 26)) + ref
  return ref
}

function xmlEscape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function sheetXml(rows: Row[]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((cell, c) => {
          if (cell === null || cell === undefined || cell === "") return ""
          const ref = `${columnRef(c)}${r + 1}`
          return String(cell) === cell
            ? `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(String(cell))}</t></is></c>`
            : `<c r="${ref}"><v>${cell}</v></c>`
        })
        .join("")
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Suppliers" sheetId="1" r:id="rId1"/></sheets></workbook>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`

function zip(files: { name: string; data: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const directory: Uint8Array[] = []
  let offset = 0
  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >> 8) & 0xff])
  const u32 = (v: number) =>
    new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff])

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = encoder.encode(file.data)
    const crc = crc32(data)
    const local = [
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), name, data,
    ]
    chunks.push(...local)
    directory.push(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(offset), name,
    )
    offset += local.reduce((sum, part) => sum + part.length, 0)
  }

  const cdOffset = offset
  const cdSize = directory.reduce((sum, part) => sum + part.length, 0)
  const end = [
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cdSize), u32(cdOffset), u16(0),
  ]
  return concat([...chunks, ...directory, ...end])
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

export function toXlsx(rows: Row[]): Uint8Array {
  return zip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "xl/workbook.xml", data: WORKBOOK },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(rows) },
  ])
}

export function downloadFile(name: string, data: Uint8Array | string, type: string) {
  // SAFETY: Uint8Array and string are both valid BlobPart members; the cast
  // bridges the generic ArrayBufferLike vs ArrayBuffer typing gap in TS 5.9.
  const blob = new Blob([data as BlobPart], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}
