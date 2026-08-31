import { CSV_HEADERS, TYPES, TYPE_IDS, typeLabel } from "./constants.js";

const TYPE_ALIASES = {
  pants: "pants",
  pant: "pants",
  trousers: "pants",
  jeans: "pants",
  shorts: "shorts",
  short: "shorts",
  sweaters: "sweaters",
  sweater: "sweaters",
  hoodie: "sweaters",
  hoodies: "sweaters",
  "sweaters & hoodies": "sweaters",
  "sweaters and hoodies": "sweaters",
  "sweater & hoodie": "sweaters",
  "sweater and hoodie": "sweaters",
};

const HEADER_ALIASES = {
  name: "name",
  item: "name",
  clothing: "name",
  title: "name",
  type: "type",
  category: "type",
  kind: "type",
  "first used": "firstUsed",
  firstused: "firstUsed",
  first_used: "firstUsed",
  "date first used": "firstUsed",
  started: "firstUsed",
  "start date": "firstUsed",
  date: "firstUsed",
  "uses since wash": "usesSinceWash",
  usessincewash: "usesSinceWash",
  uses_since_wash: "usesSinceWash",
  "wears since wash": "usesSinceWash",
  "since wash": "usesSinceWash",
  current: "usesSinceWash",
  "current uses": "usesSinceWash",
  "total uses": "totalUses",
  totaluses: "totalUses",
  total_uses: "totalUses",
  total: "totalUses",
  lifetime: "totalUses",
  "all time": "totalUses",
  "lifetime uses": "totalUses",
  id: "id",
};

export function detectDelimiter(text) {
  const first = stripBom(text)
    .split(/\r?\n/)
    .find((line) => line.trim());
  if (!first) return ",";

  const counts = { ",": 0, "\t": 0, ";": 0 };
  let inQuotes = false;
  for (const char of first) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char in counts) counts[char] += 1;
  }

  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : ",";
}

export function parseCsv(text) {
  const source = stripBom(String(text ?? ""));
  const errors = [];
  if (!source.trim()) {
    return { items: [], errors: ["The file is empty."] };
  }

  const delimiter = detectDelimiter(source);
  const rows = parseRows(source, delimiter);
  if (rows.length === 0) {
    return { items: [], errors: ["No rows found."] };
  }

  const headerMap = mapHeaders(rows[0]);
  const hasName = headerMap.name !== undefined;
  const dataRows = hasName ? rows.slice(1) : rows;
  if (!hasName) {
    headerMap.name = 0;
    headerMap.type = 1;
    headerMap.firstUsed = 2;
    headerMap.usesSinceWash = 3;
    headerMap.totalUses = 4;
    headerMap.id = 5;
  }

  const items = [];
  dataRows.forEach((cells, index) => {
    const rowNumber = (hasName ? index + 2 : index + 1);
    if (cells.every((cell) => cell.trim() === "")) return;

    const name = (cellAt(cells, headerMap.name) || "").trim();
    if (!name) {
      errors.push(`Row ${rowNumber}: missing name.`);
      return;
    }

    const type = normalizeType(cellAt(cells, headerMap.type));
    if (!type) {
      errors.push(
        `Row ${rowNumber}: unknown type "${cellAt(cells, headerMap.type) || ""}". Use Pants, Shorts, or Sweaters & Hoodies.`,
      );
      return;
    }

    const firstUsedRaw = cellAt(cells, headerMap.firstUsed);
    const firstUsed = firstUsedRaw ? parseDate(firstUsedRaw) : null;
    if (firstUsedRaw && firstUsedRaw.trim() && !firstUsed) {
      errors.push(
        `Row ${rowNumber}: could not read date "${firstUsedRaw}". Use YYYY-MM-DD.`,
      );
    }

    const usesSinceWash = parseCount(cellAt(cells, headerMap.usesSinceWash));
    const totalUses = parseCount(cellAt(cells, headerMap.totalUses));
    const id = (cellAt(cells, headerMap.id) || "").trim();

    items.push({
      id: id || undefined,
      name,
      type,
      firstUsed,
      usesSinceWash,
      totalUses: Math.max(totalUses, usesSinceWash),
    });
  });

  return { items, errors, delimiter };
}

export function serializeItems(items) {
  const lines = [CSV_HEADERS.map(escapeCsvField).join(",")];
  for (const item of items) {
    lines.push(
      [
        item.name ?? "",
        typeLabel(item.type) || item.type || "",
        item.firstUsed ?? "",
        String(item.usesSinceWash ?? 0),
        String(item.totalUses ?? 0),
        item.id ?? "",
      ]
        .map(escapeCsvField)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export function normalizeType(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (TYPE_IDS.includes(key)) return key;
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
  const match = TYPES.find(
    (type) =>
      type.label.toLowerCase() === key || type.shortLabel.toLowerCase() === key,
  );
  return match?.id ?? null;
}

export function parseDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toISO(iso[1], iso[2], iso[3]);

  const isoSlash = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (isoSlash) return toISO(isoSlash[1], isoSlash[2], isoSlash[3]);

  const numeric = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    let year = Number(numeric[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    if (first > 12 && second <= 12) return toISO(year, second, first);
    if (second > 12 && first <= 12) return toISO(year, first, second);
    return toISO(year, first, second);
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed);
    if (!Number.isNaN(date.getTime())) {
      return toISO(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }
  }
  return null;
}

function parseCount(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return 0;
  }
  const num = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function mapHeaders(cells) {
  const map = {};
  cells.forEach((cell, index) => {
    const key = String(cell ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/[^\w\s&]/g, "")
      .replace(/\s+/g, " ");
    const field = HEADER_ALIASES[key];
    if (field && map[field] === undefined) map[field] = index;
  });
  return map;
}

function cellAt(cells, index) {
  if (index === undefined || index === null) return "";
  return cells[index] ?? "";
}

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    if (row.length > 1 || row.some((cell) => cell.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      pushField();
      continue;
    }
    if (char === "\n") {
      pushField();
      pushRow();
      continue;
    }
    if (char === "\r") {
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  return rows;
}

function escapeCsvField(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function toISO(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
