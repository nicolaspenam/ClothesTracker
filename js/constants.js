export const STORAGE_KEY = "clothes-tracker:v1";

export const TYPES = [
  { id: "pants", label: "Pants", shortLabel: "Pants" },
  { id: "shorts", label: "Shorts", shortLabel: "Shorts" },
  { id: "sweaters", label: "Sweaters & Hoodies", shortLabel: "Sweaters" },
];

export const TYPE_IDS = TYPES.map((type) => type.id);

export const CSV_HEADERS = [
  "Name",
  "Type",
  "First Used",
  "Uses Since Wash",
  "Total Uses",
  "Id",
];

export function typeLabel(id) {
  return TYPES.find((type) => type.id === id)?.label ?? id;
}

export function typeShortLabel(id) {
  return TYPES.find((type) => type.id === id)?.shortLabel ?? id;
}

export function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}
