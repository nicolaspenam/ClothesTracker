import { TYPES, formatDate, plural, todayISO, typeShortLabel } from "./constants.js";
import { parseCsv, serializeItems } from "./csv.js";
import { Store } from "./store.js";

const store = new Store();
const listEl = document.getElementById("list");
const searchEl = document.getElementById("search");
const itemDialog = document.getElementById("item-dialog");
const dataDialog = document.getElementById("data-dialog");
const itemForm = document.getElementById("item-form");
const deleteBtn = document.getElementById("delete-item");
const toastEl = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const toastAction = document.getElementById("toast-action");
const installBanner = document.getElementById("install-banner");
const importText = document.getElementById("import-text");
const importPreview = document.getElementById("import-preview");
const shareBtn = document.getElementById("share-csv");

const state = {
  filter: "all",
  query: "",
  toastTimer: 0,
  undo: null,
  deferredPrompt: null,
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredPrompt = event;
  installBanner.classList.add("show");
});

document.getElementById("install-btn").addEventListener("click", async () => {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  installBanner.classList.remove("show");
});

document.querySelector(".filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  for (const chip of document.querySelectorAll(".filters .chip")) {
    chip.setAttribute("aria-pressed", String(chip === button));
  }
  render();
});

searchEl.addEventListener("input", () => {
  state.query = searchEl.value.trim().toLowerCase();
  render();
});

document.getElementById("add-item").addEventListener("click", () => openItemDialog());
document.getElementById("close-item").addEventListener("click", () => itemDialog.close());
document.getElementById("open-data").addEventListener("click", () => {
  refreshShareVisibility();
  dataDialog.showModal();
});
document.getElementById("close-data").addEventListener("click", () => dataDialog.close());

for (const dialog of [itemDialog, dataDialog]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.getElementById("use-today").addEventListener("click", () => {
  itemForm.elements.firstUsed.value = todayISO();
});

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(itemForm);
  const payload = {
    name: String(data.get("name") || "").trim(),
    type: String(data.get("type") || ""),
    firstUsed: String(data.get("firstUsed") || "") || null,
  };
  if (!payload.name || !payload.type) return;

  const id = String(data.get("id") || "");
  if (id) store.update(id, payload);
  else store.add(payload);
  itemDialog.close();
  render();
  showToast(id ? "Clothing updated." : "Added to your closet.");
});

deleteBtn.addEventListener("click", () => {
  const id = itemForm.elements.id.value;
  const current = store.get(id);
  if (!id || !current) return;
  if (!confirm(`Delete ${current.name}?`)) return;
  store.remove(id);
  itemDialog.close();
  render();
  showToast(`Deleted ${current.name}.`, {
    label: "Undo",
    onAction: () => {
      store.add(current);
      render();
    },
  });
});

listEl.addEventListener("click", (event) => {
  const card = event.target.closest("[data-id]");
  if (!card) return;
  const id = card.dataset.id;
  if (event.target.closest("[data-action='plus']")) {
    store.increment(id);
    vibrate();
    render();
    return;
  }
  if (event.target.closest("[data-action='minus']")) {
    const before = store.get(id);
    if (!before || before.usesSinceWash <= 0) return;
    store.decrement(id);
    render();
    return;
  }
  if (event.target.closest("[data-action='wash']")) {
    const before = store.get(id);
    if (!before || before.usesSinceWash === 0) return;
    store.resetWash(id);
    render();
    showToast(`${before.name} reset to 0 wears since wash.`, {
      label: "Undo",
      onAction: () => {
        store.update(id, { usesSinceWash: before.usesSinceWash });
        render();
      },
    });
    return;
  }
  if (event.target.closest("[data-action='edit']")) {
    openItemDialog(id);
  }
});

document.getElementById("download-csv").addEventListener("click", () => {
  downloadCsv();
  showToast("CSV downloaded.");
});

document.getElementById("copy-csv").addEventListener("click", async () => {
  const csv = serializeItems(store.list());
  await copyText(csv);
  showToast("CSV copied. Paste it into Google Sheets.");
});

shareBtn.addEventListener("click", async () => {
  const file = csvFile();
  try {
    await navigator.share({
      files: [file],
      title: "ClothesTracker export",
      text: "ClothesTracker closet CSV",
    });
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Sharing is not available here.");
  }
});

document.getElementById("import-file").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  importText.value = await file.text();
  updateImportPreview();
});

importText.addEventListener("input", updateImportPreview);

document.getElementById("run-import").addEventListener("click", () => {
  const parsed = parseCsv(importText.value);
  if (parsed.items.length === 0) {
    importPreview.className = "preview error";
    importPreview.textContent = parsed.errors[0] || "No clothing rows found.";
    return;
  }
  const mode = document.querySelector("input[name='import-mode']:checked")?.value;
  const snapshot = store.list();
  if (mode === "merge") store.merge(parsed.items);
  else store.replaceAll(parsed.items);
  dataDialog.close();
  render();
  const message =
    mode === "merge"
      ? `Imported ${parsed.items.length} ${plural(parsed.items.length, "item")} (merged).`
      : `Imported ${parsed.items.length} ${plural(parsed.items.length, "item")}.`;
  showToast(message, {
    label: "Undo",
    onAction: () => {
      store.replaceAll(snapshot);
      render();
    },
  });
});

store.subscribe(render);
render();

function render() {
  const items = visibleItems();
  if (items.length === 0) {
    listEl.innerHTML = emptyState();
    return;
  }

  if (state.filter === "all" && !state.query) {
    listEl.innerHTML = TYPES.map((type) => {
      const group = items.filter((item) => item.type === type.id);
      if (group.length === 0) return "";
      return `<h2 class="section">${escapeHtml(type.label)}</h2>${group.map(cardHtml).join("")}`;
    }).join("");
    return;
  }

  listEl.innerHTML = items.map(cardHtml).join("");
}

function visibleItems() {
  const query = state.query;
  return store.list().filter((item) => {
    if (state.filter !== "all" && item.type !== state.filter) return false;
    if (query && !item.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

function emptyState() {
  if (store.list().length === 0) {
    return `<div class="empty"><h2>Your closet is empty</h2><p>Add pants, shorts, or a sweater, then tap + each time you wear it.</p></div>`;
  }
  return `<div class="empty"><h2>Nothing matches</h2><p>Try another type or search.</p></div>`;
}

function cardHtml(item) {
  const first = item.firstUsed
    ? `First used ${escapeHtml(formatDate(item.firstUsed))}`
    : "No first-used date";
  return `
    <article class="card" data-id="${escapeHtml(item.id)}">
      <div class="card-head">
        <div>
          <h3 class="card-name">${escapeHtml(item.name)}</h3>
          <p class="card-meta">${first}</p>
        </div>
        <span class="badge badge-${item.type}">${escapeHtml(typeShortLabel(item.type))}</span>
      </div>
      <div class="card-body">
        <div class="wear">
          <div class="wear-count">${item.usesSinceWash}</div>
          <div class="wear-label">${plural(item.usesSinceWash, "wear")} since wash</div>
          <div class="lifetime">Lifetime <strong>${item.totalUses}</strong> ${plural(item.totalUses, "wear")}</div>
        </div>
        <div class="actions">
          <button class="btn btn-wash" type="button" data-action="wash" ${item.usesSinceWash === 0 ? "disabled" : ""}>Washed</button>
          <button class="btn-minus" type="button" data-action="minus" aria-label="Minus one wear" ${item.usesSinceWash === 0 ? "disabled" : ""}>−</button>
          <button class="btn-plus" type="button" data-action="plus" aria-label="Plus one wear">+</button>
        </div>
      </div>
      <button class="edit-link" type="button" data-action="edit">Edit details</button>
    </article>
  `;
}

function openItemDialog(id) {
  itemForm.reset();
  const item = id ? store.get(id) : null;
  document.getElementById("item-dialog-title").textContent = item
    ? "Edit clothing"
    : "Add clothing";
  itemForm.elements.id.value = item?.id ?? "";
  itemForm.elements.name.value = item?.name ?? "";
  itemForm.elements.firstUsed.value = item?.firstUsed ?? "";
  const type = item?.type ?? "pants";
  const typeInput = itemForm.querySelector(`input[name="type"][value="${type}"]`);
  if (typeInput) typeInput.checked = true;
  deleteBtn.hidden = !item;
  itemDialog.showModal();
  itemForm.elements.name.focus();
}

function csvFile() {
  const csv = "\uFEFF" + serializeItems(store.list());
  return new File([csv], "clothes-tracker.csv", { type: "text/csv;charset=utf-8" });
}

function downloadCsv() {
  const file = csvFile();
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateImportPreview() {
  const parsed = parseCsv(importText.value);
  importPreview.className = "preview";
  if (!importText.value.trim()) {
    importPreview.textContent = "";
    return;
  }
  if (parsed.items.length === 0) {
    importPreview.className = "preview error";
    importPreview.textContent = parsed.errors[0] || "No clothing rows found.";
    return;
  }
  const extra = parsed.errors.length
    ? ` ${parsed.errors.length} ${plural(parsed.errors.length, "row")} skipped.`
    : "";
  importPreview.textContent = `Ready to import ${parsed.items.length} ${plural(parsed.items.length, "item")}.${extra}`;
}

function refreshShareVisibility() {
  const file = csvFile();
  const canShare =
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });
  shareBtn.hidden = !canShare;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function showToast(message, action) {
  clearTimeout(state.toastTimer);
  state.undo = action?.onAction ?? null;
  toastMessage.textContent = message;
  toastAction.hidden = !action;
  toastAction.textContent = action?.label || "Undo";
  toastEl.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
    state.undo = null;
  }, 5000);
}

toastAction.addEventListener("click", () => {
  state.undo?.();
  toastEl.hidden = true;
  state.undo = null;
});

function vibrate() {
  navigator.vibrate?.(12);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
