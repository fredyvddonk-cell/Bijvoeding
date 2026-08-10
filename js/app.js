let data = loadData();
let currentMode = "drink";

const CUPBOARD_ORDER = [
  ["Abound", "Neutraal"], ["Abound", "Sinaasappel"],
  ["Nutridrink Crème 2 kcal Protein", "Banaan"], ["Nutridrink Crème 2 kcal Protein", "Bosvruchten"], ["Nutridrink Crème 2 kcal Protein", "Chocolade"], ["Nutridrink Crème 2 kcal Protein", "Mokka"], ["Nutridrink Crème 2 kcal Protein", "Vanille"],
  ["Ensure Two Cal", "Aardbei"], ["Ensure Two Cal", "Banaan"], ["Ensure Two Cal", "Vanille"],
  ["Glucerna Advance", "Aardbei"], ["Glucerna Advance", "Koffie"],
  ["Ensure Plus Advance", "Aardbei"], ["Ensure Plus Advance", "Banaan"], ["Ensure Plus Advance", "Chocolade"], ["Ensure Plus Advance", "Koffie"], ["Ensure Plus Advance", "Vanille"],
  ["Glucerna Advance", "Vanille"]
];

function canonicalName(name) {
  return name === "Glucerna" ? "Glucerna Advance" : name;
}
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseLocalDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function daysBetween(a, b) {
  return Math.floor((b - a) / 86400000);
}
function formatDate(s) {
  const d = parseLocalDate(s);
  return d ? d.toLocaleDateString("nl-NL") : "";
}
function cloneDefaults() {
  return typeof structuredClone === "function" ? structuredClone(defaults) : JSON.parse(JSON.stringify(defaults));
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const d = stored ? JSON.parse(stored) : cloneDefaults();

    if (!d.settings) d.settings = { drinkWeeks: 3, sondeWeeks: 3 };
    if (!Array.isArray(d.products)) d.products = [];
    if (!Array.isArray(d.rooms)) d.rooms = [];

    d.products.forEach((p, i) => {
      p.name = canonicalName(p.name);
      if (p.order == null) p.order = i + 1;
      if (p.minimumStock == null) p.minimumStock = 0;
      if (p.expiryDate == null) p.expiryDate = "";
      if (p.lastExpiryCheck == null) p.lastExpiryCheck = "";
      if (p.active == null) p.active = true;
      // 2.7.2: behoud bij bestaande producten het gedrag uit 2.7.1.
      // Daarna kan dit per product op Ja/Nee worden gezet.
      if (p.looseUnitsAllowed == null) p.looseUnitsAllowed = Number(p.contentPerOrderUnit || 1) > 1;
    });

    // Oude kamerregistraties omzetten naar de rustige structuur:
    // product kiezen + één of meer voorkeurssmaken aanvinken.
    d.rooms.forEach(r => {
      if (!Array.isArray(r.selectedProductIds)) r.selectedProductIds = [];

      if (r.productId) {
        const p = d.products.find(x => x.id === r.productId);
        if (p) {
          r.productName = canonicalName(p.name);
          if (p.flavor === "Niet gespecificeerd") {
            r.allFlavors = true;
            r.selectedProductIds = d.products
              .filter(x => x.mode === r.mode && x.active !== false && canonicalName(x.name) === canonicalName(p.name) && x.flavor !== "Niet gespecificeerd")
              .map(x => x.id);
          } else {
            r.selectedProductIds = [p.id];
            r.allFlavors = false;
          }
        }
      }

      if (r.allFlavors && r.productName) {
        const active = d.products.filter(p => p.mode === r.mode && p.active !== false && canonicalName(p.name) === canonicalName(r.productName));
        r.selectedProductIds = active.map(p => p.id);
      }

      r.productName = r.productName ? canonicalName(r.productName) : r.productName;
      r.productId = null;
    });

    // Verwijderde standaardproducten worden bewust niet opnieuw toegevoegd.
    d.products = d.products.filter(p => p.flavor !== "Niet gespecificeerd");

    if (!d.settings.cupboardOrderApplied) {
      const rank = p => {
        const i = CUPBOARD_ORDER.findIndex(([n, f]) => n === canonicalName(p.name) && f === p.flavor);
        return i < 0 ? 1000 + Number(p.order || 0) : i;
      };
      d.products.filter(p => p.mode === "drink").sort((a, b) => rank(a) - rank(b)).forEach((p, i) => p.order = i + 1);
      d.settings.cupboardOrderApplied = true;
    }

    return d;
  } catch (e) {
    return cloneDefaults();
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[s]));
}
function fmt(n) {
  return Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(1).replace(".", ",");
}
function modeLabel() {
  return currentMode === "drink" ? "Bijvoeding" : currentMode === "sonde" ? "Sondevoeding" : "Algemene voorraad";
}
function targetWeeks() {
  return currentMode === "drink" ? data.settings.drinkWeeks : data.settings.sondeWeeks;
}
function productsForMode(mode = currentMode) {
  return data.products.filter(p => p.mode === mode).sort((a, b) => Number(a.order) - Number(b.order));
}
function roomsForMode(mode = currentMode) {
  return data.rooms.filter(r => r.mode === mode);
}
function variantLabel(p) {
  if (!p) return "";
  if (p.mode === "sonde") return `${fmt(p.contentPerOrderUnit || 0)} ${p.consumptionUnit || "ml"}`;
  return p.flavor || "";
}
function labelProduct(p) {
  const variant = variantLabel(p);
  return variant ? `${p.name} · ${variant}` : (p?.name || "Product");
}
function plural(unit, n) {
  const m = { flesje: "flesjes", bakje: "bakjes", fles: "flessen", karton: "kartons", doos: "dozen", pot: "potten", pak: "pakken" };
  return Number(n) === 1 ? unit : (m[unit] || unit + "en");
}
function activeProduct(p) {
  return p.active !== false;
}
function hasLooseUnits(p) {
  return Number(p?.contentPerOrderUnit || 1) > 1 && p?.looseUnitsAllowed !== false;
}
function looseUnitLabel(p, n = 2) {
  const u = p?.consumptionUnit || "stuks";
  if (u === "ml") return "ml";
  if (Number(n) === 1) {
    const singular = { flesjes:"flesje", bakjes:"bakje", zakjes:"zakje", stuks:"stuk" };
    return singular[u] || u;
  }
  return u;
}
function packageCountLabel(p, n) {
  const unit = plural(p.orderUnit, n);
  return `${fmt(n)} ${unit} van ${fmt(p.contentPerOrderUnit || 1)}`;
}
function familyProducts(name, mode, includeInactive = false) {
  return data.products
    .filter(p => p.mode === mode && canonicalName(p.name) === canonicalName(name) && (includeInactive || activeProduct(p)))
    .sort((a, b) => Number(a.order) - Number(b.order));
}
function familyNames(mode) {
  const names = [];
  productsForMode(mode).filter(activeProduct).forEach(p => {
    if (!names.includes(p.name)) names.push(p.name);
  });
  return names;
}
function activeFlavorIds(name, mode) {
  return familyProducts(name, mode).map(p => p.id);
}
function roomMatchesProduct(r, p) {
  if (!activeProduct(p)) return false;
  if (canonicalName(r.productName) !== canonicalName(p.name)) return false;
  if (r.mode === "drink" && r.allFlavors) return true;
  return Array.isArray(r.selectedProductIds) && r.selectedProductIds.includes(p.id);
}
function dailyUsage(pid) {
  const p = data.products.find(x => x.id === pid);
  if (!p || !activeProduct(p)) return 0;
  return data.rooms
    .filter(r => r.mode === p.mode && roomMatchesProduct(r, p))
    .reduce((sum, r) => sum + Number(r.dailyAmount || 0), 0);
}
function isInUse(p) {
  return dailyUsage(p.id) > 0;
}
function stockUnits(p) {
  return Number(p.stockFull || 0) * Number(p.contentPerOrderUnit || 1) + (hasLooseUnits(p) ? Number(p.stockLoose || 0) : 0);
}
function orderedUnits(p) {
  return Number(p.alreadyOrdered || 0) * Number(p.contentPerOrderUnit || 1);
}
function stockPackages(p) {
  return Number(p.stockFull || 0) + (hasLooseUnits(p) ? Number(p.stockLoose || 0) / Number(p.contentPerOrderUnit || 1) : 0);
}
const DELIVERY_DAYS = 10;
function familyDailyUsage(name, mode) {
  return data.rooms
    .filter(r => r.mode === mode && canonicalName(r.productName) === canonicalName(name))
    .reduce((sum, r) => sum + Number(r.dailyAmount || 0), 0);
}
function familyStockUnits(name, mode) {
  return familyProducts(name, mode, true).reduce((sum, p) => sum + stockUnits(p) + orderedUnits(p), 0);
}
function familyDaysSupply(p) {
  if (p.mode === "general") return null;
  const daily = familyDailyUsage(p.name, p.mode);
  if (daily <= 0) return null;
  return familyStockUnits(p.name, p.mode) / daily;
}
function familyDaysSupplyText(p) {
  const days = familyDaysSupply(p);
  if (days == null) return "Niet in gebruik";
  const rounded = Math.floor(days * 10) / 10;
  return `± ${fmt(rounded)} ${rounded === 1 ? "dag" : "dagen"} voorraad`;
}
function autoMinimumUnits(p) {
  if (p.mode === "general") return Number(p.minimumStock || 0) * Number(p.contentPerOrderUnit || 1);
  // Bijvoeding: minimum voor het product als geheel; alle smaken tellen samen.
  // Sondevoeding: 500 ml / 1000 ml zijn aparte varianten en worden per kamer vast gekozen.
  if (p.mode === "sonde") return dailyUsage(p.id) * DELIVERY_DAYS;
  return familyDailyUsage(p.name, p.mode) * DELIVERY_DAYS;
}
function belowMinimum(p) {
  if (p.mode === "general") return stockPackages(p) < Number(p.minimumStock || 0);
  if (p.mode === "sonde") return stockUnits(p) < autoMinimumUnits(p);
  return familyStockUnits(p.name, p.mode) < autoMinimumUnits(p);
}
function minimumText(p) {
  if (p.mode === "general") return `${fmt(p.minimumStock || 0)} ${plural(p.orderUnit, p.minimumStock || 0)}`;
  const units = autoMinimumUnits(p);
  const unit = p.consumptionUnit || looseUnitLabel(p, units);
  return `${fmt(units)} ${unit} (10 dagen)`;
}
function daysSupply(p) {
  const d = dailyUsage(p.id);
  return d > 0 ? stockUnits(p) / d : null;
}
function expiryInfo(p) {
  const today = parseLocalDate(isoToday());
  const last = parseLocalDate(p.lastExpiryCheck);
  const quarterlyDue = !last || daysBetween(last, today) >= 90;
  let expiryDays = null, expired = false, soon = false;
  if (p.expiryDate) {
    expiryDays = daysBetween(today, parseLocalDate(p.expiryDate));
    expired = expiryDays < 0;
    soon = expiryDays >= 0 && expiryDays <= 60;
  }
  return { quarterlyDue, expiryDays, expired, soon };
}
function advice(p) {
  const daily = dailyUsage(p.id);
  const weekly = daily * 7;
  const usageTarget = currentMode === "general" ? Number(p.generalTarget || 0) : weekly * targetWeeks();
  const minimumTarget = autoMinimumUnits(p);
  const needed = currentMode === "general"
    ? Math.max(usageTarget, minimumTarget)
    : (daily > 0 && activeProduct(p) ? Math.max(usageTarget, minimumTarget) : 0);
  const available = stockUnits(p) + orderedUnits(p);
  const shortage = Math.max(0, needed - available);
  return { daily, weekly, usageTarget, minimumTarget, needed, available, orderUnits: Math.ceil(shortage / Number(p.contentPerOrderUnit || 1)) };
}

function roomOptionValue(name) {
  return `group:${encodeURIComponent(name)}`;
}
function parseRoomProductName(value) {
  return value.startsWith("group:") ? decodeURIComponent(value.slice(6)) : "";
}
function roomOptions(mode) {
  const names = familyNames(mode);
  return names.length
    ? names.map(name => `<option value="${esc(roomOptionValue(name))}">${esc(name)}</option>`).join("")
    : `<option value="">Nog geen product</option>`;
}
function selectedRoomMode(selectEl) {
  if (selectEl === editRoomProduct && editingRoomId) {
    return data.rooms.find(r => r.id === editingRoomId)?.mode || currentMode;
  }
  return currentMode;
}
function setRoomUnitFromProduct(selectEl, unitEl) {
  const name = parseRoomProductName(selectEl.value);
  const p = familyProducts(name, selectedRoomMode(selectEl))[0];
  if (p) unitEl.value = p.consumptionUnit;
}
function renderFlavorChoices(selectEl, boxEl, checkedIds = [], forceAll = false) {
  const mode = selectedRoomMode(selectEl);
  const name = parseRoomProductName(selectEl.value);
  if (!name) { boxEl.classList.add("hidden"); boxEl.innerHTML = ""; return; }

  const active = familyProducts(name, mode);
  const inactiveSelected = data.products.filter(p => p.mode === mode && !activeProduct(p) && canonicalName(p.name) === canonicalName(name) && checkedIds.includes(p.id));
  if (active.length <= 1 && !inactiveSelected.length) { boxEl.classList.add("hidden"); boxEl.innerHTML = ""; return; }

  if (mode === "sonde") {
    const selectedIds = checkedIds.filter(id => active.some(p => p.id === id));
    const rows = active.map(p => `<label class="flavor-check"><input type="checkbox" value="${esc(p.id)}" ${selectedIds.includes(p.id) ? "checked" : ""}><span>${esc(variantLabel(p))}</span></label>`).join("");
    const inactiveRows = inactiveSelected.map(p => `<label class="flavor-check inactive-flavor"><input type="checkbox" value="${esc(p.id)}" checked disabled><span>${esc(variantLabel(p))} <small>niet actief</small></span></label>`).join("");
    boxEl.innerHTML = `<div class="flavor-choice-head"><div class="flavor-choice-title">Inhoud / variant</div><button type="button" class="text-btn flavor-all-btn">Alles aanvinken</button></div><div class="flavor-choice-grid">${rows}${inactiveRows}</div>`;
    boxEl.classList.remove("hidden");
    const allBtn = boxEl.querySelector(".flavor-all-btn");
    if (allBtn) allBtn.onclick = () => boxEl.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true);
    return;
  }

  const flavored = active.filter(p => p.flavor);
  if (!flavored.length && !inactiveSelected.length) { boxEl.classList.add("hidden"); boxEl.innerHTML = ""; return; }
  const allChecked = forceAll || (active.length > 0 && active.every(p => checkedIds.includes(p.id)));
  const rows = flavored.map(p => `<label class="flavor-check"><input type="checkbox" value="${esc(p.id)}" ${allChecked || checkedIds.includes(p.id) ? "checked" : ""}><span>${esc(p.flavor)}</span></label>`).join("");
  const inactiveRows = inactiveSelected.map(p => `<label class="flavor-check inactive-flavor"><input type="checkbox" value="${esc(p.id)}" checked disabled><span>${esc(p.flavor || "Zonder smaak")} <small>niet actief</small></span></label>`).join("");
  boxEl.innerHTML = `<div class="flavor-choice-head"><div class="flavor-choice-title">Voorkeurssmaken</div><button type="button" class="text-btn flavor-all-btn">Alles aanvinken</button></div><div class="flavor-choice-grid">${rows}${inactiveRows}</div>`;
  boxEl.classList.remove("hidden");
  const allBtn = boxEl.querySelector(".flavor-all-btn");
  if (allBtn) allBtn.onclick = () => boxEl.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(cb => cb.checked = true);
}
function selectedFlavorIds(boxEl) {
  return [...boxEl.querySelectorAll('input:checked:not(:disabled)')].map(x => x.value);
}
function selectionForRoom(name, mode, boxEl) {
  const active = familyProducts(name, mode);
  const flavored = active.filter(p => p.flavor);
  if (!active.length) return { ids: [], allFlavors: false };
  if (mode === "sonde") {
    const ids = selectedFlavorIds(boxEl);
    return { ids, allFlavors: false };
  }
  if (!flavored.length) return { ids: [active[0].id], allFlavors: false };

  const ids = selectedFlavorIds(boxEl);
  const allFlavors = active.length > 0 && active.every(p => ids.includes(p.id));
  return { ids, allFlavors };
}
function renderProductOptions() {
  roomProduct.innerHTML = roomOptions(currentMode);
  generalProduct.innerHTML = productsForMode().filter(activeProduct).map(p => `<option value="${p.id}">${esc(labelProduct(p))}</option>`).join("") || `<option value="">Nog geen artikel</option>`;
  setRoomUnitFromProduct(roomProduct, dailyUnit);
  renderFlavorChoices(roomProduct, roomFlavorChoices, []);
}

function useBadge(p) {
  if (!activeProduct(p)) return `<span class="badge inactive-badge">Niet actief</span>`;
  return isInUse(p) ? `<span class="badge use-yes">In gebruik</span>` : `<span class="badge use-no">Niet in gebruik</span>`;
}
function daysSupplyText(p) {
  if (!activeProduct(p)) return "Niet actief";
  const days = daysSupply(p);
  if (days == null) return "Niet in gebruik";
  if (!Number.isFinite(days)) return "—";
  const rounded = Math.floor(days * 10) / 10;
  return `${fmt(rounded)} ${rounded === 1 ? "dag" : "dagen"} voorraad`;
}
function thtStatusHtml(p) {
  const e = expiryInfo(p);
  const bits = [];
  if (e.expired) bits.push(`<span class="status-danger">THT verstreken</span>`);
  else if (e.soon) bits.push(`<span class="status-warn">THT ${esc(formatDate(p.expiryDate))} · Let op</span>`);
  else if (p.expiryDate) bits.push(`<span class="muted">THT ${esc(formatDate(p.expiryDate))}</span>`);
  if (e.quarterlyDue) bits.push(`<span class="status-warn">THT controleren</span>`);
  return bits.join("<br>");
}
function thtBadgeHtml(p) {
  const e = expiryInfo(p);
  if (e.expired) return `<span class="attention-chip danger-chip">THT verstreken</span>`;
  if (e.soon) return `<span class="attention-chip warn-chip">THT ${esc(formatDate(p.expiryDate))}</span>`;
  if (e.quarterlyDue) return `<span class="attention-chip neutral-chip">THT controleren</span>`;
  if (p.expiryDate) return `<span class="attention-chip neutral-chip">THT ${esc(formatDate(p.expiryDate))}</span>`;
  return "";
}

function renderCounting() {
  const ps = productsForMode();
  countList.innerHTML = ps.length ? ps.map(p => {
    const loose = hasLooseUnits(p);
    const unusedStock = currentMode !== "general" && !isInUse(p) && stockUnits(p) > 0;
    return `<div class="item count-card ${unusedStock ? "unused-stock" : ""}">
      <div class="item-head">
        <div><strong>${esc(labelProduct(p))}</strong><div class="count-meta">${currentMode === "general" ? "" : useBadge(p)}</div></div>
        <div class="days-pill">${currentMode === "general" ? "" : esc(daysSupplyText(p))}</div>
      </div>
      ${unusedStock ? `<div class="status-warn" style="margin-top:8px">Voorraad aanwezig, maar momenteel niet in gebruik</div>` : ""}
      <span class="muted">${hasLooseUnits(p) ? `Bestelverpakking: ${esc(plural(p.orderUnit, 2))} van ${fmt(p.contentPerOrderUnit)} ${esc(looseUnitLabel(p, 2))}` : `Voorraad in ${esc(plural(p.orderUnit, 2))}`}</span>
      ${currentMode !== "general" && activeProduct(p) && isInUse(p) && belowMinimum(p) ? `<div class="status-danger" style="margin-top:6px">Onder minimumvoorraad</div>` : ""}
      <div class="counter-wrap"><button class="counter-btn" onclick="changeStock('${p.id}',-1)">−</button><div class="counter-value">${hasLooseUnits(p) ? esc(packageCountLabel(p, p.stockFull)) : `${fmt(p.stockFull)} ${esc(plural(p.orderUnit, p.stockFull))}`}</div><button class="counter-btn" onclick="changeStock('${p.id}',1)">+</button></div>
      ${loose ? `<div style="margin-top:12px"><span class="muted">Losse ${esc(looseUnitLabel(p, 2))}</span><div class="counter-wrap"><button class="counter-btn" onclick="changeLoose('${p.id}',-1)">−</button><div class="counter-value">${fmt(p.stockLoose)} ${esc(looseUnitLabel(p, p.stockLoose))}</div><button class="counter-btn" onclick="changeLoose('${p.id}',1)">+</button></div><div class="count-total">Totaal: <strong>${fmt(stockUnits(p))} ${esc(looseUnitLabel(p, stockUnits(p)))}</strong></div></div>` : ""}
      ${currentMode !== "general" ? `<div class="expiry-line">${thtStatusHtml(p) || `<span class="muted">THT nog niet vastgelegd</span>`}</div><button class="secondary compact-btn" onclick="openExpiryModal('${p.id}')">THT</button>` : ""}
    </div>`;
  }).join("") : `<div class="empty">Nog geen producten.</div>`;
}

function roomProductLabel(r) {
  const name = r.productName || "Product";
  const active = familyProducts(name, r.mode);
  if (r.mode === "drink" && r.allFlavors && active.length) return `${name} · Alle smaken`;
  const selected = (r.selectedProductIds || []).map(id => data.products.find(x => x.id === id)).filter(Boolean);
  if (!selected.length) return name;
  const variants = selected.map(p => `${variantLabel(p) || "Zonder smaak"}${activeProduct(p) ? "" : " (niet actief)"}`);
  return `${name} · ${variants.join(", ")}`;
}
function renderUsage() {
  if (currentMode === "general") {
    roomFormCard.classList.add("hidden");
    generalTargetCard.classList.remove("hidden");
    usageListTitle.textContent = "Algemene artikelen";
    const ps = productsForMode();
    usageList.innerHTML = ps.length ? ps.map(p => `<div class="item"><strong>${esc(labelProduct(p))}</strong><br><span class="muted">Gewenste voorraad: ${fmt(p.generalTarget || 0)} ${esc(plural(p.orderUnit, p.generalTarget || 0))}</span></div>`).join("") : `<div class="empty">Nog geen algemene artikelen.</div>`;
    return;
  }

  roomFormCard.classList.remove("hidden");
  generalTargetCard.classList.add("hidden");
  usageListTitle.textContent = "Ingevoerde kamers";
  const rs = roomsForMode().sort((a, b) => Number(a.unit) - Number(b.unit) || String(a.room).localeCompare(String(b.room), undefined, { numeric: true }) || roomProductLabel(a).localeCompare(roomProductLabel(b)));
  usageList.innerHTML = rs.length ? rs.map(r => `<div class="item">
    <div class="item-head"><div><strong>Kamer ${esc(r.room)}</strong><br><span class="muted">Unit ${esc(r.unit)} · ${esc(roomProductLabel(r))}</span></div></div>
    <div style="margin-top:8px"><strong>${fmt(r.dailyAmount)} ${esc(r.dailyUnit)} per dag</strong></div>
    <div class="actions"><button class="small-primary" onclick="editRoom('${r.id}')">Wijzigen</button><button class="small-danger" onclick="deleteRoom('${r.id}')">Verwijderen</button></div>
  </div>`).join("") : `<div class="empty">Nog geen kamers ingevoerd.</div>`;
}

function renderProducts() {
  const ps = productsForMode();
  productList.innerHTML = ps.length ? ps.map(p => `<div class="item product-sort-item ${!activeProduct(p) ? "inactive-product" : ""}" data-product-id="${p.id}">
    <div class="item-head">
      <div><strong>${esc(labelProduct(p))}</strong><br><span class="muted">${hasLooseUnits(p) ? `Bestelverpakking: ${esc(plural(p.orderUnit, 2))} van ${fmt(p.contentPerOrderUnit)} ${esc(looseUnitLabel(p, 2))}` : `Voorraad in ${esc(plural(p.orderUnit, 2))}`}</span><div style="margin-top:6px">${currentMode !== "general" ? useBadge(p) : ""}</div></div>
      <button type="button" class="drag-handle" aria-label="Sleep om product te verplaatsen" title="Sleep om te verplaatsen"><span aria-hidden="true">☰</span><span class="drag-label">Slepen</span></button>
    </div>
    <div style="margin-top:8px">Voorraad: <strong>${fmt(p.stockFull)} ${esc(plural(p.orderUnit, p.stockFull))}${hasLooseUnits(p) ? ` + ${fmt(p.stockLoose)} ${esc(looseUnitLabel(p, p.stockLoose))} = ${fmt(stockUnits(p))} ${esc(looseUnitLabel(p, stockUnits(p)))}` : ""}</strong><br>Besteld: <strong>${fmt(p.alreadyOrdered)} ${esc(plural(p.orderUnit, p.alreadyOrdered))}</strong><br>Minimum: <strong>${esc(minimumText(p))}</strong>${currentMode !== "general" ? `<br><span class="muted">${esc(daysSupplyText(p))}</span>` : ""}</div>
    <div class="actions"><button class="small-primary" onclick="editStock('${p.id}')">Wijzigen</button><button class="small-danger" onclick="deleteProduct('${p.id}')">Verwijderen</button></div>
  </div>`).join("") : `<div class="empty">Nog geen producten.</div>`;
}

let draggedProductItem = null;
productList.addEventListener("pointerdown", e => {
  const handle = e.target.closest(".drag-handle");
  if (!handle) return;
  const item = handle.closest(".product-sort-item");
  if (!item) return;
  draggedProductItem = item;
  item.classList.add("dragging");
  handle.setPointerCapture?.(e.pointerId);
  e.preventDefault();
});
productList.addEventListener("pointermove", e => {
  if (!draggedProductItem) return;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".product-sort-item");
  if (!target || target === draggedProductItem || target.parentElement !== productList) return;
  const rect = target.getBoundingClientRect();
  productList.insertBefore(draggedProductItem, e.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
});
function finishProductDrag() {
  if (!draggedProductItem) return;
  draggedProductItem.classList.remove("dragging");
  draggedProductItem = null;
  [...productList.querySelectorAll(".product-sort-item")].forEach((el, i) => {
    const p = data.products.find(x => x.id === el.dataset.productId);
    if (p) p.order = i + 1;
  });
  saveData();
}
productList.addEventListener("pointerup", finishProductDrag);
productList.addEventListener("pointercancel", finishProductDrag);

function drinkFamilyOrderInfo(name) {
  const products = familyProducts(name, "drink", true);
  const active = products.filter(activeProduct);
  const rooms = data.rooms.filter(r => r.mode === "drink" && canonicalName(r.productName) === canonicalName(name));
  const daily = rooms.reduce((sum, r) => sum + Number(r.dailyAmount || 0), 0);
  const preferredIds = new Set();
  rooms.forEach(r => {
    if (r.allFlavors) active.forEach(p => preferredIds.add(p.id));
    else (r.selectedProductIds || []).forEach(id => preferredIds.add(id));
  });
  // Oude kamerdata zonder expliciete voorkeur: alle actieve smaken mogen meetellen.
  if (!preferredIds.size && rooms.length) active.forEach(p => preferredIds.add(p.id));
  const preferred = products.filter(p => preferredIds.has(p.id));
  const other = products.filter(p => !preferredIds.has(p.id) && (stockUnits(p) + orderedUnits(p)) > 0);
  const available = preferred.reduce((sum, p) => sum + stockUnits(p) + orderedUnits(p), 0);
  const needed = daily > 0 ? Math.max(daily * 7 * targetWeeks(), daily * DELIVERY_DAYS) : 0;
  const shortage = Math.max(0, needed - available);
  const rep = preferred.find(activeProduct) || active[0] || products[0];
  const pack = Number(rep?.contentPerOrderUnit || 1);
  const orderUnits = pack > 0 ? Math.ceil(shortage / pack) : 0;
  return { name, products, rooms, daily, preferred, other, available, needed, orderUnits, rep };
}

function renderDrinkOrders() {
  const groups = familyNames("drink").map(drinkFamilyOrderInfo).filter(g => g.daily > 0 && g.rep);
  orderList.innerHTML = groups.length ? groups.map(g => {
    const p = g.rep;
    const preferredNames = g.preferred.map(x => variantLabel(x) || "Zonder smaak");
    const roomText = g.rooms.map(r => `Kamer ${esc(r.room)}`).join(" · ");
    const preferredRows = g.preferred.map(x => {
      const stock = stockUnits(x) + orderedUnits(x);
      return `<div class="order-variant preferred"><span><strong>${esc(variantLabel(x) || "Zonder smaak")}</strong></span><span>${fmt(stock)} ${esc(looseUnitLabel(x, stock))}</span></div>`;
    }).join("");
    const otherRows = g.other.map(x => {
      const stock = stockUnits(x) + orderedUnits(x);
      return `<div class="order-variant other"><span>${esc(variantLabel(x) || "Zonder smaak")}</span><span>${fmt(stock)} ${esc(looseUnitLabel(x, stock))} · telt niet mee</span></div>`;
    }).join("");
    const days = g.daily > 0 ? g.available / g.daily : null;
    return `<div class="item order-card order-family-card">
      <div class="order-product">${esc(g.name)}</div>
      <div class="order-room">${roomText}</div>
      <div class="order-preference">Voorkeur: <strong>${esc(preferredNames.join(", ") || "alle smaken")}</strong></div>
      <div class="order-variant-list">${preferredRows}${otherRows}</div>
      <div class="order-main">${g.orderUnits > 0 ? `<strong>${g.orderUnits} ${esc(plural(p.orderUnit, g.orderUnits))}</strong> <span>bestellen van de voorkeurssmaken</span>` : `<span class="status-ok">Voldoende van de voorkeurssmaken</span>`}</div>
      <div class="order-meta">Voorkeursvoorraad: ${fmt(g.available)} ${esc(looseUnitLabel(p, g.available))}${days != null ? ` · ± ${fmt(Math.floor(days * 10) / 10)} dagen` : ""}<br>Verbruik: ${fmt(g.daily)} ${esc(p.consumptionUnit)} per dag · doel ${targetWeeks()} weken</div>
    </div>`;
  }).join("") : `<div class="empty">Nog geen producten in gebruik om te bestellen.</div>`;
}

function renderOrders() {
  if (currentMode === "drink") { renderDrinkOrders(); return; }
  const rows = productsForMode().map(p => ({ p, a: advice(p) })).filter(x => currentMode === "general" || (activeProduct(x.p) && x.a.daily > 0));
  orderList.innerHTML = rows.length ? rows.map(({ p, a }) => {
    const tht = currentMode === "general" ? "" : thtBadgeHtml(p);
    return `<div class="item order-card">
      <div class="order-product">${esc(labelProduct(p))}</div>
      <div class="order-main">${a.orderUnits > 0 ? `<strong>${a.orderUnits} ${esc(plural(p.orderUnit, a.orderUnits))}</strong> <span>bestellen</span>` : `<span class="status-ok">Voldoende voorraad</span>`}</div>
      <div class="order-meta">${currentMode === "general" ? `Doelvoorraad: ${fmt(a.needed / Number(p.contentPerOrderUnit || 1))} ${esc(plural(p.orderUnit, a.needed / Number(p.contentPerOrderUnit || 1)))}` : `${esc(daysSupplyText(p))} · verbruik ${fmt(a.daily)} ${esc(p.consumptionUnit)} per dag · doel ${targetWeeks()} weken`}${currentMode !== "general" ? `<br>Minimum: ${esc(minimumText(p))}` : (Number(p.minimumStock || 0) > 0 ? `<br>Minimum: ${esc(minimumText(p))}` : "")}</div>
      ${tht ? `<div class="order-chips">${tht}</div>` : ""}
    </div>`;
  }).join("") : `<div class="empty">Nog geen producten in gebruik om te bestellen.</div>`;
}

function renderOverview() {
  overviewTitle.textContent = modeLabel();
  usageTabBtn.textContent = currentMode === "general" ? "Algemeen" : "Kamers";
  statUsageLabel.textContent = currentMode === "general" ? "Artikelen" : "Kamers";
  statUsage.textContent = currentMode === "general" ? productsForMode().length : roomsForMode().length;
  statProducts.textContent = productsForMode().length;

  const groups = currentMode === "general"
    ? productsForMode().map(p => ({ name: labelProduct(p), products: [p], representative: p }))
    : familyNames(currentMode).map(name => {
        const products = familyProducts(name, currentMode, true);
        return { name, products, representative: products.find(activeProduct) || products[0] };
      });

  const groupInfo = groups.map(g => {
    const p = g.representative;
    if (!p) return null;
    if (currentMode === "general") {
      const a = advice(p);
      const e = expiryInfo(p);
      return {
        ...g, p, orderUnits: a.orderUnits, stock: stockUnits(p), days: null,
        minimum: Number(p.minimumStock || 0), unused: false,
        thtHtml: "", attention: a.orderUnits > 0
      };
    }

    const daily = familyDailyUsage(g.name, currentMode);
    const stock = familyStockUnits(g.name, currentMode);
    const days = daily > 0 ? stock / daily : null;
    const minimum = daily * DELIVERY_DAYS;
    const shortage = Math.max(0, minimum - stock);
    const pack = Number(p.contentPerOrderUnit || 1);
    const orderUnits = daily > 0 ? Math.ceil(shortage / pack) : 0;
    const unused = daily <= 0 && stock > 0;
    const thtHtml = g.products.map(x => thtBadgeHtml(x)).filter(Boolean).join("");
    const hasThtAttention = g.products.some(x => {
      const e = expiryInfo(x);
      return e.expired || e.soon || e.quarterlyDue;
    });
    return {
      ...g, p, daily, stock, days, minimum, orderUnits, unused, thtHtml,
      attention: orderUnits > 0 || unused || hasThtAttention
    };
  }).filter(Boolean);

  statOrders.textContent = groupInfo.filter(x => x.orderUnits > 0).length;
  weeksCard.classList.toggle("hidden", currentMode === "general");
  statWeeks.textContent = currentMode === "general" ? "Handmatig" : `${targetWeeks()} weken`;
  document.querySelectorAll(".week-picker button").forEach(b => b.classList.toggle("active", Number(b.dataset.weeks) === targetWeeks()));

  const attention = groupInfo.filter(x => x.attention);
  attentionList.innerHTML = attention.length ? attention.map(x => {
    const p = x.p;
    const unit = p.consumptionUnit || looseUnitLabel(p, x.stock);
    const stockLine = currentMode === "general"
      ? `Voorraad: <strong>${fmt(x.stock)} ${esc(unit)}</strong>`
      : `Voorraad: <strong>${fmt(x.stock)} ${esc(unit)}</strong> · <strong>${esc(familyDaysSupplyText(p))}</strong>`;
    const minimumLine = currentMode === "general"
      ? `Minimum: ${esc(minimumText(p))}`
      : `Minimum: <strong>10 dagen</strong> · ${fmt(x.minimum)} ${esc(unit)}`;
    return `<div class="item attention-card">
      <div class="attention-product">${esc(x.name)}</div>
      <div class="overview-stock">${stockLine}</div>
      <div class="overview-minimum">${minimumLine}</div>
      ${x.orderUnits > 0 ? `<div class="attention-order"><strong>${x.orderUnits} ${esc(plural(p.orderUnit, x.orderUnits))}</strong> <span>bestellen</span></div>` : `<div class="overview-ok">Voldoende voorraad</div>`}
      ${x.unused ? `<div class="attention-unused">Voorraad aanwezig · niet in gebruik</div>` : ""}
      ${x.thtHtml ? `<div class="attention-chips">${x.thtHtml}</div>` : ""}
    </div>`;
  }).join("") : `<div class="empty">Geen directe aandachtspunten. Alles is voldoende op voorraad en er zijn geen THT-meldingen.</div>`;
}
function renderAll() {
  flavorField.classList.toggle("hidden", currentMode === "sonde");
  if (typeof manualMinimumField !== "undefined") manualMinimumField.classList.toggle("hidden", currentMode !== "general");
  looseField.classList.toggle("hidden", Number(contentPerOrderUnit.value || 1) <= 1);
  renderProductOptions();
  renderCounting();
  renderUsage();
  renderProducts();
  renderOrders();
  renderOverview();
}
function changeStock(id, delta) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  p.stockFull = Math.max(0, Number(p.stockFull || 0) + delta);
  saveData();
}
function changeLoose(id, delta) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  p.stockLoose = Math.max(0, Number(p.stockLoose || 0) + delta);
  saveData();
}

let editingExpiryProductId = null;
function openExpiryModal(id) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  editingExpiryProductId = id;
  expiryProductLabel.textContent = labelProduct(p);
  expiryDateInput.value = p.expiryDate || "";
  lastExpiryCheckInfo.innerHTML = p.lastExpiryCheck
    ? `Laatste THT-controle: <strong>${esc(formatDate(p.lastExpiryCheck))}</strong><br>Na 3 maanden geeft de app opnieuw een controlemelding.`
    : `Nog geen THT-controle opgeslagen. Controleer ook de flesjes of verpakkingen achteraan in de kast.`;
  expiryModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeExpiryModal() {
  editingExpiryProductId = null;
  expiryModal.classList.add("hidden");
  document.body.style.overflow = "";
}
saveExpiryCheck.onclick = () => {
  const p = data.products.find(x => x.id === editingExpiryProductId);
  if (!p) return;
  p.expiryDate = expiryDateInput.value || "";
  p.lastExpiryCheck = isoToday();
  closeExpiryModal();
  saveData();
};

let editingRoomId = null;
function editRoom(id) {
  const r = data.rooms.find(x => x.id === id);
  if (!r) return;
  editingRoomId = id;
  editRoomNumber.value = r.room;
  editRoomUnit.value = String(r.unit);
  editRoomProduct.innerHTML = roomOptions(r.mode);
  editRoomProduct.value = roomOptionValue(r.productName || "");
  editDailyAmount.value = r.dailyAmount;
  setRoomUnitFromProduct(editRoomProduct, editDailyUnit);
  const checked = r.allFlavors ? activeFlavorIds(r.productName, r.mode) : (r.selectedProductIds || []);
  renderFlavorChoices(editRoomProduct, editRoomFlavorChoices, checked, !!r.allFlavors);
  roomEditModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeRoomEdit() {
  editingRoomId = null;
  editRoomFlavorChoices.classList.add("hidden");
  editRoomFlavorChoices.innerHTML = "";
  roomEditModal.classList.add("hidden");
  document.body.style.overflow = "";
}
editRoomProduct.onchange = () => {
  setRoomUnitFromProduct(editRoomProduct, editDailyUnit);
  renderFlavorChoices(editRoomProduct, editRoomFlavorChoices, []);
};
saveRoomEdit.onclick = () => {
  const r = data.rooms.find(x => x.id === editingRoomId);
  const amount = Number(String(editDailyAmount.value).replace(",", "."));
  const roomNumber = editRoomNumber.value.trim();
  const productName = parseRoomProductName(editRoomProduct.value);
  if (!r || !roomNumber || !Number.isFinite(amount) || amount <= 0 || !productName) {
    alert("Vul kamernummer, product en verbruik in.");
    return;
  }
  const selection = selectionForRoom(productName, r.mode, editRoomFlavorChoices);
  if (r.mode === "drink" && familyProducts(productName, r.mode).some(p => p.flavor) && selection.ids.length < 1) {
    alert("Vink minimaal één voorkeurssmaak aan.");
    return;
  }
  if (r.mode === "sonde" && familyProducts(productName, r.mode).length > 1 && selection.ids.length < 1) {
    alert("Vink minimaal één inhoud/variant aan.");
    return;
  }
  r.room = roomNumber;
  r.unit = editRoomUnit.value;
  r.productName = productName;
  r.productId = null;
  r.selectedProductIds = selection.ids;
  r.allFlavors = selection.allFlavors;
  r.dailyAmount = amount;
  setRoomUnitFromProduct(editRoomProduct, editDailyUnit);
  r.dailyUnit = editDailyUnit.value;
  closeRoomEdit();
  saveData();
};

function deleteRoom(id) {
  if (confirm("Deze kamerregel verwijderen?")) {
    data.rooms = data.rooms.filter(r => r.id !== id);
    saveData();
  }
}
function deleteProduct(id) {
  const linked = data.rooms.some(r => Array.isArray(r.selectedProductIds) && r.selectedProductIds.includes(id));
  if (linked) {
    alert("Deze smaak is nog gekoppeld aan een kamer. Zet de smaak liever op Niet actief of pas eerst de kamer aan.");
    return;
  }
  if (confirm("Dit product verwijderen?")) {
    data.products = data.products.filter(p => p.id !== id);
    saveData();
  }
}

let editingProductId = null;
function editStock(id) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  editProductName.value = p.name || "";
  editFlavor.value = p.flavor || "";
  editFlavorField.classList.toggle("hidden", p.mode === "sonde");
  editConsumptionUnit.value = p.consumptionUnit;
  editOrderUnit.value = p.orderUnit;
  editContentPerOrderUnit.value = p.contentPerOrderUnit;
  editLooseUnitsAllowed.value = p.looseUnitsAllowed === false ? "no" : "yes";
  editStockFull.value = p.stockFull || 0;
  editStockLoose.value = p.stockLoose || 0;
  editAlreadyOrdered.value = p.alreadyOrdered || 0;
  editMinimumStock.value = p.minimumStock || 0;
  editProductActive.checked = activeProduct(p);
  editProductActiveRow.classList.toggle("hidden", p.mode === "general");
  editLooseField.classList.toggle("hidden", !hasLooseUnits(p));
  productEditModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeProductEdit() {
  editingProductId = null;
  productEditModal.classList.add("hidden");
  document.body.style.overflow = "";
}
const syncEditLooseField = () => {
  const multiple = Number(editContentPerOrderUnit.value || 1) > 1;
  editLooseAllowedField.classList.toggle("hidden", !multiple);
  editLooseField.classList.toggle("hidden", !multiple || editLooseUnitsAllowed.value !== "yes");
};
editOrderUnit.onchange = syncEditLooseField;
editContentPerOrderUnit.oninput = syncEditLooseField;
editLooseUnitsAllowed.onchange = syncEditLooseField;
saveProductEdit.onclick = () => {
  const p = data.products.find(x => x.id === editingProductId);
  if (!p) return;
  const oldName = p.name;
  const name = canonicalName(editProductName.value.trim());
  const flavor = p.mode === "sonde" ? "" : editFlavor.value.trim();
  const content = Number(String(editContentPerOrderUnit.value).replace(",", "."));
  if (!name || !Number.isFinite(content) || content <= 0) {
    alert("Vul productnaam en inhoud per besteleenheid in.");
    return;
  }

  if (canonicalName(oldName) !== canonicalName(name)) {
    data.products
      .filter(x => x.mode === p.mode && canonicalName(x.name) === canonicalName(oldName))
      .forEach(x => x.name = name);
    data.rooms
      .filter(r => r.mode === p.mode && canonicalName(r.productName) === canonicalName(oldName))
      .forEach(r => r.productName = name);
  }
  p.name = name;
  p.flavor = flavor;
  p.consumptionUnit = editConsumptionUnit.value;
  p.orderUnit = editOrderUnit.value;
  p.contentPerOrderUnit = content;
  p.looseUnitsAllowed = content > 1 && editLooseUnitsAllowed.value === "yes";
  p.stockFull = Math.max(0, Number(editStockFull.value) || 0);
  p.stockLoose = p.looseUnitsAllowed ? Math.max(0, Number(editStockLoose.value) || 0) : 0;
  p.alreadyOrdered = Math.max(0, Number(editAlreadyOrdered.value) || 0);
  p.minimumStock = Math.max(0, Number(editMinimumStock.value) || 0);
  p.active = p.mode === "general" ? true : editProductActive.checked;

  data.rooms.filter(r => r.mode === p.mode && canonicalName(r.productName) === canonicalName(name)).forEach(r => {
    const first = familyProducts(name, r.mode, true)[0];
    if (first) r.dailyUnit = first.consumptionUnit;
  });

  closeProductEdit();
  saveData();
};

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!roomEditModal.classList.contains("hidden")) closeRoomEdit();
  if (!productEditModal.classList.contains("hidden")) closeProductEdit();
  if (!expiryModal.classList.contains("hidden")) closeExpiryModal();
});

document.querySelectorAll(".mode-btn").forEach(b => b.onclick = () => {
  currentMode = b.dataset.mode;
  document.querySelectorAll(".mode-btn").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  renderAll();
});
document.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  document.getElementById(b.dataset.tab).classList.add("active");
});
document.querySelectorAll(".week-picker button").forEach(b => b.onclick = () => {
  if (currentMode === "drink") data.settings.drinkWeeks = Number(b.dataset.weeks);
  else data.settings.sondeWeeks = Number(b.dataset.weeks);
  saveData();
});
orderUnit.onchange = () => looseField.classList.toggle("hidden", Number(contentPerOrderUnit.value || 1) <= 1);
roomProduct.onchange = () => {
  setRoomUnitFromProduct(roomProduct, dailyUnit);
  renderFlavorChoices(roomProduct, roomFlavorChoices, []);
};
saveRoom.onclick = () => {
  const roomV = room.value.trim();
  const unitV = unit.value;
  const amount = Number(String(dailyAmount.value).replace(",", "."));
  const productName = parseRoomProductName(roomProduct.value);
  if (!roomV || amount <= 0 || !productName) {
    alert("Vul kamernummer, product en verbruik in.");
    return;
  }
  const selection = selectionForRoom(productName, currentMode, roomFlavorChoices);
  if (currentMode === "drink" && familyProducts(productName, currentMode).some(p => p.flavor) && selection.ids.length < 1) {
    alert("Vink minimaal één voorkeurssmaak aan.");
    return;
  }
  if (currentMode === "sonde" && familyProducts(productName, currentMode).length > 1 && selection.ids.length < 1) {
    alert("Vink minimaal één inhoud/variant aan.");
    return;
  }
  setRoomUnitFromProduct(roomProduct, dailyUnit);
  data.rooms.push({
    id: crypto.randomUUID(), mode: currentMode, room: roomV, unit: unitV,
    productId: null, productName, allFlavors: selection.allFlavors,
    selectedProductIds: selection.ids, dailyAmount: amount, dailyUnit: dailyUnit.value
  });
  room.value = "";
  dailyAmount.value = "";
  renderFlavorChoices(roomProduct, roomFlavorChoices, []);
  saveData();
};
saveGeneralTarget.onclick = () => {
  const p = data.products.find(x => x.id === generalProduct.value);
  const target = Number(generalTarget.value);
  if (!p || target < 0) {
    alert("Vul een geldige voorraad in.");
    return;
  }
  p.generalTarget = target;
  generalTarget.value = "";
  saveData();
};
const syncNewLooseField = () => {
  const multiple = Number(contentPerOrderUnit.value || 1) > 1;
  looseAllowedField.classList.toggle("hidden", !multiple);
  looseField.classList.toggle("hidden", !multiple || looseUnitsAllowed.value !== "yes");
};
contentPerOrderUnit.oninput = syncNewLooseField;
orderUnit.onchange = syncNewLooseField;
looseUnitsAllowed.onchange = syncNewLooseField;
syncNewLooseField();

saveProduct.onclick = () => {
  const name = canonicalName(productName.value.trim());
  const fl = currentMode === "sonde" ? "" : flavor.value.trim();
  const cu = consumptionUnit.value;
  const ou = orderUnit.value;
  const content = Number(contentPerOrderUnit.value);
  const allowLoose = content > 1 && looseUnitsAllowed.value === "yes";
  const sf = Number(stockFull.value || 0);
  const sl = allowLoose ? Number(stockLoose.value || 0) : 0;
  const ao = Number(alreadyOrdered.value || 0);
  const min = Number(minimumStock.value || 0);
  if (!name || content <= 0) {
    alert("Vul productnaam en inhoud per besteleenheid in.");
    return;
  }
  const maxOrder = Math.max(0, ...productsForMode().map(p => p.order || 0));
  data.products.push({
    id: crypto.randomUUID(), mode: currentMode, name, flavor: fl,
    consumptionUnit: cu, orderUnit: ou, contentPerOrderUnit: content, looseUnitsAllowed: allowLoose,
    stockFull: sf, stockLoose: sl, alreadyOrdered: ao, generalTarget: 0,
    minimumStock: min, order: maxOrder + 1, expiryDate: "", lastExpiryCheck: "", active: true
  });
  productName.value = "";
  flavor.value = "";
  contentPerOrderUnit.value = "";
  looseUnitsAllowed.value = "yes";
  stockFull.value = "0";
  stockLoose.value = "0";
  alreadyOrdered.value = "0";
  minimumStock.value = "0";
  syncNewLooseField();
  saveData();
};

renderAll();
