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
  const raw = String(name || "").trim().replace(/\s+/g, " ");
  if (/^glucerna$/i.test(raw)) return "Glucerna Advance";
  // V3.3.52: oudere/handmatig ingevoerde Abound-regels kunnen de smaak
  // in de productnaam hebben staan. Voor groepering hoort dit altijd bij
  // één hoofdproduct: Abound.
  if (/^abound(?:\s*[·\-–—:]\s*|\s+)(neutraal|sinaasappel)$/i.test(raw)) return "Abound";
  if (/^abound$/i.test(raw)) return "Abound";
  // V3.3.53: bekende productfamilies blijven één hoofdproduct, ook als
  // leverancier/oudere invoer de variant in de naam heeft gezet.
  if (/\bslikgel\b/i.test(raw)) return "Slikgel";
  if (/\bthicken\s+up\s+clear\b/i.test(raw)) return "Thicken Up Clear";
  if (/\bjevity\s*1[,.]5\b/i.test(raw)) return "Jevity 1.5";
  return raw;
}
function productFamilyKey(p) {
  return `${p.mode}::${canonicalName(p.name).toLocaleLowerCase("nl-NL")}`;
}
function isStandardExternalProductName(name) {
  const value = String(name || "").trim().toLocaleLowerCase("nl-NL");
  return value === "drinkyoghurt" || value === "bouwsteentje" || value.includes("vruchtenkwark") || value === "vla";
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
function normalizeExpiryMonth(s) {
  const match = String(s || "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : "";
}
function expiryMonthEndDate(s) {
  const value = normalizeExpiryMonth(s);
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month, 0);
}
function formatExpiryMonth(s) {
  const value = normalizeExpiryMonth(s);
  if (!value) return "";
  const [year, month] = value.split("-");
  return `${month}-${year}`;
}
function cloneDefaults() {
  return typeof structuredClone === "function" ? structuredClone(defaults) : JSON.parse(JSON.stringify(defaults));
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const d = stored ? JSON.parse(stored) : cloneDefaults();

    if (!d.settings) d.settings = { drinkWeeks: 3, sondeWeeks: 3 };
    if (!Array.isArray(d.settings.orderScanHistory)) d.settings.orderScanHistory = [];
    if (!Array.isArray(d.products)) d.products = [];
    if (!Array.isArray(d.rooms)) d.rooms = [];

    d.products.forEach((p, i) => {
      const originalName = String(p.name || "").trim();
      const aboundVariant = originalName.match(/^abound(?:\s*[·\-–—:]\s*|\s+)(neutraal|sinaasappel)$/i);
      if (aboundVariant && !String(p.flavor || "").trim()) {
        p.flavor = aboundVariant[1].charAt(0).toUpperCase() + aboundVariant[1].slice(1).toLowerCase();
      }
      if (!String(p.flavor || "").trim() && /\bslikgel\b/i.test(originalName)) {
        const m = originalName.match(/\b(banaan|aardbei|neutraal|sinaasappel|vanille|chocolade|appel|citroen)\b/i);
        if (m) p.flavor = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      }
      if (!String(p.flavor || "").trim() && /\bthicken\s+up\s+clear\b/i.test(originalName)) {
        const m = originalName.match(/\b(gel|poeder)\b/i);
        if (m) p.flavor = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      }
      p.name = canonicalName(originalName);
      if (p.order == null) p.order = i + 1;
      if (p.minimumStock == null) p.minimumStock = 0;
      // Oude volledige THT-datums omzetten naar maand-jaar.
      p.expiryDate = normalizeExpiryMonth(p.expiryDate);
      if (p.lastExpiryCheck == null) p.lastExpiryCheck = "";
      if (p.active == null) p.active = true;
      if (p.externalProduct == null) p.externalProduct = false;
      if (p.externalQuantity == null) p.externalQuantity = 0;
      // V3.3.22: deze producten worden door de afdeling gebruikt, maar niet door ons besteld.
      if (isStandardExternalProductName(p.name)) p.externalProduct = true;
      // V3.3.20: bestaande producten blijven standaard op de weeklijst staan.
      if (p.showOnWeeklyList == null) p.showOnWeeklyList = true;
      // 2.7.2: behoud bij bestaande producten het gedrag uit 2.7.1.
      // Daarna kan dit per product op Ja/Nee worden gezet.
      if (p.looseUnitsAllowed == null) p.looseUnitsAllowed = Number(p.contentPerOrderUnit || 1) > 1;
    });

    // Oude kamerregistraties omzetten naar de rustige structuur:
    // product kiezen + één of meer voorkeurssmaken aanvinken.
    d.rooms.forEach(r => {
      if (!Array.isArray(r.selectedProductIds)) r.selectedProductIds = [];
      if (!Array.isArray(r.dislikedProductIds)) r.dislikedProductIds = [];

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

    // V3.3.52: de openstaande bestellingen van vóór de datumregistratie
    // zijn volgens de gebruiker op 14 augustus 2026 geplaatst.
    if (!d.settings.orderDateMigration3349) {
      d.products.forEach(p => {
        if (Number(p.alreadyOrdered || 0) > 0 && !p.orderedDate) p.orderedDate = "2026-08-14";
      });
      d.settings.orderDateMigration3349 = true;
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
  if (!unit) return "";
  const singular = {flesjes:"flesje",bakjes:"bakje",zakjes:"zakje",glazen:"glas",bekers:"beker",schaaltjes:"schaaltje",stuks:"stuk",flacons:"flacon",flessen:"fles",kartons:"karton",dozen:"doos",potten:"pot",pakken:"pak"};
  const base = singular[unit] || unit;
  const m = { flesje:"flesjes", bakje:"bakjes", zakje:"zakjes", glas:"glazen", beker:"bekers", schaaltje:"schaaltjes", stuk:"stuks", flacon:"flacons", gram:"gram", fles:"flessen", karton:"kartons", doos:"dozen", pot:"potten", pak:"pakken", ml:"ml" };
  return Number(n) === 1 ? base : (m[base] || base);
}
function activeProduct(p) {
  return p.active !== false;
}
function phaseOutProduct(p) {
  return p?.mode === "sonde" && p.phaseOut === true;
}
function orderableProduct(p) {
  return activeProduct(p) && !phaseOutProduct(p) && p.externalProduct !== true;
}
function hasLooseUnits(p) {
  return Number(p?.contentPerOrderUnit || 1) > 1 && p?.looseUnitsAllowed !== false;
}
function looseUnitLabel(p, n = 2) {
  const u = p?.consumptionUnit || "";
  return plural(u, n);
}
function quantityUnitLabel(unit, n = 2) {
  return plural(unit || "", n);
}
function withUnit(n, unit) {
  const label = quantityUnitLabel(unit, n);
  return label ? `${fmt(n)} ${label}` : fmt(n);
}
function packageCountLabel(p, n) {
  const unit = plural(p.orderUnit, n);
  return `${fmt(n)} ${unit}`;
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
  // V3.3.26 fix: een geregistreerde bestelling is nog geen fysieke voorraad.
  // Het aantal bij "Werkelijk besteld" blijft opgeslagen, maar telt pas mee
  // nadat de levering daadwerkelijk bij Voorraad is toegevoegd.
  return 0;
}
function familyOrderedPackages(name, mode) {
  return familyProducts(name, mode, true).reduce((sum, p) => sum + Number(p.alreadyOrdered || 0), 0);
}
function todayLocalIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
function formatOrderDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}
function familyOrderedDate(name, mode) {
  const ordered = familyProducts(name, mode, true).find(p => Number(p.alreadyOrdered || 0) > 0 && p.orderedDate);
  return ordered?.orderedDate || "";
}
function orderedDateHtml(value) {
  const formatted = formatOrderDate(value);
  return formatted ? `<span class="ordered-date">Besteld op ${esc(formatted)}</span>` : "";
}
function clearFamilyOrdered(name, mode) {
  familyProducts(name, mode, true).forEach(p => {
    p.alreadyOrdered = 0;
    p.orderedDate = "";
  });
}
function remainingOrderPackages(p, advisedPackages) {
  return Math.max(0, Number(advisedPackages || 0) - Number(p.alreadyOrdered || 0));
}
function saveFamilyOrdered(encodedName, mode, inputId) {
  const name = decodeURIComponent(encodedName || "");
  const input = document.getElementById(inputId);
  const amount = Math.max(0, Math.floor(Number(input?.value || 0)));
  const products = familyProducts(name, mode, true);
  if (!products.length) return;
  const previousAmount = familyOrderedPackages(name, mode);
  const previousDate = familyOrderedDate(name, mode);
  products.forEach(p => {
    p.alreadyOrdered = 0;
    p.orderedDate = "";
  });
  const target = products.find(orderableProduct) || products.find(activeProduct) || products[0];
  target.alreadyOrdered = amount;
  target.orderedDate = amount > 0 ? (previousAmount === amount && previousDate ? previousDate : todayLocalIso()) : "";
  saveData();
}
function saveProductOrdered(id, inputId) {
  const p = data.products.find(x => x.id === id);
  const input = document.getElementById(inputId);
  if (!p || !input) return;
  const amount = Math.max(0, Math.floor(Number(input.value || 0)));
  if (amount > 0 && (amount !== Number(p.alreadyOrdered || 0) || !p.orderedDate)) p.orderedDate = todayLocalIso();
  if (amount === 0) p.orderedDate = "";
  p.alreadyOrdered = amount;
  saveData();
}
function receiveFamilyOrder(encodedName, mode) {
  const name = decodeURIComponent(encodedName || "");
  if (!familyOrderedPackages(name, mode)) return;
  if (!confirm(`Is de bestelling van ${name} ontvangen en in de voorraad geteld?`)) return;
  clearFamilyOrdered(name, mode);
  saveData();
}
function receiveProductOrder(id) {
  const p = data.products.find(x => x.id === id);
  if (!p || Number(p.alreadyOrdered || 0) <= 0) return;
  if (!confirm(`Is de bestelling van ${labelProduct(p)} ontvangen en in de voorraad geteld?`)) return;
  p.alreadyOrdered = 0;
  p.orderedDate = "";
  saveData();
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
  // Bij- en sondevoeding worden voor de minimumvoorraad per productfamilie beoordeeld.
  // Verschillende inhoudsvarianten van dezelfde sondevoeding tellen dus samen.
  return familyDailyUsage(p.name, p.mode) * DELIVERY_DAYS;
}
function belowMinimum(p) {
  if (p.mode === "general") return stockPackages(p) < Number(p.minimumStock || 0);
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
  if (stockUnits(p) <= 0) return { quarterlyDue:false, expiryDays:null, expired:false, soon:false };
  const today = parseLocalDate(isoToday());
  const last = parseLocalDate(p.lastExpiryCheck);
  const quarterlyDue = !last || daysBetween(last, today) >= 90;
  let expiryDays = null, expired = false, soon = false;
  if (p.expiryDate) {
    // Een THT-maand is geldig tot en met de laatste dag van die maand.
    expiryDays = daysBetween(today, expiryMonthEndDate(p.expiryDate));
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
    ? (activeProduct(p) ? Math.max(usageTarget, minimumTarget) : 0)
    : (daily > 0 && activeProduct(p) ? Math.max(usageTarget, minimumTarget) : 0);
  const available = stockUnits(p) + orderedUnits(p);
  const shortage = Math.max(0, needed - available);
  const advisedPackages = Math.ceil(shortage / Number(p.contentPerOrderUnit || 1));
  return { daily, weekly, usageTarget, minimumTarget, needed, available, orderUnits: remainingOrderPackages(p, advisedPackages) };
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
  if (!unitEl) return;
  const value = p?.consumptionUnit || "";
  // De eenheid hoort bij het product. Het verborgen veld bewaart alleen de
  // afgeleide waarde zodat bestaande kamerdata en PDF-logica compatibel blijven.
  if (![...unitEl.options].some(o => o.value === value)) {
    unitEl.add(new Option(value, value));
  }
  unitEl.value = value;
}
function renderFlavorChoices(selectEl, boxEl, checkedIds = [], forceAll = false, dislikedIds = []) {
  const mode = selectedRoomMode(selectEl);
  const name = parseRoomProductName(selectEl.value);
  if (!name) { boxEl.classList.add("hidden"); boxEl.innerHTML = ""; return; }

  const active = familyProducts(name, mode);
  const inactiveSelected = data.products.filter(p => p.mode === mode && !activeProduct(p) && canonicalName(p.name) === canonicalName(name) && checkedIds.includes(p.id));
  // Bij bijvoeding moet Smaak/soort ook zichtbaar blijven als er maar één actieve smaak is.
  // Zo kan de gekozen smaak expliciet aan de kamerregel en het dagschema worden gekoppeld.
  // Alleen een product zonder smaak/soort heeft geen extra keuze nodig.
  if (mode !== "sonde") {
    const hasFlavorChoice = active.some(p => String(p.flavor || "").trim()) || inactiveSelected.some(p => String(p.flavor || "").trim());
    if (!hasFlavorChoice) { boxEl.classList.add("hidden"); boxEl.innerHTML = ""; return; }
  } else if (active.length <= 1 && !inactiveSelected.length) {
    boxEl.classList.add("hidden"); boxEl.innerHTML = ""; return;
  }

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
  const rows = flavored.map(p => `<label class="flavor-check"><input class="pref-flavor" type="checkbox" value="${esc(p.id)}" ${allChecked || checkedIds.includes(p.id) ? "checked" : ""}><span>${esc(p.flavor)}</span></label>`).join("");
  const inactiveRows = inactiveSelected.map(p => `<label class="flavor-check inactive-flavor"><input class="pref-flavor" type="checkbox" value="${esc(p.id)}" checked disabled><span>${esc(p.flavor || "Zonder smaak")} <small>niet actief</small></span></label>`).join("");
  const dislikeRows = flavored.map(p => `<label class="flavor-check"><input class="dislike-flavor" type="checkbox" value="${esc(p.id)}" ${dislikedIds.includes(p.id) ? "checked" : ""}><span>${esc(p.flavor)}</span></label>`).join("");
  boxEl.innerHTML = `<div class="flavor-choice-head"><div class="flavor-choice-title">Voorkeurssmaken</div></div><div class="flavor-choice-grid">${rows}${inactiveRows}</div><div class="flavor-choice-head" style="margin-top:12px"><div class="flavor-choice-title">Lust absoluut niet</div></div><div class="flavor-choice-grid">${dislikeRows}</div><div class="field-help">Alle andere smaken mogen incidenteel als alternatief worden gebruikt.</div>`;
  boxEl.classList.remove("hidden");
  boxEl.querySelectorAll('.pref-flavor').forEach(cb => cb.onchange = () => { if (cb.checked) { const d = boxEl.querySelector(`.dislike-flavor[value="${cb.value}"]`); if (d) d.checked = false; } });
  boxEl.querySelectorAll('.dislike-flavor').forEach(cb => cb.onchange = () => { if (cb.checked) { const d = boxEl.querySelector(`.pref-flavor[value="${cb.value}"]`); if (d) d.checked = false; } });
}
function selectedFlavorIds(boxEl) {
  return [...boxEl.querySelectorAll('input.pref-flavor:checked:not(:disabled), input:not(.dislike-flavor):not(.pref-flavor):checked:not(:disabled)')].map(x => x.value);
}
function selectedDislikedIds(boxEl) { return [...boxEl.querySelectorAll('.dislike-flavor:checked:not(:disabled)')].map(x => x.value); }
function selectionForRoom(name, mode, boxEl) {
  const active = familyProducts(name, mode);
  const flavored = active.filter(p => p.flavor);
  if (!active.length) return { ids: [], allFlavors: false, dislikedIds: [] };
  if (mode === "sonde") {
    const ids = selectedFlavorIds(boxEl);
    return { ids, allFlavors: false, dislikedIds: [] };
  }
  if (!flavored.length) return { ids: [active[0].id], allFlavors: false, dislikedIds: [] };

  const ids = selectedFlavorIds(boxEl);
  const allFlavors = active.length > 0 && active.every(p => ids.includes(p.id));
  return { ids, allFlavors, dislikedIds: selectedDislikedIds(boxEl) };
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
  const days = p.mode === "sonde" ? familyDaysSupply(p) : daysSupply(p);
  if (days == null) return "Niet in gebruik";
  if (!Number.isFinite(days)) return "—";
  const rounded = Math.floor(days * 10) / 10;
  return `${fmt(rounded)} ${rounded === 1 ? "dag" : "dagen"} voorraad`;
}
function thtStatusHtml(p) {
  const e = expiryInfo(p);
  const bits = [];
  if (e.expired) bits.push(`<span class="status-danger">THT verstreken</span>`);
  else if (e.soon) bits.push(`<span class="status-warn">THT ${esc(formatExpiryMonth(p.expiryDate))} · Let op</span>`);
  else if (p.expiryDate) bits.push(`<span class="muted">THT ${esc(formatExpiryMonth(p.expiryDate))}</span>`);
  // Periodieke controle wordt via de THT-knop uitgevoerd; geen herhaalde tekst in de voorraadkaart.
  return bits.join("<br>");
}
function thtBadgeHtml(p) {
  const e = expiryInfo(p);
  const date = p.expiryDate ? esc(formatExpiryMonth(p.expiryDate)) : "";
  if (e.expired) return `<span class="attention-chip danger-chip tht-chip"><strong>THT verlopen</strong>${date ? `<span class="tht-date">${date}</span>` : ""}</span>`;
  if (e.soon) return `<span class="attention-chip warn-chip tht-chip"><strong>THT binnenkort</strong>${date ? `<span class="tht-date">${date}</span>` : ""}</span>`;
  if (e.quarterlyDue) return `<span class="attention-chip neutral-chip">THT controleren</span>`;
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
      ${currentMode !== "general" && activeProduct(p) && isInUse(p) && belowMinimum(p) ? `<div class="status-danger" style="margin-top:6px">Onder minimumvoorraad</div>` : ""}
      <div class="counter-wrap"><button class="counter-btn" onclick="changeStock('${p.id}',-1)">−</button><div class="counter-value">${hasLooseUnits(p) ? esc(packageCountLabel(p, p.stockFull)) : `${fmt(p.stockFull)} ${esc(plural(p.orderUnit, p.stockFull))}`}</div><button class="counter-btn" onclick="changeStock('${p.id}',1)">+</button></div>
      ${loose ? `<div class="loose-counter-compact"><div class="counter-wrap"><button class="counter-btn" onclick="changeLoose('${p.id}',-1)">−</button><div class="counter-value">${fmt(p.stockLoose)} ${esc(looseUnitLabel(p, p.stockLoose))}</div><button class="counter-btn" onclick="changeLoose('${p.id}',1)">+</button></div><div class="count-total">Totaal: <strong>${fmt(stockUnits(p))} ${esc(looseUnitLabel(p, stockUnits(p)))}</strong></div></div>` : ""}
      ${currentMode !== "general" ? `<div class="expiry-compact"><button class="secondary compact-btn" onclick="openExpiryModal('${p.id}')">THT</button>${p.expiryDate ? `<span class="expiry-date-text">${esc(formatExpiryMonth(p.expiryDate))}</span>` : ""}</div>` : ""}
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
    ${(r.scheduleTimes||r.scheduleNote) ? `<div class="schedule-meta">${r.scheduleTimes ? `⏱ ${esc(r.scheduleTimes)}` : ""}${r.scheduleAmount ? ` · ${fmt(r.scheduleAmount)} ${esc(plural(r.dailyUnit, r.scheduleAmount))} per keer` : ""}${r.scheduleNote ? `<br>${esc(r.scheduleNote)}` : ""}</div>` : ""}
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
let dragPointerY = null;
let dragScrollFrame = null;
let pendingDrag = null;
const DRAG_HOLD_MS = 500;
const DRAG_CANCEL_DISTANCE = 10;
function dragAutoScrollStep() {
  if (!draggedProductItem || dragPointerY == null) { dragScrollFrame = null; return; }
  const edge = Math.max(95, Math.min(150, window.innerHeight * 0.16));
  let delta = 0;
  if (dragPointerY < edge) {
    const strength = (edge - dragPointerY) / edge;
    delta = -Math.max(5, Math.round(22 * strength));
  } else if (dragPointerY > window.innerHeight - edge) {
    const strength = (dragPointerY - (window.innerHeight - edge)) / edge;
    delta = Math.max(5, Math.round(22 * strength));
  }
  if (delta) window.scrollBy(0, delta);
  dragScrollFrame = requestAnimationFrame(dragAutoScrollStep);
}
function cancelPendingDrag() {
  if (!pendingDrag) return;
  clearTimeout(pendingDrag.timer);
  pendingDrag.handle.classList.remove("drag-pending");
  pendingDrag = null;
}
productList.addEventListener("pointerdown", e => {
  const handle = e.target.closest(".drag-handle");
  if (!handle) return;
  const item = handle.closest(".product-sort-item");
  if (!item) return;
  cancelPendingDrag();
  const pointerId = e.pointerId;
  pendingDrag = {
    item, handle, pointerId,
    startX:e.clientX, startY:e.clientY,
    lastY:e.clientY,
    timer:setTimeout(() => {
      if (!pendingDrag || pendingDrag.pointerId !== pointerId) return;
      draggedProductItem = pendingDrag.item;
      dragPointerY = pendingDrag.lastY;
      draggedProductItem.classList.add("dragging");
      pendingDrag.handle.classList.remove("drag-pending");
      pendingDrag.handle.setPointerCapture?.(pointerId);
      pendingDrag = null;
      if (!dragScrollFrame) dragScrollFrame = requestAnimationFrame(dragAutoScrollStep);
    }, DRAG_HOLD_MS)
  };
  handle.classList.add("drag-pending");
});
productList.addEventListener("pointermove", e => {
  if (pendingDrag && e.pointerId === pendingDrag.pointerId) {
    pendingDrag.lastY = e.clientY;
    const dx = e.clientX - pendingDrag.startX;
    const dy = e.clientY - pendingDrag.startY;
    if (Math.hypot(dx, dy) > DRAG_CANCEL_DISTANCE) cancelPendingDrag();
    return;
  }
  if (!draggedProductItem) return;
  e.preventDefault();
  dragPointerY = e.clientY;
  const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(".product-sort-item");
  if (!target || target === draggedProductItem || target.parentElement !== productList) return;
  const rect = target.getBoundingClientRect();
  productList.insertBefore(draggedProductItem, e.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
});
function finishProductDrag() {
  cancelPendingDrag();
  if (!draggedProductItem) return;
  draggedProductItem.classList.remove("dragging");
  draggedProductItem = null;
  dragPointerY = null;
  if (dragScrollFrame) cancelAnimationFrame(dragScrollFrame);
  dragScrollFrame = null;
  [...productList.querySelectorAll(".product-sort-item")].forEach((el, i) => {
    const p = data.products.find(x => x.id === el.dataset.productId);
    if (p) p.order = i + 1;
  });
  saveData();
}
productList.addEventListener("pointerup", finishProductDrag);
productList.addEventListener("pointercancel", finishProductDrag);
productList.addEventListener("pointerleave", e => {
  if (pendingDrag && e.pointerId === pendingDrag.pointerId) cancelPendingDrag();
});

function drinkFamilyPlan(name) {
  const products = familyProducts(name, "drink", true);
  const active = products.filter(activeProduct);
  const rooms = data.rooms.filter(r => r.mode === "drink" && canonicalName(r.productName) === canonicalName(name));
  const activeIds = new Set(active.map(p => p.id));

  const roomPlans = rooms.map(r => {
    const dislikedIds = (r.dislikedProductIds || []).filter(id => activeIds.has(id));
    const preferredIds = (r.selectedProductIds || []).filter(id => activeIds.has(id) && !dislikedIds.includes(id));
    // Alle actieve smaken behalve "Lust absoluut niet" mogen als alternatief meetellen.
    const allowedIds = active.map(p => p.id).filter(id => !dislikedIds.includes(id));
    return {
      room: r,
      daily: Number(r.dailyAmount || 0),
      preferredIds: [...new Set(preferredIds)],
      dislikedIds: [...new Set(dislikedIds)],
      allowedIds: [...new Set(allowedIds)]
    };
  }).filter(x => x.daily > 0 && x.allowedIds.length);

  const daily = roomPlans.reduce((sum, x) => sum + x.daily, 0);
  const targetDays = Math.max(targetWeeks() * 7, DELIVERY_DAYS);
  const targetDemand = daily * targetDays;

  function maxDeliverable(days) {
    if (!roomPlans.length || days <= 0) return 0;
    // Edmonds-Karp max-flow: voorraad per smaak kan alleen naar kamers die die smaak accepteren.
    const source = 0;
    const flavorStart = 1;
    const roomStart = flavorStart + active.length;
    const sink = roomStart + roomPlans.length;
    const n = sink + 1;
    const cap = Array.from({length:n}, () => Array(n).fill(0));

    active.forEach((prod, i) => {
      cap[source][flavorStart + i] = Math.max(0, stockUnits(prod) + orderedUnits(prod));
    });
    roomPlans.forEach((rp, ri) => {
      cap[roomStart + ri][sink] = rp.daily * days;
      rp.allowedIds.forEach(id => {
        const fi = active.findIndex(p => p.id === id);
        if (fi >= 0) cap[flavorStart + fi][roomStart + ri] = 1e12;
      });
    });

    let flow = 0;
    while (true) {
      const parent = Array(n).fill(-1);
      parent[source] = source;
      const q = [source];
      for (let qi = 0; qi < q.length && parent[sink] === -1; qi++) {
        const u = q[qi];
        for (let v = 0; v < n; v++) {
          if (parent[v] === -1 && cap[u][v] > 1e-9) {
            parent[v] = u;
            q.push(v);
            if (v === sink) break;
          }
        }
      }
      if (parent[sink] === -1) break;
      let add = Infinity;
      for (let v = sink; v !== source; v = parent[v]) add = Math.min(add, cap[parent[v]][v]);
      for (let v = sink; v !== source; v = parent[v]) {
        const u = parent[v]; cap[u][v] -= add; cap[v][u] += add;
      }
      flow += add;
    }
    return flow;
  }

  const fulfillable = maxDeliverable(targetDays);
  const shortage = Math.max(0, targetDemand - fulfillable);
  const rep = active[0] || products[0];
  const pack = Number(rep?.contentPerOrderUnit || 1);
  const advisedOrderUnits = pack > 0 ? Math.ceil(shortage / pack) : 0;
  const orderedPackages = familyOrderedPackages(name, "drink");
  const orderUnits = Math.max(0, advisedOrderUnits - orderedPackages);

  // Hoeveel dagen kunnen alle bewoners binnen hun eigen voorkeuren vooruit?
  let days = null;
  if (daily > 0) {
    let lo = 0, hi = 1;
    const feasible = d => maxDeliverable(d) + 1e-7 >= daily * d;
    while (hi < 3650 && feasible(hi)) hi *= 2;
    for (let i = 0; i < 36; i++) {
      const mid = (lo + hi) / 2;
      if (feasible(mid)) lo = mid; else hi = mid;
    }
    days = lo;
  }

  const usedIds = new Set(roomPlans.flatMap(x => x.allowedIds));
  const accepted = products.filter(p => usedIds.has(p.id));
  const other = products.filter(p => !usedIds.has(p.id) && (stockUnits(p) + orderedUnits(p)) > 0);
  const acceptedStock = accepted.reduce((sum,p)=>sum+stockUnits(p)+orderedUnits(p),0);

  // Maak groepen van kamers met exact dezelfde toegestane smaken.
  // Zo kan bijvoorbeeld "alleen Koffie" voldoende zijn, terwijl
  // "Aardbei of Vanille" tegelijk een tekort heeft.
  const grouped = new Map();
  roomPlans.forEach(rp => {
    const ids = rp.allowedIds.slice().sort();
    const prefIds = (rp.preferredIds || []).slice().sort();
    const dislikeIds = (rp.dislikedIds || []).slice().sort();
    const key = ids.join('|') + '::' + prefIds.join('|') + '::' + dislikeIds.join('|');
    if (!grouped.has(key)) grouped.set(key, { key, allowedIds: ids, preferredIds: prefIds, dislikedIds: dislikeIds, rooms: [], daily: 0 });
    const g = grouped.get(key);
    g.rooms.push(rp.room);
    g.daily += rp.daily;
  });

  // Voorraad wordt één keer verdeeld. Eerst naar de meest beperkte groepen
  // (minst toegestane smaken), zodat een flexibele kamer geen voorraad pakt
  // die een kamer met maar één smaak nodig heeft.
  const prefGroups = [...grouped.values()].sort((a,b) =>
    a.allowedIds.length - b.allowedIds.length || b.daily - a.daily
  );
  const remaining = new Map(active.map(prod => [prod.id, Math.max(0, stockUnits(prod) + orderedUnits(prod))]));

  prefGroups.forEach((g, gi) => {
    const need = g.daily * targetDays;
    let left = need;
    let allocated = 0;

    // Gebruik binnen de groep eerst smaken die voor zo min mogelijk andere
    // nog te verwerken groepen nodig kunnen zijn.
    const ids = g.allowedIds.slice().sort((a,b) => {
      const usesA = prefGroups.slice(gi + 1).filter(x => x.allowedIds.includes(a)).length;
      const usesB = prefGroups.slice(gi + 1).filter(x => x.allowedIds.includes(b)).length;
      return usesA - usesB;
    });

    ids.forEach(id => {
      if (left <= 0) return;
      const avail = remaining.get(id) || 0;
      const take = Math.min(avail, left);
      remaining.set(id, avail - take);
      allocated += take;
      left -= take;
    });

    g.need = need;
    g.allocated = allocated;
    g.shortage = Math.max(0, need - allocated);
    g.days = g.daily > 0 ? allocated / g.daily : null;
    const prefStock = (g.preferredIds || []).reduce((sum,id) => sum + (remaining.get(id) || 0) + 0, 0);
    // Waarschuw alleen als er nog voorkeurssmaak is, maar voor maximaal 7 dagen.
    // Bij 0 voorkeurssmaak geven we geen aparte melding zolang alternatieven de totale minimumvoorraad dekken.
    g.preferenceDays = g.daily > 0 ? prefStock / g.daily : null;
    g.preferenceWarning = g.preferredIds.length > 0 && prefStock > 0 && g.preferenceDays <= 7 && g.shortage <= 0;
    const gp = g.allowedIds.map(id => data.products.find(p => p.id === id)).find(Boolean) || rep;
    const packSize = Number(gp?.contentPerOrderUnit || 1);
    g.orderUnits = packSize > 0 ? Math.ceil(g.shortage / packSize) : 0;
  });

  // Een geregistreerde bestelling verlaagt alleen wat nog besteld moet worden.
  // De fysieke voorraad en het aantal dagen voorraad blijven ongewijzigd.
  let orderedLeft = orderedPackages;
  prefGroups.forEach(g => {
    const used = Math.min(orderedLeft, g.orderUnits);
    g.orderUnits -= used;
    orderedLeft -= used;
  });

  return { name, products, active, rooms, roomPlans, daily, targetDays, targetDemand, shortage, orderUnits, rep, days, accepted, other, acceptedStock, prefGroups };
}

function renderDrinkOrders() {
  const groups = familyNames("drink").map(drinkFamilyPlan).filter(g => g.daily > 0 && g.rep && g.products.some(p => p.externalProduct !== true));
  orderList.innerHTML = groups.length ? groups.map(g => {
    const p = g.rep;

    const stockRows = g.products.filter(x => activeProduct(x) || (stockUnits(x) + orderedUnits(x)) > 0).map(x => {
      const stock = stockUnits(x) + orderedUnits(x);
      return `<div class="order-variant"><span><strong>${esc(variantLabel(x) || "Zonder smaak")}</strong></span><span>${fmt(stock)} ${esc(looseUnitLabel(x, stock))}</span></div>`;
    }).join("");

    const prefSections = g.prefGroups.map(pg => {
      const names = pg.allowedIds.map(id => data.products.find(x => x.id === id)).filter(Boolean).map(x => variantLabel(x) || "Zonder smaak");
      const preferredNames = (pg.preferredIds || []).map(id => data.products.find(x => x.id === id)).filter(Boolean).map(x => variantLabel(x) || "Zonder smaak");
      const dislikedNames = (pg.dislikedIds || []).map(id => data.products.find(x => x.id === id)).filter(Boolean).map(x => variantLabel(x) || "Zonder smaak");
      const roomNames = pg.rooms.map(r => `Kamer ${r.room}`).join(" · ");
      const days = pg.days == null ? null : Math.floor(pg.days * 10) / 10;
      const choice = names.length === 1 ? names[0] : names.join(" of ");
      return `<div class="order-pref-group">
        <div class="order-room-pref"><strong>${esc(roomNames)}</strong></div>
        <div class="order-pref-choice">Voorkeur: <strong>${esc(preferredNames.length ? preferredNames.join(" of ") : "geen")}</strong>${dislikedNames.length ? `<br>Lust absoluut niet: <strong>${esc(dislikedNames.join(" · "))}</strong>` : ""}<br>Alternatieven toegestaan: <strong>${esc(choice)}</strong></div>${pg.preferenceWarning ? `<div class="status-warn" style="margin-top:6px">Voorkeurssmaak nog ongeveer ${fmt(pg.preferenceDays)} dagen beschikbaar</div>` : ""}
        <div class="order-main">${pg.orderUnits > 0
          ? `<span class="status-order">Bestellen · ${pg.orderUnits} ${esc(plural(p.orderUnit, pg.orderUnits))}</span> <span>uit: ${esc(choice)}</span>`
          : `<span class="status-ok">Voldoende voorraad voor deze kamer${pg.rooms.length > 1 ? "s" : ""}</span>`}
        </div>
        <div class="order-meta">Verbruik: ${fmt(pg.daily)} ${esc(p.consumptionUnit)} per dag · doel ${g.targetDays} dagen${days != null ? `<br>Toegewezen voorraad: ${fmt(pg.allocated)} ${esc(looseUnitLabel(p, pg.allocated))} · ± ${fmt(days)} dagen` : ""}</div>
      </div>`;
    }).join("");

    const totalOrder = g.prefGroups.reduce((sum, pg) => sum + Number(pg.orderUnits || 0), 0);
    const ordered = familyOrderedPackages(g.name, "drink");
    const orderedDate = familyOrderedDate(g.name, "drink");
    const orderedInputId = `ordered-family-${p.id}`;
    const orderStatus = ordered > 0
      ? `<span class="status-ordered">${ordered} ${esc(plural(p.orderUnit, ordered))} besteld</span>${orderedDateHtml(orderedDate)}${totalOrder > 0 ? `<br><span class="status-order">Nog ${totalOrder} ${esc(plural(p.orderUnit, totalOrder))} bestellen</span>` : ""}`
      : totalOrder > 0
        ? `<span class="status-order">Bestellen · ${totalOrder} ${esc(plural(p.orderUnit, totalOrder))}</span>`
        : `<span class="status-ok">Voldoende voorraad</span>`;
    return `<div class="item order-card order-family-card">
      <div class="order-product">${esc(g.name)}</div>
      <div class="order-summary">${orderStatus}</div>
      <div class="order-entry"><label for="${orderedInputId}">Werkelijk besteld</label><input id="${orderedInputId}" type="number" min="0" step="1" enterkeyhint="done" value="${ordered}" onkeydown="if(event.key==='Enter'){event.preventDefault();saveFamilyOrdered('${encodeURIComponent(g.name).replace(/'/g, "%27")}','drink','${orderedInputId}');this.blur();}"><span>${esc(plural(p.orderUnit, ordered || 2))}</span><button type="button" class="small-primary" onclick="saveFamilyOrdered('${encodeURIComponent(g.name).replace(/'/g, "%27")}', 'drink', '${orderedInputId}')">Opslaan</button></div>
      ${ordered > 0 ? `<button type="button" class="secondary compact-btn" onclick="receiveFamilyOrder('${encodeURIComponent(g.name).replace(/'/g, "%27")}', 'drink')">Bestelling ontvangen</button>` : ""}
      <div class="order-variant-list">${stockRows}</div>
      <details class="order-details"><summary>Berekening bekijken</summary>
        <div class="order-pref-groups">${prefSections}</div>
        <div class="order-rule-note">Voorraad van een smaak wordt eerst gereserveerd voor bewoners die minder keuze hebben. Smaken bij “Lust absoluut niet” tellen nooit mee. Andere smaken mogen incidenteel als alternatief worden gebruikt. Bestellen gebeurt pas als de totale bruikbare voorraad onder het minimum komt.</div>
      </details>
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
      <div class="order-main">${a.orderUnits > 0 ? `<span class="status-order">Bestellen · ${a.orderUnits} ${esc(plural(p.orderUnit, a.orderUnits))}</span>` : `<span class="status-ok">Voldoende voorraad</span>`}</div>
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
    const drinkPlan = currentMode === "drink" ? drinkFamilyPlan(g.name) : null;
    const days = drinkPlan ? drinkPlan.days : (daily > 0 ? stock / daily : null);
    const minimum = daily * DELIVERY_DAYS;
    const shortage = Math.max(0, minimum - stock);
    const pack = Number(p.contentPerOrderUnit || 1);
    const orderUnits = drinkPlan ? drinkPlan.orderUnits : (daily > 0 ? Math.ceil(shortage / pack) : 0);
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
  // Een hogere telling betekent niet automatisch dat een bestelling ontvangen is.
  // De bestelregistratie wordt alleen bewust via 'Werkelijk besteld' aangepast.
  if (stockUnits(p) <= 0) { p.expiryDate = ""; p.lastExpiryCheck = ""; }
  saveData();
}
function changeLoose(id, delta) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  p.stockLoose = Math.max(0, Number(p.stockLoose || 0) + delta);
  if (stockUnits(p) <= 0) { p.expiryDate = ""; p.lastExpiryCheck = ""; }
  saveData();
}

let editingExpiryProductId = null;
function populateExpiryYearOptions(selectedYear) {
  const currentYear = new Date().getFullYear();
  const selected = Number(selectedYear || 0);
  const firstYear = currentYear;
  const lastYear = currentYear + 2;
  expiryYearInput.innerHTML = `<option value="">Jaar</option>` +
    Array.from({length:lastYear-firstYear+1},(_,i)=>firstYear+i)
      .map(year=>`<option value="${year}">${year}</option>`).join("");
  expiryYearInput.value = selected >= currentYear && selected <= lastYear ? String(selected) : "";
}
function openExpiryModal(id) {
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  editingExpiryProductId = id;
  expiryProductLabel.textContent = labelProduct(p);
  const expiryMonth = normalizeExpiryMonth(p.expiryDate);
  const [selectedYear="",selectedMonth=""] = expiryMonth.split("-");
  expiryMonthInput.value = selectedMonth;
  populateExpiryYearOptions(selectedYear);
  lastExpiryCheckInfo.innerHTML = p.lastExpiryCheck
    ? `Laatste THT-controle: <strong>${esc(formatDate(p.lastExpiryCheck))}</strong><br>Na 3 maanden geeft de app opnieuw een controlemelding.`
    : `Nog geen THT-controle opgeslagen. Controleer ook de flesjes of verpakkingen achteraan in de kast.`;
  expiryModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => expiryMonthInput.focus(), 0);
}
function closeExpiryModal() {
  editingExpiryProductId = null;
  expiryModal.classList.add("hidden");
  document.body.style.overflow = "";
}
saveExpiryCheck.onclick = () => {
  const p = data.products.find(x => x.id === editingExpiryProductId);
  if (!p) return;
  const month = expiryMonthInput.value;
  const year = expiryYearInput.value;
  if ((month && !year) || (!month && year)) {
    alert("Kies zowel de maand als het jaar van de THT.");
    return;
  }
  p.expiryDate = month && year ? `${year}-${month}` : "";
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
  editScheduleTimes.value = r.scheduleTimes || "";
  editScheduleAmount.value = r.scheduleAmount || "";
  editScheduleDays.value = normalizeDays(r.scheduleDays);
  scheduleEntryDrafts.edit.clear();
  roomScheduleEntries(r).forEach(e=>scheduleEntryDrafts.edit.set(e.time,e));
  syncChipPicker("edit", editScheduleTimes.value, editScheduleDays.value);
  editScheduleChoice.value = r.scheduleChoice || "fixed";
  editScheduleNote.value = r.scheduleNote || "";
  syncScheduleEntryEditor("edit");
  editScheduleShowOnPdf.checked = r.showOnPdf !== false;
  setRoomUnitFromProduct(editRoomProduct, editDailyUnit);
  const checked = r.allFlavors ? activeFlavorIds(r.productName, r.mode) : (r.selectedProductIds || []);
  renderFlavorChoices(editRoomProduct, editRoomFlavorChoices, checked, !!r.allFlavors, r.dislikedProductIds || []);
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
  const entries = getScheduleEntries("edit");
  updateCalculatedDailyAmount("edit");
  const amount = Number(String(editDailyAmount.value).replace(",", "."));
  const roomNumber = editRoomNumber.value.trim();
  const productName = parseRoomProductName(editRoomProduct.value);
  if (!r || !roomNumber || !Number.isFinite(amount) || amount <= 0 || !productName) {
    alert("Vul kamernummer, product en verbruik in.");
    return;
  }
  if(entries.some(e=>!(Number(e.amount)>0))){alert("Vul bij ieder gekozen tijdstip een hoeveelheid per keer in.");return;}
  const selection = selectionForRoom(productName, r.mode, editRoomFlavorChoices);
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
  r.dislikedProductIds = selection.dislikedIds || [];
  r.dailyAmount = amount;
  setRoomUnitFromProduct(editRoomProduct, editDailyUnit);
  r.dailyUnit = editDailyUnit.value;
  r.scheduleTimes = editScheduleTimes.value.trim();
  r.scheduleEntries = entries;
  r.scheduleAmount = entries.length===1 ? Number(entries[0].amount||0) : 0;
  r.scheduleDays = editScheduleDays.value;
  r.scheduleChoice = editScheduleChoice.value || "fixed";
  r.scheduleNote = entries.length===1 ? entries[0].note : "";
  r.showOnPdf = editScheduleShowOnPdf.checked;
  closeRoomEdit();
  saveData();
};

let pendingDeleteRoomId = null;
function deleteRoom(id) {
  pendingDeleteRoomId = id;
  document.getElementById("deleteRoomModal")?.classList.remove("hidden");
}
function closeDeleteRoomModal() {
  pendingDeleteRoomId = null;
  document.getElementById("deleteRoomModal")?.classList.add("hidden");
}
document.getElementById("confirmDeleteRoom")?.addEventListener("click", () => {
  if (!pendingDeleteRoomId) return;
  data.rooms = data.rooms.filter(r => r.id !== pendingDeleteRoomId);
  closeDeleteRoomModal();
  saveData();
});
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
  editProductType.value = p.mode || "drink";
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
  editExternalProduct.checked = p.externalProduct === true;
  editExternalQuantity.value = p.externalQuantity || 0;
  editShowOnWeeklyList.checked = p.showOnWeeklyList !== false;
  syncExternalEditForm();
  editMinimumStock.value = p.minimumStock || 0;
  editProductActive.checked = activeProduct(p);
  editProductActiveRow.classList.toggle("hidden", editExternalProduct.checked);
  editProductPhaseOut.checked = phaseOutProduct(p);
  editProductPhaseOutRow.classList.toggle("hidden", p.mode !== "sonde");
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
  const oldMode = p.mode;
  const newMode = editProductType.value;
  const linkedToRoom = data.rooms.some(r =>
    r.mode === oldMode &&
    canonicalName(r.productName) === canonicalName(p.name) &&
    (r.allFlavors === true || (Array.isArray(r.selectedProductIds) && r.selectedProductIds.includes(p.id)))
  );
  if (newMode !== oldMode && linkedToRoom) {
    alert("Dit product is nog aan een kamer gekoppeld. Verwijder of wijzig eerst die kamerregel voordat je de productgroep verandert.");
    return;
  }
  const oldName = p.name;
  const name = canonicalName(editProductName.value.trim());
  const flavor = newMode === "sonde" ? "" : editFlavor.value.trim();
  const isExternal = editExternalProduct.checked;
  const content = isExternal ? 1 : Number(String(editContentPerOrderUnit.value).replace(",", "."));
  if (!name || !Number.isFinite(content) || content <= 0) {
    alert("Vul productnaam en inhoud per besteleenheid in.");
    return;
  }

  if (canonicalName(oldName) !== canonicalName(name)) {
    data.products
      .filter(x => x.mode === oldMode && canonicalName(x.name) === canonicalName(oldName))
      .forEach(x => x.name = name);
    data.rooms
      .filter(r => r.mode === oldMode && canonicalName(r.productName) === canonicalName(oldName))
      .forEach(r => r.productName = name);
  }
  p.mode = newMode;
  p.name = name;
  p.flavor = flavor;
  p.consumptionUnit = editConsumptionUnit.value;
  p.orderUnit = editOrderUnit.value;
  p.contentPerOrderUnit = content;
  p.looseUnitsAllowed = content > 1 && editLooseUnitsAllowed.value === "yes";
  p.stockFull = Math.max(0, Number(editStockFull.value) || 0);
  p.stockLoose = p.looseUnitsAllowed ? Math.max(0, Number(editStockLoose.value) || 0) : 0;
  const editedOrdered = Math.max(0, Number(editAlreadyOrdered.value) || 0);
  if (editedOrdered > 0 && (editedOrdered !== Number(p.alreadyOrdered || 0) || !p.orderedDate)) p.orderedDate = todayLocalIso();
  if (editedOrdered === 0) p.orderedDate = "";
  p.alreadyOrdered = editedOrdered;
  p.externalProduct = isExternal;
  p.externalQuantity = isExternal ? Math.max(0, Number(editExternalQuantity.value) || 0) : 0;
  p.showOnWeeklyList = editShowOnWeeklyList.checked;
  p.minimumStock = Math.max(0, Number(editMinimumStock.value) || 0);
  p.generalTarget = p.mode === "general" ? p.minimumStock : 0;
  p.active = editProductActive.checked;
  p.phaseOut = p.mode === "sonde" ? editProductPhaseOut.checked : false;
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
  // Elke pagina begint bovenaan, ook op mobiel/PWA.
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  if (b.dataset.tab !== "orders") document.getElementById("backToOverview")?.classList.add("hidden");
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
  const entries = getScheduleEntries("add");
  updateCalculatedDailyAmount("add");
  const amount = Number(String(dailyAmount.value).replace(",", "."));
  const productName = parseRoomProductName(roomProduct.value);
  if (!roomV || amount <= 0 || !productName) {
    alert("Vul kamernummer, product en verbruik in.");
    return;
  }
  const selection = selectionForRoom(productName, currentMode, roomFlavorChoices);
  if (currentMode === "sonde" && familyProducts(productName, currentMode).length > 1 && selection.ids.length < 1) {
    alert("Vink minimaal één inhoud/variant aan.");
    return;
  }
  setRoomUnitFromProduct(roomProduct, dailyUnit);
  data.rooms.push({
    id: crypto.randomUUID(), mode: currentMode, room: roomV, unit: unitV,
    productId: null, productName, allFlavors: selection.allFlavors,
    selectedProductIds: selection.ids, dislikedProductIds: selection.dislikedIds || [], dailyAmount: amount, dailyUnit: dailyUnit.value
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

const syncExternalNewForm = () => {
  const ext = externalProduct.checked;
  if (ext) { productType.value = "drink"; currentMode = "drink"; }
  productType.disabled = ext;
  externalQuantityField.classList.toggle("hidden", !ext);
  [consumptionUnit, orderUnit, contentPerOrderUnit, looseUnitsAllowed, stockFull, stockLoose, alreadyOrdered, minimumStock].forEach(el => el.closest(".field")?.classList.toggle("hidden", ext));
  flavorField.classList.remove("hidden");
};
externalProduct.onchange = syncExternalNewForm;

const syncExternalEditForm = () => {
  const ext = editExternalProduct.checked;
  if (ext) editProductType.value = "drink";
  editProductType.disabled = ext;
  editExternalQuantityField.classList.toggle("hidden", !ext);
  [editConsumptionUnit, editOrderUnit, editContentPerOrderUnit, editLooseUnitsAllowed, editStockFull, editStockLoose, editAlreadyOrdered, editMinimumStock].forEach(el => el.closest(".field")?.classList.toggle("hidden", ext));
  editProductActiveRow.classList.toggle("hidden", ext);
  syncProductEditTypeFields();
};
editExternalProduct.onchange = syncExternalEditForm;

function syncProductEditTypeFields() {
  const mode = editProductType.value;
  const ext = editExternalProduct.checked;
  editFlavorField.classList.toggle("hidden", mode === "sonde");
  editFlavorField.querySelector("label").textContent = mode === "general" ? "Soort" : "Smaak";
  editMinimumStock.closest(".field").classList.toggle("hidden", ext || mode !== "general");
  editProductPhaseOutRow.classList.toggle("hidden", ext || mode !== "sonde");
  editProductActiveTitle.textContent = mode === "drink" ? "Smaak actief in assortiment" : "Product actief in assortiment";
  editProductActiveHelp.textContent = mode === "general"
    ? "Zet uit als dit product tijdelijk niet wordt gebruikt."
    : "Zet uit als dit product of deze smaak niet meer gebruikt wordt.";
}
editProductType.onchange = syncProductEditTypeFields;

saveProduct.onclick = () => {
  const name = canonicalName(productName.value.trim());
  const fl = currentMode === "sonde" ? "" : flavor.value.trim();
  const cu = consumptionUnit.value;
  const ou = orderUnit.value;
  const isExternal = externalProduct.checked;
  if (isExternal) currentMode = "drink";
  const content = isExternal ? 1 : Number(contentPerOrderUnit.value);
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
    minimumStock: min, order: maxOrder + 1, expiryDate: "", lastExpiryCheck: "", active: true, phaseOut: false, externalProduct: isExternal, externalQuantity: isExternal ? Math.max(0, Number(externalQuantity.value) || 0) : 0
  });
  productName.value = "";
  flavor.value = "";
  contentPerOrderUnit.value = "";
  looseUnitsAllowed.value = "yes";
  stockFull.value = "0";
  stockLoose.value = "0";
  alreadyOrdered.value = "0";
  minimumStock.value = "0"; externalQuantity.value = "0"; externalProduct.checked = false; productType.disabled = false;
  syncExternalNewForm(); syncNewLooseField();
  saveData();
};

renderAll();

/* ===============================
   V3.1 — één werkstroom
   Bijvoeding, sondevoeding en Algemeen blijven intern producttypes,
   maar staan niet meer in aparte hoofdmenu's.
   =============================== */

function targetWeeks(mode = currentMode) {
  return mode === "sonde" ? Number(data.settings.sondeWeeks || 3) : Number(data.settings.drinkWeeks || 3);
}

function allProductsOrdered() {
  return [...data.products].sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || labelProduct(a).localeCompare(labelProduct(b), "nl"));
}
function roomOnlyProducts() {
  return allProductsOrdered().filter(p => p.mode === "drink" || p.mode === "sonde");
}
function typeName(mode) {
  return mode === "drink" ? "Bijvoeding" : mode === "sonde" ? "Sondevoeding" : "Algemeen";
}
function adviceForProduct(p) {
  const old = currentMode;
  currentMode = p.mode;
  const result = advice(p);
  currentMode = old;

  // V3.2 — dezelfde sondevoeding met verschillende inhoudsvarianten vormt één voorraad.
  // Uitlopende varianten blijven meetellen in de voorraad, maar worden nooit besteladvies.
  if (p.mode === "sonde") {
    const family = familyProducts(p.name, "sonde", true);
    const daily = familyDailyUsage(p.name, "sonde");
    const weekly = daily * 7;
    const usageTarget = weekly * targetWeeks("sonde");
    const minimumTarget = daily * DELIVERY_DAYS;
    const needed = daily > 0 ? Math.max(usageTarget, minimumTarget) : 0;
    const available = familyStockUnits(p.name, "sonde");
    const shortage = Math.max(0, needed - available);
    const orderable = family.filter(orderableProduct);
    // Bestel bij voorkeur de grootste nog actieve verpakking; uitlopend nooit bestellen.
    const preferred = orderable.slice().sort((a,b) => Number(b.contentPerOrderUnit||1)-Number(a.contentPerOrderUnit||1))[0] || null;
    const advisedOrderUnits = preferred && p.id === preferred.id && shortage > 0
      ? Math.ceil(shortage / Number(preferred.contentPerOrderUnit || 1))
      : 0;
    const orderUnits = preferred && p.id === preferred.id
      ? Math.max(0, advisedOrderUnits - familyOrderedPackages(p.name, "sonde"))
      : 0;
    return {
      ...result, daily, weekly, usageTarget, minimumTarget, needed, available, shortage,
      orderUnits, familyCombined: family.length > 1, preferredOrderProductId: preferred?.id || null,
      phaseOut: phaseOutProduct(p)
    };
  }
  return result;
}

// Bij een nieuwe kamer bepaalt de gekozen voedingssoort welke producten zichtbaar zijn.
selectedRoomMode = function(selectEl) {
  if (selectEl === editRoomProduct && editingRoomId) {
    return data.rooms.find(r => r.id === editingRoomId)?.mode || "drink";
  }
  if (selectEl === roomProduct && typeof roomType !== "undefined") return roomType.value;
  return currentMode;
};

function renderProductOptionsCombined() {
  const mode = roomType.value;
  roomProduct.innerHTML = roomOptions(mode);
  setRoomUnitFromProduct(roomProduct, dailyUnit);
  renderFlavorChoices(roomProduct, roomFlavorChoices, []);
}

function renderCounting() {
  const ps = allProductsOrdered().filter(p => p.externalProduct !== true);
  const groups = [];
  ps.forEach(p => {
    // V3.3.52: ieder product met meerdere smaken/inhouden/varianten wordt
    // als één hoofdproduct getoond. Dit geldt voor bijvoeding, sondevoeding
    // én algemene voorraad (bijv. Abound, Slikgel, Thicken Up Clear en Jevity).
    const key = productFamilyKey(p);
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, mode: p.mode, name: p.name, products: [] }; groups.push(g); }
    g.products.push(p);
  });

  countList.innerHTML = groups.length ? groups.map(g => {
    if (g.products.length === 1) {
      const p = g.products[0];
      const loose = hasLooseUnits(p);
      const unusedStock = p.mode !== "general" && !isInUse(p) && stockUnits(p) > 0;
      return `<div class="item count-card ${unusedStock ? "unused-stock" : ""}">
        <div class="item-head"><div><strong>${esc(labelProduct(p))}</strong>${!activeProduct(p) ? ` <span class="badge inactive-badge">Niet actief</span>` : ""}${phaseOutProduct(p) ? ` <span class="badge phaseout-badge">Uitlopend</span>` : ""}</div></div>
        ${p.mode === "general" ? "" : `<div class="stock-status-row"><div class="count-meta">${useBadge(p)}</div><div class="days-pill">${esc(daysSupplyText(p))}</div></div>`}
        ${unusedStock ? `<div class="status-warn" style="margin-top:8px">Voorraad aanwezig, maar momenteel niet in gebruik</div>` : ""}
        ${p.mode !== "general" && activeProduct(p) && isInUse(p) && belowMinimum(p) ? `<div class="status-danger" style="margin-top:6px">Onder minimumvoorraad</div>` : ""}
        <div class="counter-wrap"><button class="counter-btn" onclick="changeStock('${p.id}',-1)">−</button><div class="counter-value">${hasLooseUnits(p) ? esc(packageCountLabel(p, p.stockFull)) : `${fmt(p.stockFull)} ${esc(plural(p.orderUnit, p.stockFull))}`}</div><button class="counter-btn" onclick="changeStock('${p.id}',1)">+</button></div>
        ${loose ? `<div class="loose-counter-compact"><div class="counter-wrap"><button class="counter-btn" onclick="changeLoose('${p.id}',-1)">−</button><div class="counter-value">${fmt(p.stockLoose)} ${esc(looseUnitLabel(p, p.stockLoose))}</div><button class="counter-btn" onclick="changeLoose('${p.id}',1)">+</button></div><div class="count-total">Totaal: <strong>${fmt(stockUnits(p))} ${esc(looseUnitLabel(p, stockUnits(p)))}</strong></div></div>` : ""}
        ${stockUnits(p) > 0 ? `<div class="expiry-compact"><button class="secondary compact-btn" onclick="openExpiryModal('${p.id}')">THT</button>${p.expiryDate ? `<span class="expiry-date-text">${esc(formatExpiryMonth(p.expiryDate))}</span>` : ""}</div>` : ""}
      </div>`;
    }

    const family = g.products;
    const total = family.reduce((sum,p) => sum + stockUnits(p), 0);
    const unit = family[0]?.consumptionUnit || "stuks";
    const inUse = family.some(isInUse);
    const low = family.some(p => activeProduct(p) && isInUse(p) && belowMinimum(p));
    const rows = family.map(p => {
      const variant = variantLabel(p) || "Standaard";
      const loose = hasLooseUnits(p);
      return `<div class="flavor-stock-row">
        <div class="flavor-stock-head"><strong>${esc(variant)}</strong>${!activeProduct(p) ? `<span class="badge inactive-badge">Niet actief</span>` : ""}</div>
        <div class="counter-wrap flavor-counter"><button class="counter-btn" onclick="changeStock('${p.id}',-1)">−</button><div class="counter-value">${loose ? esc(packageCountLabel(p,p.stockFull)) : `${fmt(p.stockFull)} ${esc(plural(p.orderUnit,p.stockFull))}`}</div><button class="counter-btn" onclick="changeStock('${p.id}',1)">+</button></div>
        ${loose ? `<div class="counter-wrap flavor-counter loose-flavor"><button class="counter-btn" onclick="changeLoose('${p.id}',-1)">−</button><div class="counter-value">${fmt(p.stockLoose)} ${esc(looseUnitLabel(p,p.stockLoose))}</div><button class="counter-btn" onclick="changeLoose('${p.id}',1)">+</button></div>` : ""}
        ${stockUnits(p) > 0 ? `<div class="expiry-compact"><button class="secondary compact-btn" onclick="openExpiryModal('${p.id}')">THT</button>${p.expiryDate ? `<span class="expiry-date-text">${esc(formatExpiryMonth(p.expiryDate))}</span>` : ""}</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="item count-card product-family-card">
      <div class="item-head"><div><strong>${esc(g.name)}</strong><div class="count-meta">${inUse ? `<span class="badge use-yes">In gebruik</span>` : `<span class="badge use-no">Niet in gebruik</span>`}</div></div><div class="family-total">Totaal<br><strong>${fmt(total)} ${esc(looseUnitLabel(family[0], total) || unit)}</strong></div></div>
      ${low ? `<div class="status-danger" style="margin-top:6px">Eén of meer varianten onder minimumvoorraad</div>` : ""}
      <div class="flavor-stock-list">${rows}</div>
    </div>`;
  }).join("") : `<div class="empty">Nog geen producten.</div>`;
}
function renderUsage() {
  generalTargetCard.classList.add("hidden");
  usageListTitle.classList.add("hidden");
  const rs = [...data.rooms]
    .filter(r => r.mode === "drink" || r.mode === "sonde")
    .sort((a, b) => Number(a.unit) - Number(b.unit) || String(a.room).localeCompare(String(b.room), undefined, { numeric: true }) || roomProductLabel(a).localeCompare(roomProductLabel(b)));
  const groups = [];
  rs.forEach(r => {
    const key = `${r.unit}::${r.room}`;
    let g = groups.find(x => x.key === key);
    if (!g) { g = {key, unit:r.unit, room:r.room, rows:[]}; groups.push(g); }
    g.rows.push(r);
  });
  const units = [];
  groups.forEach(group => {
    let unit = units.find(item => String(item.unit) === String(group.unit));
    if (!unit) {
      unit = { unit: group.unit, rooms: [] };
      units.push(unit);
    }
    unit.rooms.push(group);
  });
  usageList.innerHTML = units.length ? units.map(unit => `<details class="room-unit-section" open>
    <summary><strong>Unit ${esc(unit.unit)}</strong><span>${unit.rooms.length} ${unit.rooms.length === 1 ? "kamer" : "kamers"}</span></summary>
    <div class="room-unit-list">
    ${unit.rooms.map(g => `<div class="room-group-card">
    <div class="room-group-head"><strong>Kamer ${esc(g.room)}</strong></div>
    ${g.rows.map(r => `<div class="room-line">
      <div class="room-line-type-row"><span class="room-line-text">${esc(roomProductLabel(r))}${r.scheduleChoice === "or" ? ` <span class="choice-chip">OF-keuze</span>` : ""}</span><span class="type-chip ${r.mode}">${esc(typeName(r.mode))}</span></div>
      <div class="room-line-main"><span></span><span class="room-line-use">${esc(withUnit(r.dailyAmount, r.dailyUnit))}/dag</span></div>
      ${roomScheduleSummary(r)}
      <div class="room-line-actions"><button class="small-primary" onclick="editRoom('${r.id}')">Wijzigen</button><button class="small-copy" onclick="copyRoom('${r.id}')">Kopiëren</button><button class="small-danger" onclick="deleteRoom('${r.id}')">Verwijderen</button></div>
    </div>`).join("")}
  </div>`).join("")}
    </div>
  </details>`).join("") : `<div class="empty">Nog geen kamers ingevoerd.</div>`;
}

function roomScheduleSummary(r){
  const entries=roomScheduleEntries(r);
  if(!entries.length) return r.scheduleNote ? `<div class="schedule-meta"><strong>Extra info:</strong> ${esc(r.scheduleNote)}</div>` : "";
  return `<div class="schedule-meta">${entries.map(e=>`<strong>${esc(e.time)}</strong> · ${esc(withUnit(e.amount,r.dailyUnit))}${e.note?` — ${esc(e.note)}`:""}`).join("<br>")}</div>`;
}

function renderProducts() {
  const ps = allProductsOrdered();
  productList.innerHTML = ps.length ? ps.map(p => `<div class="compact-product-row product-sort-item ${!activeProduct(p) ? "inactive-product" : ""}" data-product-id="${p.id}">
    <button type="button" class="product-row-main" onclick="editStock('${p.id}')" aria-label="${esc(labelProduct(p))} wijzigen">
      <span class="product-row-name">${esc(p.name || "Product")}${!activeProduct(p) ? ` <span class="badge inactive-badge">Niet actief</span>` : ""}</span>
      <span class="product-row-variant">${esc(variantLabel(p) || typeName(p.mode))}</span>
    </button>
    <button type="button" class="copy-product-btn" onclick="copyProduct('${p.id}')">Kopiëren</button>
    <button type="button" class="drag-handle compact-drag" aria-label="Sleep ${esc(labelProduct(p))}" title="Sleep om te verplaatsen"><span aria-hidden="true">☰</span></button>
  </div>`).join("") : `<div class="empty">Nog geen producten.</div>`;
}

function sondeOrGeneralOrderCard(p) {
  if (!activeProduct(p)) return "";
  const a = adviceForProduct(p);
  if (p.mode !== "general" && (!activeProduct(p) || a.daily <= 0)) return "";
  const tht = p.mode === "general" ? "" : thtBadgeHtml(p);
  const meta = p.mode === "general"
    ? `Doelvoorraad: ${fmt(a.needed / Number(p.contentPerOrderUnit || 1))} ${esc(plural(p.orderUnit, a.needed / Number(p.contentPerOrderUnit || 1)))}${Number(p.minimumStock || 0) > 0 ? `<br>Minimum: ${esc(minimumText(p))}` : ""}`
    : `${esc(familyDaysSupplyText(p))} · gezamenlijk verbruik ${fmt(a.daily)} ${esc(p.consumptionUnit)} per dag · doel ${targetWeeks(p.mode)} weken<br>Minimum: ${esc(minimumText(p))}${phaseOutProduct(p) ? `<br><strong class="phaseout-note">Uitlopend product · voorraad telt mee, niet bestellen</strong>` : ""}`;
  const ordered = Number(p.alreadyOrdered || 0);
  const orderedInputId = `ordered-product-${p.id}`;
  let status = `<span class="status-ok">Voldoende voorraad</span>`;
  if (ordered > 0) status = `<span class="status-ordered">${ordered} ${esc(plural(p.orderUnit, ordered))} besteld</span>${orderedDateHtml(p.orderedDate)}${a.orderUnits > 0 ? `<br><span class="status-order">Nog ${a.orderUnits} ${esc(plural(p.orderUnit, a.orderUnits))} bestellen</span>` : ""}`;
  else if (a.orderUnits > 0) status = `<span class="status-order">Bestellen · ${a.orderUnits} ${esc(plural(p.orderUnit, a.orderUnits))}</span>`;
  else if (phaseOutProduct(p) && a.shortage > 0) status = `<span class="phaseout-status">Uitlopend · niet bestellen</span>`;
  return `<div class="item order-card ${phaseOutProduct(p) ? "phaseout-card" : ""}">
    <div class="order-product">${esc(labelProduct(p))}${phaseOutProduct(p) ? ` <span class="badge phaseout-badge">Uitlopend</span>` : ""}</div>
    <div class="order-main">${status}</div>
    ${!phaseOutProduct(p) ? `<div class="order-entry"><label for="${orderedInputId}">Werkelijk besteld</label><input id="${orderedInputId}" type="number" min="0" step="1" enterkeyhint="done" value="${ordered}" onkeydown="if(event.key==='Enter'){event.preventDefault();saveProductOrdered('${p.id}','${orderedInputId}');this.blur();}"><span>${esc(plural(p.orderUnit, ordered || 2))}</span><button type="button" class="small-primary" onclick="saveProductOrdered('${p.id}', '${orderedInputId}')">Opslaan</button></div>` : ""}
    ${ordered > 0 ? `<button type="button" class="secondary compact-btn" onclick="receiveProductOrder('${p.id}')">Bestelling ontvangen</button>` : ""}
    <div class="order-meta">${meta}</div>
    ${tht ? `<div class="order-chips">${tht}</div>` : ""}
  </div>`;
}

function groupedOtherOrderCards(){
  const products=allProductsOrdered().filter(p=>p.externalProduct!==true).filter(p=>p.mode==="sonde"||p.mode==="general");
  const groups=new Map(); products.forEach(p=>{const k=productFamilyKey(p);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)});
  return [...groups.values()].map(ps=>{
    if(ps.length===1)return sondeOrGeneralOrderCard(ps[0]);
    const visible=ps.filter(p=>activeProduct(p)); if(!visible.length)return "";
    const rep=visible[0], name=canonicalName(rep.name);
    const variants=visible.map(p=>{const a=adviceForProduct(p),q=Number(a.orderUnits||0);return `<div class="order-family-variant"><strong>${esc(variantLabel(p)||"Standaard")}</strong><span>${q>0?`${fmt(q)} ${esc(plural(p.orderUnit,q))}`:"voldoende"}</span></div>`}).join("");
    const total=visible.reduce((n,p)=>n+Number(adviceForProduct(p).orderUnits||0),0);
    return `<div class="item order-card order-family-card"><div class="order-product">${esc(name)}</div><div class="order-main">${total>0?`<span class="status-order">Bestellen</span>`:`<span class="status-ok">Voldoende voorraad</span>`}</div><div class="order-family-variants">${variants}</div></div>`;
  }).join("");
}

function renderOrders() {
  const old = currentMode;
  currentMode = "drink";
  renderDrinkOrders();
  let drinkHtml = orderList.querySelector(".empty") ? "" : orderList.innerHTML;
  const otherHtml = groupedOtherOrderCards();
  orderList.innerHTML = drinkHtml + otherHtml || `<div class="empty">Er zijn nog geen producten waarvoor een besteladvies nodig is.</div>`;
  currentMode = old;
  renderOrderScanHistory();
}


// V3.3.55 - digitaal afbeeldingsbestand of camera; robuustere tabelherkenning en samenvoegen.
let orderScanState = { imageDataUrl:"", rawText:"", rows:[] };
function scanNorm(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function scanFamilies(){const m=new Map();allProductsOrdered().filter(p=>p.externalProduct!==true).forEach(p=>{const k=productFamilyKey(p);if(!m.has(k))m.set(k,{key:k,name:canonicalName(p.name),mode:p.mode,products:[]});m.get(k).products.push(p)});return [...m.values()].map(g=>({...g,products:g.products.sort((a,b)=>Number(a.order)-Number(b.order))}))}
function scanFamilyOptions(k=""){return `<option value="" ${!k?"selected":""} disabled>Kies product…</option>`+scanFamilies().map(g=>`<option value="${esc(g.key)}" ${g.key===k?"selected":""}>${esc(g.name)} · ${esc(g.mode==="drink"?"Bijvoeding":g.mode==="sonde"?"Sondevoeding":"Algemeen")}</option>`).join("")}
function scanVariantOptions(k,id=""){const g=scanFamilies().find(x=>x.key===k);if(!g)return `<option value="" selected disabled>Kies eerst product…</option>`;return `<option value="" ${!id?"selected":""} disabled>Kies variant…</option>`+g.products.map(p=>`<option value="${esc(p.id)}" ${p.id===id?"selected":""}>${esc(variantLabel(p)||"Standaard")}</option>`).join("")}
function bestScanFamily(text){const n=scanNorm(text);if(!n)return null;let best=null;for(const g of scanFamilies()){const gn=scanNorm(g.name);let score=n.includes(gn)?100+gn.length:0;const toks=gn.split(" ").filter(x=>x.length>2);score+=toks.reduce((a,t)=>a+(n.includes(t)?Math.min(t.length,10):0),0);if(/nutridrink creme/.test(gn)&&/nutridrink creme/.test(n))score+=60;if(/ensure plus advance/.test(gn)&&/ensure plus advance/.test(n))score+=60;if(/ensure two cal|ensure twocal/.test(gn)&&/ensure two ?cal/.test(n))score+=60;if(/thicken up clear/.test(gn)&&/thicken up clear/.test(n))score+=60;if(/jevity 1 5/.test(gn)&&/jevity 1 5/.test(n))score+=60;if(/slikgel/.test(gn)&&/slikgel/.test(n))score+=60;if(/abound/.test(gn)&&/abound/.test(n))score+=60;if(!best||score>best.score)best={g,score}}return best&&best.score>=18?best.g:null}
function bestScanProduct(g,text){if(!g||!g.products.length)return null;if(g.products.length===1)return g.products[0];const n=scanNorm(text);let best=null;g.products.forEach(p=>{const l=scanNorm(variantLabel(p));let score=l&&n.includes(l)?100+l.length:0;const size=String(Math.round(Number(p.contentPerOrderUnit||0)));if(p.mode==="sonde"&&size&&new RegExp(`\\b${size}\\s*ml\\b`).test(n))score+=150;if(!best||score>best.score)best={p,score}});return best&&best.score>0?best.p:g.products[0]}
function quantityFromScanLine(text,p){
  let part=String(text||"").replace(/\s+/g," ").trim();
  // Besteloverzichten hebben meestal: EENHEID  AANTAL  PRIJS. Pak daarom eerst
  // expliciet het getal direct na de eenheid; zo worden kcal, ml en prijs nooit aantal.
  const unitMatch=part.match(/\b(?:tray|trays|stuk|stuks|doos|dozen|flacon|flacons|pak|pakken)\s*[:\-]?\s*(\d{1,3})\b/i);
  if(unitMatch)return Math.max(1,Number(unitMatch[1]));
  // Verwijder een herkende prijs aan het einde, ook wanneer het euroteken ontbreekt.
  part=part.replace(/(?:€\s*)?\d{1,4}[,.]\d{2}\s*$/i,"").replace(/€.*$/i,"");
  const nums=[...part.matchAll(/\b(\d{1,4})\b/g)].map(m=>Number(m[1]));
  if(!nums.length)return 1;
  const ignore=new Set([2]); // '2 kcal' in Nutridrink Crème is geen bestelaantal
  if(p?.mode==="sonde")ignore.add(Number(p.contentPerOrderUnit||0));
  for(let i=nums.length-1;i>=0;i--)if(!ignore.has(nums[i]))return Math.max(1,nums[i]);
  return 1;
}
function mergeOrderScanRows(rows){
  const m=new Map();
  (rows||[]).forEach(r=>{if(!r?.productId)return;const k=r.productId;if(!m.has(k))m.set(k,{...r,qty:0,sources:[]});const x=m.get(k);x.qty+=Number(r.qty)||0;x.sources.push(r.source||"");x.source=x.sources.filter(Boolean).join(" | ")});
  return [...m.values()];
}
function parseOrderScanText(raw,lines=[]){
  const src=(lines.length?lines:String(raw||"").split(/\n+/)).map(x=>String(x||"").trim()).filter(Boolean);
  const out=[];
  for(let i=0;i<src.length;i++){
    const w=[src[i],src[i+1]||""].join(" ");
    const g=bestScanFamily(src[i])||bestScanFamily(w); if(!g)continue;
    const p=bestScanProduct(g,src[i])||bestScanProduct(g,w); if(!p)continue;
    const q=quantityFromScanLine(src[i],p);
    // Alleen één OCR-regel per fysieke tabelregel. Kopregels zonder eenheid/aantal overslaan.
    const hasOrderUnit=/\b(tray|trays|stuk|stuks|doos|dozen|flacon|flacons|pak|pakken)\b/i.test(src[i]);
    if(!hasOrderUnit && !/\b\d{1,3}\b/.test(src[i]))continue;
    out.push({familyKey:g.key,productId:p.id,qty:q,source:src[i]});
  }
  return mergeOrderScanRows(out);
}
function openOrderScanFilePicker(){const i=document.getElementById("orderScanInput");if(i){i.value="";i.click()}}
function openOrderScanCamera(){const i=document.getElementById("orderScanCameraInput");if(i){i.value="";i.click()}}
function openOrderScanPicker(){openOrderScanFilePicker()}
function openOrderScanModal(){document.getElementById("orderScanModal")?.classList.remove("hidden");document.body.classList.add("order-scan-open")}
function closeOrderScanModal(){document.getElementById("orderScanModal")?.classList.add("hidden");document.body.classList.remove("order-scan-open")}
function closeOrderHistoryModal(){document.getElementById("orderHistoryModal")?.classList.add("hidden")}
async function compactScanImage(file){const b=await createImageBitmap(file),max=1280,scale=Math.min(1,max/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(b.width*scale));c.height=Math.max(1,Math.round(b.height*scale));c.getContext("2d").drawImage(b,0,0,c.width,c.height);b.close?.();return c.toDataURL("image/jpeg",.72)}
async function processOrderScanFile(file){if(!file)return;openOrderScanModal();const st=document.getElementById("orderScanStatus"),pr=document.getElementById("orderScanProgress"),bar=document.getElementById("orderScanProgressBar"),pv=document.getElementById("orderScanPreview");orderScanState={imageDataUrl:"",rawText:"",rows:[]};st.textContent="Afbeelding voorbereiden…";pr.classList.remove("hidden");bar.style.width="5%";try{orderScanState.imageDataUrl=await compactScanImage(file)}catch(e){orderScanState.imageDataUrl=""}if(orderScanState.imageDataUrl){pv.src=orderScanState.imageDataUrl;pv.classList.remove("hidden")}if(!window.Tesseract){st.textContent="Tekstherkenning kon niet worden geladen. Voeg de regels handmatig toe en controleer ze.";pr.classList.add("hidden");addOrderScanRow();return}try{const r=await Tesseract.recognize(file,"nld",{logger:m=>{if(m.status==="recognizing text"){const pc=Math.round((m.progress||0)*100);bar.style.width=`${pc}%`;st.textContent=`Besteloverzicht lezen… ${pc}%`}}});orderScanState.rawText=r?.data?.text||"";const ls=(r?.data?.lines||[]).map(x=>x.text);orderScanState.rows=mergeOrderScanRows(parseOrderScanText(orderScanState.rawText,ls));document.getElementById("orderScanRawText").textContent=orderScanState.rawText;st.textContent=orderScanState.rows.length?`${orderScanState.rows.length} regel${orderScanState.rows.length===1?"":"s"} herkend. Controleer product, variant en aantal.`:"Geen bestelregels betrouwbaar herkend. Voeg ze handmatig toe.";if(!orderScanState.rows.length)addOrderScanRow(false);renderOrderScanRows()}catch(e){console.warn("OCR mislukt",e);st.textContent="Automatisch uitlezen lukte niet. Je kunt de bestelling hieronder handmatig koppelen.";addOrderScanRow(false);renderOrderScanRows()}finally{pr.classList.add("hidden");bar.style.width="0"}}
function addOrderScanRow(render=true){orderScanState.rows.push({familyKey:"",productId:"",qty:1,source:"Handmatig toegevoegd"});if(render)renderOrderScanRows()}
function removeOrderScanRow(i){orderScanState.rows.splice(i,1);renderOrderScanRows()}
function changeOrderScanFamily(i,k){const g=scanFamilies().find(x=>x.key===k);if(!g)return;orderScanState.rows[i].familyKey=k;orderScanState.rows[i].productId=g.products.length===1?(g.products[0]?.id||""):"";renderOrderScanRows()}
function changeOrderScanProduct(i,id){if(orderScanState.rows[i])orderScanState.rows[i].productId=id;renderOrderScanSummary()}
function changeOrderScanQty(i,v){if(orderScanState.rows[i])orderScanState.rows[i].qty=Math.max(0,Number(v)||0);renderOrderScanSummary()}
function renderOrderScanRows(){const el=document.getElementById("orderScanRows");if(!el)return;el.innerHTML=orderScanState.rows.map((r,i)=>`<div class="scan-row"><div class="scan-field scan-field-family"><label>Hoofdproduct</label><select onchange="changeOrderScanFamily(${i},this.value)">${scanFamilyOptions(r.familyKey)}</select></div><div class="scan-field"><label>Smaak / variant</label><select onchange="changeOrderScanProduct(${i},this.value)">${scanVariantOptions(r.familyKey,r.productId)}</select></div><div class="scan-field"><label>Aantal</label><input type="number" min="0" step="1" value="${Number(r.qty)||0}" onchange="changeOrderScanQty(${i},this.value)"></div><button type="button" class="scan-remove" aria-label="Regel verwijderen" onclick="removeOrderScanRow(${i})">×</button></div>`).join("");renderOrderScanSummary()}
function renderOrderScanSummary(){const sm=document.getElementById("orderScanSummary"),cf=document.getElementById("orderScanConfirm");if(!sm||!cf)return;const t=new Map();orderScanState.rows.forEach(r=>{const g=scanFamilies().find(x=>x.key===r.familyKey);if(g&&r.productId&&Number(r.qty)>0)t.set(g.name,(t.get(g.name)||0)+Number(r.qty))});sm.classList.toggle("hidden",t.size===0);sm.innerHTML=[...t.entries()].map(([n,q])=>`${esc(n)}: <strong>${fmt(q)}</strong>`).join(" · ");cf.disabled=!orderScanState.rows.some(r=>r.productId&&Number(r.qty)>0)}
function confirmOrderScan(){const valid=orderScanState.rows.filter(r=>r.productId&&Number(r.qty)>0);if(!valid.length)return;const comb=new Map();valid.forEach(r=>comb.set(r.productId,(comb.get(r.productId)||0)+Number(r.qty)));const items=[];comb.forEach((q,id)=>{const p=data.products.find(x=>x.id===id);if(!p)return;p.alreadyOrdered=q;p.orderedDate=isoToday();items.push({productId:id,name:canonicalName(p.name),variant:variantLabel(p)||"Standaard",qty:q,orderUnit:p.orderUnit})});data.settings.orderScanHistory=Array.isArray(data.settings.orderScanHistory)?data.settings.orderScanHistory:[];data.settings.orderScanHistory.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),imageDataUrl:orderScanState.imageDataUrl,rawText:orderScanState.rawText,items});data.settings.orderScanHistory=data.settings.orderScanHistory.slice(0,10);closeOrderScanModal();saveData()}
function renderOrderScanHistory(){const p=document.getElementById("orderHistoryPanel");if(!p)return;const h=data.settings?.orderScanHistory||[];if(!h.length){p.innerHTML="";return}p.innerHTML=`<div class="order-history-title"><strong>Bestelgeschiedenis</strong><small>laatste ${h.length}</small></div><div class="order-history-list">${h.slice(0,5).map(x=>{const d=new Date(x.date),lab=isNaN(d)?"Bestelling":d.toLocaleString("nl-NL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}),tot=(x.items||[]).reduce((s,i)=>s+Number(i.qty||0),0);return `<button type="button" class="order-history-item" onclick="openOrderHistory('${x.id}')">${x.imageDataUrl?`<img class="order-history-thumb" src="${x.imageDataUrl}" alt="">`:""}<span class="order-history-main"><strong>${esc(lab)}</strong><small>${(x.items||[]).length} regels · totaal ${fmt(tot)}</small></span><span>›</span></button>`}).join("")}</div>`}
function openOrderHistory(id){const x=(data.settings?.orderScanHistory||[]).find(h=>h.id===id);if(!x)return;const d=new Date(x.date);document.getElementById("orderHistoryTitle").textContent=isNaN(d)?"Bestelling":`Bestelling ${d.toLocaleDateString("nl-NL")}`;document.getElementById("orderHistoryDetail").innerHTML=`${x.imageDataUrl?`<img class="order-history-image" src="${x.imageDataUrl}" alt="Opgeslagen besteloverzicht">`:"<p>Geen afbeelding opgeslagen.</p>"}<div class="history-items">${(x.items||[]).map(i=>`<div class="history-item"><span>${esc(i.name)} · <strong>${esc(i.variant)}</strong></span><strong>${fmt(i.qty)} ${esc(plural(i.orderUnit,i.qty))}</strong></div>`).join("")}</div>`;document.getElementById("orderHistoryModal")?.classList.remove("hidden")}
function initOrderScan(){["orderScanInput","orderScanCameraInput"].forEach(id=>{const i=document.getElementById(id);if(i&&!i.dataset.bound){i.dataset.bound="1";i.addEventListener("change",()=>processOrderScanFile(i.files?.[0]))}});renderOrderScanHistory()}

function familyThtSummary(products) {
  const rows = (products || []).map(p => ({p, e: expiryInfo(p)}));
  const expired = rows.filter(x => x.e.expired && x.p.expiryDate).sort((a,b) => String(a.p.expiryDate).localeCompare(String(b.p.expiryDate)));
  if (expired.length) return {attention:true, html:`<span class="attention-chip danger-chip">THT verlopen · ${esc(formatExpiryMonth(expired[0].p.expiryDate))}</span>`};
  const soon = rows.filter(x => x.e.soon && x.p.expiryDate).sort((a,b) => String(a.p.expiryDate).localeCompare(String(b.p.expiryDate)));
  if (soon.length) return {attention:true, html:`<span class="attention-chip warn-chip">THT binnenkort · ${esc(formatExpiryMonth(soon[0].p.expiryDate))}</span>`};
  const quarterly = rows.find(x => x.e.quarterlyDue);
  if (quarterly) return {attention:true, html:`<button type="button" class="attention-chip neutral-chip tht-link" onclick="openExpiryModal('${quarterly.p.id}')">THT controleren</button>`};
  return {attention:false, html:""};
}

function overviewAttentionItems() {
  const items = [];
  const old = currentMode;

  currentMode = "drink";
  familyNames("drink").forEach(name => {
    const products = familyProducts(name, "drink", true);
    if (products.length && products.every(p => p.externalProduct === true)) return;
    const p = products.find(activeProduct) || products[0];
    if (!p) return;
    const plan = drinkFamilyPlan(name);
    const stock = familyStockUnits(name, "drink");
    const orderedPackages = familyOrderedPackages(name, "drink");
    const thtSummary = familyThtSummary(products);
    if (plan.orderUnits > 0 || orderedPackages > 0 || thtSummary.attention) {
      items.push({p, name, orderUnits:plan.orderUnits, orderedPackages, stock, days:plan.days, unused:false, tht:thtSummary.html, mode:"drink"});
    }
    products.filter(x => stockUnits(x) > 0 && !isInUse(x)).forEach(x => {
      items.push({p:x, name:labelProduct(x), orderUnits:0, stock:stockUnits(x), days:null, unused:true, tht:"", mode:"drink", transferOnly:true});
    });
  });

  const sondeNames = [...new Set(allProductsOrdered().filter(p => p.mode === "sonde").map(p => p.name))];
  sondeNames.forEach(name => {
    const products = familyProducts(name, "sonde", true);
    const p = products.find(activeProduct) || products[0];
    if (!p) return;
    const a = adviceForProduct(p);
    const stock = products.reduce((sum, x) => sum + stockUnits(x), 0);
    const orderedPackages = familyOrderedPackages(name, "sonde");
    const thtSummary = familyThtSummary(products);
    if (a.orderUnits > 0 || orderedPackages > 0 || thtSummary.attention) {
      items.push({p, name, orderUnits:a.orderUnits, orderedPackages, stock, days:familyDaysSupply(p), unused:false, tht:thtSummary.html, mode:"sonde"});
    }
    products.filter(x => stockUnits(x) > 0 && !isInUse(x)).forEach(x => {
      items.push({p:x, name:labelProduct(x), orderUnits:0, stock:stockUnits(x), days:null, unused:true, tht:"", mode:"sonde", transferOnly:true});
    });
  });

  const generalNames = [...new Set(allProductsOrdered().filter(p => p.mode === "general" && activeProduct(p)).map(p => p.name))];
  generalNames.forEach(name => {
    const products = familyProducts(name, "general", true);
    const p = products[0];
    if (!p) return;
    const orderUnits = products.reduce((sum, x) => sum + adviceForProduct(x).orderUnits, 0);
    const stock = products.reduce((sum, x) => sum + stockUnits(x), 0);
    const orderedPackages = familyOrderedPackages(name, "general");
    const thtSummary = familyThtSummary(products);
    if (orderUnits > 0 || orderedPackages > 0 || thtSummary.attention) {
      items.push({p, name, orderUnits, orderedPackages, stock, days:null, unused:false, tht:thtSummary.html, mode:"general"});
    }
  });
  currentMode = old;
  return items;
}

function renderRoomOverview() {
  if (typeof roomOverviewList === "undefined") return;
  const groups = new Map();
  data.rooms.filter(r => r.mode === "drink" || r.mode === "sonde").forEach(r => {
    const key = `${r.unit}|${r.room}`;
    if (!groups.has(key)) groups.set(key, {unit:r.unit, room:r.room, rows:[]});
    groups.get(key).rows.push(r);
  });
  const rooms = [...groups.values()].sort((a,b) => Number(a.unit)-Number(b.unit) || String(a.room).localeCompare(String(b.room), undefined, {numeric:true}));
  roomOverviewList.innerHTML = rooms.length ? rooms.map(g => `<div class="compact-room-card"><div class="compact-room-head"><strong>Kamer ${esc(g.room)}</strong><span>Unit ${esc(g.unit)}</span></div>${g.rows.map(r => `<div class="compact-room-product"><span>${esc(roomProductLabel(r))}${r.scheduleChoice === "or" ? ` <span class="choice-chip">OF</span>` : ""}</span><strong>${esc(amountText(r))} per keer</strong></div>`).join("")}</div>`).join("") : `<div class="empty">Nog geen kamers ingevoerd.</div>`;
}

function openOrderProduct(encodedName) {
  const name = decodeURIComponent(encodedName || "");
  document.querySelector('[data-tab="orders"]')?.click();
  document.getElementById("backToOverview")?.classList.remove("hidden");
  const search = document.getElementById("orderSearch");
  if (search) {
    search.value = name;
    search.dispatchEvent(new Event("input", {bubbles:true}));
  }
  requestAnimationFrame(() => {
    const card = [...document.querySelectorAll("#orderList .order-card")]
      .find(el => el.style.display !== "none" && normalize(el.textContent).includes(normalize(name)));
    if (!card) return;
    card.scrollIntoView({behavior:"smooth", block:"center"});
    card.classList.add("order-jump-highlight");
    setTimeout(() => card.classList.remove("order-jump-highlight"), 1800);
  });
}

function returnToOverview() {
  const search = document.getElementById("orderSearch");
  if (search) {
    search.value = "";
    search.dispatchEvent(new Event("input", {bubbles:true}));
  }
  document.getElementById("backToOverview")?.classList.add("hidden");
  document.querySelector('[data-tab="overview"]')?.click();
}

function renderOverview() {
  overviewTitle.textContent = "Alles in één overzicht";
  statUsageLabel.textContent = "Kamers";
  statUsage.textContent = new Set(data.rooms.filter(r => r.mode === "drink" || r.mode === "sonde").map(r => `${r.unit}|${r.room}`)).size;
  statProducts.textContent = data.products.length;
  const attention = overviewAttentionItems();
  statOrders.textContent = attention.filter(x => x.orderUnits > 0).length;
  statWeeks.textContent = `${targetWeeks("drink")} / ${targetWeeks("sonde")} weken`;
  weeksCard.classList.remove("hidden");

  document.querySelectorAll(".week-picker button").forEach(b => {
    const m = b.dataset.mode;
    b.classList.toggle("active", Number(b.dataset.weeks) === targetWeeks(m));
    b.onclick = () => {
      if (m === "drink") data.settings.drinkWeeks = Number(b.dataset.weeks);
      else data.settings.sondeWeeks = Number(b.dataset.weeks);
      saveData();
    };
  });

  attentionList.innerHTML = attention.length ? attention.map(x => {
    const p = x.p;
    const unit = p.consumptionUnit || looseUnitLabel(p, x.stock);
    const daysText = x.mode === "general" || x.days == null ? "" : ` · <strong>± ${fmt(Math.floor(x.days * 10) / 10)} dagen voorraad</strong>`;
    const minimum = x.transferOnly ? "" : (x.mode === "general" ? `Minimum: ${esc(minimumText(p))}` : `Minimum: <strong>10 dagen</strong>`);
    const expiredTht = x.tht && x.tht.includes("danger-chip");
    const soonTht = x.tht && x.tht.includes("warn-chip");
    const attentionClass = x.orderedPackages > 0 ? "attention-card ordered-priority" : x.orderUnits > 0 ? "attention-card order-priority" : expiredTht ? "attention-card tht-expired" : soonTht ? "attention-card tht-soon" : "attention-card attention-other";
    return `<div class="item ${attentionClass}">
      <div class="attention-product">${esc(x.name)}</div>
      <div class="overview-stock">Voorraad: <strong>${fmt(x.stock)} ${esc(unit)}</strong>${daysText}</div>
      ${minimum ? `<div class="overview-minimum">${minimum}</div>` : ""}
      ${x.orderedPackages > 0 ? `<button type="button" class="attention-ordered attention-action attention-order-link" onclick="openOrderProduct('${encodeURIComponent(x.name).replace(/'/g, "%27")}')"><strong>${x.orderedPackages} ${esc(plural(p.orderUnit, x.orderedPackages))} besteld</strong>${orderedDateHtml(familyOrderedDate(x.name, x.mode))}</button>` : ""}
      ${x.orderUnits > 0 ? `<button type="button" class="attention-order attention-action attention-order-link" onclick="openOrderProduct('${encodeURIComponent(x.name).replace(/'/g, "%27")}')"><strong>${x.orderedPackages > 0 ? `NOG ${x.orderUnits} ${esc(plural(p.orderUnit, x.orderUnits))} BESTELLEN` : "BESTELLEN"}</strong></button>` : ""}
      ${x.unused ? `<div class="attention-unused attention-action"><strong>VOORRAAD AANWEZIG · NIET IN GEBRUIK</strong><span class="unused-hint">Kijk of een andere afdeling dit kan gebruiken</span></div>` : ""}
      ${x.tht ? `<div class="attention-chips attention-action">${x.tht}</div>` : ""}
    </div>`;
  }).join("") : `<div class="empty overview-clear">✓ Geen acties of aandachtspunten</div>`;
  renderRoomOverview();
}

function syncProductTypeFields() {
  const mode = productType.value;
  currentMode = mode;
  flavorField.classList.toggle("hidden", mode === "sonde");
  flavorLabel.textContent = mode === "general" ? "Soort" : "Smaak / soort";
  manualMinimumField.classList.toggle("hidden", mode !== "general");
  newGeneralActiveRow.classList.toggle("hidden", mode !== "general");
  syncNewLooseField();
}

function renderAll() {
  syncProductTypeFields();
  renderProductOptionsCombined();
  renderCounting();
  renderUsage();
  renderProducts();
  renderOrders();
  renderOverview();
  currentMode = "drink";
}

roomType.onchange = () => {
  currentMode = roomType.value;
  renderProductOptionsCombined();
};
roomProduct.onchange = () => {
  currentMode = roomType.value;
  setRoomUnitFromProduct(roomProduct, dailyUnit);
  renderFlavorChoices(roomProduct, roomFlavorChoices, []);
};
productType.onchange = syncProductTypeFields;

saveRoom.onclick = () => {
  const mode = roomType.value;
  currentMode = mode;
  const roomV = room.value.trim();
  const unitV = unit.value;
  const amount = Number(String(dailyAmount.value).replace(",", "."));
  const productNameV = parseRoomProductName(roomProduct.value);
  if (!roomV || !unitV || !mode || amount <= 0 || !productNameV) {
    alert("Vul kamernummer, unit, soort voeding, product en verbruik in.");
    return;
  }
  if(entries.some(e=>!(Number(e.amount)>0))){alert("Vul bij ieder gekozen tijdstip een hoeveelheid per keer in.");return;}
  const selection = selectionForRoom(productNameV, mode, roomFlavorChoices);
  if (mode === "drink" && familyProducts(productNameV, mode).some(p => p.flavor) && selection.ids.length < 1) {
    alert("Vink minimaal één voorkeurssmaak aan."); return;
  }
  if (mode === "sonde" && familyProducts(productNameV, mode).length > 1 && selection.ids.length < 1) {
    alert("Vink minimaal één inhoud/variant aan."); return;
  }
  setRoomUnitFromProduct(roomProduct, dailyUnit);
  data.rooms.push({
    id: crypto.randomUUID(), mode, room: roomV, unit: unitV,
    productId: null, productName: productNameV, allFlavors: selection.allFlavors,
    selectedProductIds: selection.ids, dislikedProductIds: selection.dislikedIds || [], dailyAmount: amount, dailyUnit: dailyUnit.value,
    scheduleTimes: scheduleTimes.value.trim(), scheduleEntries: entries, scheduleAmount: entries.length===1 ? Number(entries[0].amount||0) : 0,
    scheduleDays: scheduleDays.value, scheduleChoice: scheduleChoice.value || "fixed", scheduleNote: entries.length===1 ? entries[0].note : "",
    showOnPdf: scheduleShowOnPdf.checked
  });
  scheduleTimes.value = ""; scheduleAmount.value = ""; scheduleDays.value = ALL_DAYS; scheduleChoice.value = "fixed"; scheduleNote.value = ""; scheduleShowOnPdf.checked = true; syncChipPicker("add", "", ALL_DAYS);
  scheduleEntryDrafts.add.clear();syncScheduleEntryEditor("add");
  dailyAmount.value = "";
  renderFlavorChoices(roomProduct, roomFlavorChoices, []);
  saveData();
  if (roomFormCardV316) roomFormCardV316.classList.add("hidden");
  if (showRoomFormBtn) showRoomFormBtn.focus();
};

saveProduct.onclick = () => {
  const mode = productType.value;
  currentMode = mode;
  const name = canonicalName(productName.value.trim());
  const fl = mode === "sonde" ? "" : flavor.value.trim();
  const cu = consumptionUnit.value;
  const ou = orderUnit.value;
  const isExternal = externalProduct.checked;
  if (isExternal) currentMode = "drink";
  const content = isExternal ? 1 : Number(contentPerOrderUnit.value);
  const allowLoose = content > 1 && looseUnitsAllowed.value === "yes";
  const sf = Number(stockFull.value || 0);
  const sl = allowLoose ? Number(stockLoose.value || 0) : 0;
  const ao = Number(alreadyOrdered.value || 0);
  const min = Number(minimumStock.value || 0);
  if (!name || content <= 0) { alert("Vul productnaam en inhoud per besteleenheid in."); return; }
  const exactDuplicate = data.products.some(p =>
    p.mode === mode &&
    canonicalName(p.name) === name &&
    (mode === "sonde"
      ? Number(p.contentPerOrderUnit || 0) === content
      : String(p.flavor || "").trim().toLowerCase() === fl.toLowerCase())
  );
  if (exactDuplicate) {
    alert("Dit product met dezelfde smaak, soort of inhoud bestaat al. Pas de kopie eerst aan.");
    return;
  }
  const maxOrder = Math.max(0, ...data.products.map(p => Number(p.order || 0)));
  data.products.push({
    id: crypto.randomUUID(), mode, name, flavor: fl,
    consumptionUnit: cu, orderUnit: ou, contentPerOrderUnit: content, looseUnitsAllowed: allowLoose,
    stockFull: sf, stockLoose: sl, alreadyOrdered: ao, orderedDate: ao > 0 ? todayLocalIso() : "", generalTarget: mode === "general" ? min : 0,
    minimumStock: min, order: maxOrder + 1, expiryDate: "", lastExpiryCheck: "", active: mode === "general" ? newGeneralActive.checked : true, phaseOut: false, externalProduct: externalProduct.checked,
    externalQuantity: externalProduct.checked ? Math.max(0, Number(externalQuantity.value) || 0) : 0,
    showOnWeeklyList: showOnWeeklyList.checked
  });
  productName.value = ""; flavor.value = ""; contentPerOrderUnit.value = "";
  looseUnitsAllowed.value = "yes"; stockFull.value = "0"; stockLoose.value = "0";
  alreadyOrdered.value = "0"; minimumStock.value = "0"; externalQuantity.value = "0"; externalProduct.checked = false; newGeneralActive.checked = true; syncExternalNewForm(); syncNewLooseField(); saveData();
  if (productFormCardV316) productFormCardV316.classList.add("hidden");
  if (showProductFormBtn) showProductFormBtn.focus();
};

// Product wijzigen: alleen bij Algemeen is handmatige minimumvoorraad relevant.
const editStockV304 = editStock;
editStock = function(id) {
  editStockV304(id);
  const p = data.products.find(x => x.id === id);
  if (!p) return;
  editMinimumStock.closest(".field").classList.toggle("hidden", p.mode !== "general");
  productEditTitle.textContent = `${labelProduct(p)} wijzigen`;
};

deleteProductFromModal.onclick = () => {
  if (!editingProductId) return;
  const id = editingProductId;
  closeProductEdit();
  deleteProduct(id);
};

// Geen productgroep-knoppen meer nodig; de tabnavigatie blijft het dagelijkse werkproces volgen.
usageTabBtn.innerHTML = '<span class="nav-icon">♙</span><span>Kamers</span>';

// V3.1.6 — formulieren standaard dicht; openen via compacte toevoegen-knop.
const showRoomFormBtn = document.getElementById("showRoomForm");
const cancelRoomAddBtn = document.getElementById("cancelRoomAdd");
const showProductFormBtn = document.getElementById("showProductForm");
const cancelProductAddBtn = document.getElementById("cancelProductAdd");
const roomFormCardV316 = document.getElementById("roomFormCard");
const productFormCardV316 = document.getElementById("productFormCard");

function openAddForm(card, firstField){
  if (!card) return;
  card.classList.remove("hidden");
  requestAnimationFrame(() => {
    card.scrollIntoView({behavior:"smooth", block:"start"});
    if (firstField && typeof firstField.focus === "function") firstField.focus({preventScroll:true});
  });
}
function closeAddForm(card){
  if (card) card.classList.add("hidden");
}
function resetRoomAddForm(){
  roomFormCardV316?.querySelector("h2") && (roomFormCardV316.querySelector("h2").textContent = "Voeding aan kamer toevoegen");
  room.value = "";
  unit.value = "";
  roomType.value = "";
  roomProduct.innerHTML = '<option value="">Kies eerst soort voeding</option>';
  dailyAmount.value = "";
  dailyUnit.value = "";
  scheduleTimes.value = "";
  scheduleAmount.value = "";
  scheduleDays.value = ALL_DAYS;
  scheduleChoice.value = "fixed";
  scheduleNote.value = "";
  scheduleShowOnPdf.checked = true;
  roomFlavorChoices.innerHTML = "";
  roomFlavorChoices.classList.add("hidden");
  scheduleEntryDrafts.add.clear();
  syncChipPicker("add", "", ALL_DAYS);
  syncScheduleEntryEditor("add");
}
function resetProductAddForm(){
  productFormCardV316?.querySelector("h2") && (productFormCardV316.querySelector("h2").textContent = "Product toevoegen");
  productType.value = "drink";
  productName.value = "";
  flavor.value = "";
  consumptionUnit.value = "";
  orderUnit.selectedIndex = 0;
  contentPerOrderUnit.value = "";
  looseUnitsAllowed.value = "yes";
  if (typeof externalProduct !== "undefined") externalProduct.checked = false;
  if (typeof showOnWeeklyList !== "undefined") showOnWeeklyList.checked = true;
  if (typeof productMemo !== "undefined") productMemo.value = "";
  syncProductTypeFields();
}
if (showRoomFormBtn) showRoomFormBtn.onclick = () => { resetRoomAddForm(); openAddForm(roomFormCardV316, room); };
if (cancelRoomAddBtn) cancelRoomAddBtn.onclick = () => closeAddForm(roomFormCardV316);
if (showProductFormBtn) showProductFormBtn.onclick = () => { resetProductAddForm(); openAddForm(productFormCardV316, productName); };
if (cancelProductAddBtn) cancelProductAddBtn.onclick = () => closeAddForm(productFormCardV316);

function copyRoom(id){
  const source=data.rooms.find(r=>r.id===id);
  if(!source) return;
  resetRoomAddForm();
  roomFormCardV316.querySelector("h2").textContent = "Gekopieerde voeding toevoegen";
  room.value=source.room || "";
  unit.value=source.unit || "";
  roomType.value=source.mode || "drink";
  currentMode=roomType.value;
  renderProductOptionsCombined();
  roomProduct.value=roomOptionValue(source.productName || "");
  setRoomUnitFromProduct(roomProduct,dailyUnit);
  renderFlavorChoices(roomProduct,roomFlavorChoices,source.selectedProductIds || [],source.allFlavors === true,source.dislikedProductIds || []);
  dailyAmount.value=source.dailyAmount || "";
  scheduleAmount.value=source.scheduleAmount || "";
  scheduleDays.value=normalizeDays(source.scheduleDays);
  scheduleChoice.value=source.scheduleChoice || "fixed";
  scheduleTimes.value="";
  scheduleNote.value="";
  scheduleEntryDrafts.add.clear();
  scheduleShowOnPdf.checked=source.showOnPdf !== false;
  syncChipPicker("add","",scheduleDays.value);
  syncScheduleEntryEditor("add");
  openAddForm(roomFormCardV316,scheduleAmount);
}

function copyProduct(id){
  const source=data.products.find(p=>p.id===id);
  if(!source) return;
  resetProductAddForm();
  productFormCardV316.querySelector("h2").textContent = "Gekopieerd product toevoegen";
  productType.value=source.mode || "drink";
  syncProductTypeFields();
  productName.value=source.name || "";
  flavor.value="";
  consumptionUnit.value=source.consumptionUnit || "";
  orderUnit.value=source.orderUnit || "flesje";
  contentPerOrderUnit.value=source.contentPerOrderUnit || 1;
  looseUnitsAllowed.value=source.looseUnitsAllowed === false ? "no" : "yes";
  stockFull.value="0";stockLoose.value="0";alreadyOrdered.value="0";
  minimumStock.value=source.minimumStock || 0;
  externalProduct.checked=source.externalProduct === true;
  externalQuantity.value="0";
  showOnWeeklyList.checked=source.showOnWeeklyList !== false;
  newGeneralActive.checked=activeProduct(source);
  syncExternalNewForm();syncProductTypeFields();syncNewLooseField();
  openAddForm(productFormCardV316,flavorField.classList.contains("hidden") ? contentPerOrderUnit : flavor);
}

renderAll();


// V3.3.1-test4 — snelle tijd/dagkeuze + echte PDF per unit, direct deelbaar op telefoon.
const ALL_DAYS = "Ma,Di,Wo,Do,Vr,Za,Zo";
function normalizeDays(v){
  if(!v || v==="Alle dagen") return ALL_DAYS;
  if(v==="Maandag t/m vrijdag") return "Ma,Di,Wo,Do,Vr";
  if(v==="Weekend") return "Za,Zo";
  return v;
}
function setupChipPicker(prefix){
  const isEdit=prefix==="edit";
  const timeBox=document.getElementById(isEdit?"editScheduleTimeChips":"scheduleTimeChips");
  const timeInput=document.getElementById(isEdit?"editScheduleTimes":"scheduleTimes");
  const other=document.getElementById(isEdit?"editScheduleOtherTime":"scheduleOtherTime");
  const dayBox=document.getElementById(isEdit?"editScheduleDayChips":"scheduleDayChips");
  const dayInput=document.getElementById(isEdit?"editScheduleDays":"scheduleDays");
  function writeTimes(){
    const vals=[...timeBox.querySelectorAll("[data-time].selected")].map(b=>b.dataset.time);
    if(other.value) vals.push(other.value);
    timeInput.value=[...new Set(vals)].sort().join(", ");
    syncScheduleEntryEditor(prefix);
  }
  timeBox.querySelectorAll("[data-time]").forEach(b=>b.onclick=()=>{b.classList.toggle("selected");writeTimes();});
  timeBox.querySelector(".other-time").onclick=()=>{other.classList.toggle("hidden"); if(!other.classList.contains("hidden")) other.focus();};
  other.onchange=writeTimes;
  dayBox.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{
    b.classList.toggle("selected");
    dayInput.value=[...dayBox.querySelectorAll("[data-day].selected")].map(x=>x.dataset.day).join(",");
    updateCalculatedDailyAmount(prefix);
  });
}
function syncChipPicker(prefix,times,days){
  const isEdit=prefix==="edit";
  const timeBox=document.getElementById(isEdit?"editScheduleTimeChips":"scheduleTimeChips");
  const other=document.getElementById(isEdit?"editScheduleOtherTime":"scheduleOtherTime");
  const dayBox=document.getElementById(isEdit?"editScheduleDayChips":"scheduleDayChips");
  if(!timeBox||!dayBox) return;
  const vals=normalizedTimes(times); const fixed=["08:00","10:00","12:30","15:00","17:00"];
  timeBox.querySelectorAll("[data-time]").forEach(b=>b.classList.toggle("selected",vals.includes(b.dataset.time)));
  const custom=vals.find(x=>!fixed.includes(x))||""; other.value=custom; other.classList.toggle("hidden",!custom);
  const selected=normalizeDays(days).split(",").filter(Boolean);
  dayBox.querySelectorAll("[data-day]").forEach(b=>b.classList.toggle("selected",selected.includes(b.dataset.day)));
}
setupChipPicker("add"); setupChipPicker("edit");
scheduleAmount.addEventListener("input",()=>updateCalculatedDailyAmount("add"));
editScheduleAmount.addEventListener("input",()=>updateCalculatedDailyAmount("edit"));

function scheduleFlavorText(r){
  if (r.mode !== "drink") return "";
  const activeFlavors=familyProducts(r.productName,"drink").map(p=>p.flavor).filter(Boolean);
  if(activeFlavors.length===1) return activeFlavors[0];
  if (r.allFlavors) return "Alle smaken";
  const ids = r.selectedProductIds || [];
  return ids.map(id => data.products.find(p => p.id === id)?.flavor).filter(Boolean).join("/");
}
function normalizedTimes(v){return String(v||"").split(/[,;]+/).map(x=>x.trim().replace(".",":")).filter(Boolean);}
const scheduleEntryDrafts={add:new Map(),edit:new Map()};
function roomScheduleEntries(r){
  if(Array.isArray(r?.scheduleEntries) && r.scheduleEntries.length){
    return r.scheduleEntries.map(e=>({time:String(e.time||""),amount:Number(e.amount||0),note:String(e.note||"")})).filter(e=>e.time);
  }
  const times=normalizedTimes(r?.scheduleTimes);
  if(!times.length) return [];
  const amount=Number(r?.scheduleAmount||0)>0 ? Number(r.scheduleAmount) : Number(r?.dailyAmount||0)/times.length;
  return times.map(time=>({time,amount,note:String(r?.scheduleNote||"")}));
}
function scheduleEls(prefix){
  const edit=prefix==="edit";
  return {
    times:document.getElementById(edit?"editScheduleTimes":"scheduleTimes"),
    editor:document.getElementById(edit?"editScheduleEntriesEditor":"scheduleEntriesEditor"),
    amount:document.getElementById(edit?"editScheduleAmount":"scheduleAmount"),
    note:document.getElementById(edit?"editScheduleNote":"scheduleNote"),
    amountField:document.getElementById(edit?"editScheduleAmountField":"scheduleAmountField"),
    noteField:document.getElementById(edit?"editScheduleNoteField":"scheduleNoteField"),
    daily:document.getElementById(edit?"editDailyAmount":"dailyAmount"),
    dailyLabel:document.getElementById(edit?"editDailyAmountLabel":"dailyAmountLabel"),
    dailyHelp:document.getElementById(edit?"editDailyAmountHelp":"dailyAmountHelp"),
    days:document.getElementById(edit?"editScheduleDays":"scheduleDays")
  };
}
function captureScheduleDrafts(prefix){
  const {editor}=scheduleEls(prefix),map=scheduleEntryDrafts[prefix];
  editor?.querySelectorAll(".schedule-entry-row").forEach(row=>map.set(row.dataset.time,{time:row.dataset.time,amount:Number(row.querySelector(".schedule-entry-amount").value||0),note:row.querySelector(".schedule-entry-note").value}));
}
function getScheduleEntries(prefix){
  const el=scheduleEls(prefix),times=normalizedTimes(el.times.value);
  if(!times.length) return [];
  if(times.length===1) return [{time:times[0],amount:Number(el.amount.value||0),note:el.note.value.trim()}];
  captureScheduleDrafts(prefix);
  return times.map(time=>scheduleEntryDrafts[prefix].get(time)||{time,amount:0,note:""});
}
function updateCalculatedDailyAmount(prefix){
  const el=scheduleEls(prefix),entries=getScheduleEntries(prefix);
  if(!entries.length){el.daily.readOnly=false;el.dailyLabel.textContent="Verbruik per dag";el.dailyHelp.textContent="Geen tijdstip gekozen: vul het dagverbruik handmatig in.";return;}
  const selectedDays=normalizeDays(el.days.value).split(",").filter(Boolean).length||7;
  const perGiftDay=entries.reduce((sum,e)=>sum+Number(e.amount||0),0);
  const average=perGiftDay*selectedDays/7;
  el.daily.value=average>0?String(Math.round(average*100)/100):"";
  el.daily.readOnly=true;el.dailyLabel.textContent="Berekend gemiddeld verbruik per dag";
  el.dailyHelp.textContent=selectedDays===7?`Automatisch berekend: ${fmt(perGiftDay)} per dag.`:`Automatisch berekend over ${selectedDays} dagen per week: gemiddeld ${fmt(average)} per dag.`;
}
function syncScheduleEntryEditor(prefix){
  const el=scheduleEls(prefix),times=normalizedTimes(el.times.value),map=scheduleEntryDrafts[prefix];
  captureScheduleDrafts(prefix);
  if(times.length<=1){
    el.editor.classList.add("hidden");el.amountField.classList.remove("hidden");el.noteField.classList.remove("hidden");
    if(times.length===1 && map.has(times[0])){const d=map.get(times[0]);el.amount.value=d.amount||"";el.note.value=d.note||"";}
    updateCalculatedDailyAmount(prefix);return;
  }
  const defaultAmount=Number(el.amount.value||0),defaultNote=el.note.value.trim();
  times.forEach((time,i)=>{if(!map.has(time))map.set(time,{time,amount:defaultAmount,note:i===0?defaultNote:""});});
  el.amountField.classList.add("hidden");el.noteField.classList.add("hidden");el.editor.classList.remove("hidden");
  el.editor.innerHTML=times.map(time=>{const d=map.get(time);return `<div class="schedule-entry-row" data-time="${esc(time)}"><strong>${esc(time)} uur</strong><label>Hoeveelheid per keer<input class="schedule-entry-amount" type="number" min="0" step="0.1" value="${d.amount||""}"></label><label>Extra informatie<input class="schedule-entry-note" value="${esc(d.note||"")}" placeholder="Bijv. in vla"></label></div>`;}).join("");
  el.editor.querySelectorAll("input").forEach(input=>input.addEventListener("input",()=>{captureScheduleDrafts(prefix);updateCalculatedDailyAmount(prefix);}));
  updateCalculatedDailyAmount(prefix);
}
function dayText(r){const d=normalizeDays(r.scheduleDays); return d===ALL_DAYS ? "" : d.split(",").join(" ");}
function amountText(r){
  // Op de aftekenlijst tonen we altijd wat er op DIT tijdstip gegeven moet worden.
  // Als "hoeveelheid per keer" is ingevuld, gebruiken we die waarde.
  // Anders verdelen we het dagverbruik over het aantal ingestelde tijdstippen.
  const explicitPerTime = Number(r.scheduleAmount || 0);
  const timesCount = Math.max(1, normalizedTimes(r.scheduleTimes).length);
  const amountPerTime = explicitPerTime > 0 ? explicitPerTime : Number(r.dailyAmount || 0) / timesCount;
  return withUnit(amountPerTime, r.dailyUnit);
}
function productWithFlavor(r){
  const f=scheduleFlavorText(r);
  const oneActiveFlavor=r.mode === "drink" && familyProducts(r.productName,"drink").filter(p=>p.flavor).length===1;
  if(r.mode === "drink" && !oneActiveFlavor && !r.allFlavors && (r.selectedProductIds || []).length && f){
    return `${r.productName} — VOORKEURSSMAAK: ${f.toUpperCase()}`;
  }
  if(r.mode === "drink" && r.allFlavors && !oneActiveFlavor) return `${r.productName} — SMAAK: VRIJE KEUZE`;
  return `${r.productName}${f?` — SMAAK: ${f.toUpperCase()}`:""}`;
}
function pdfProductLine(r){
  const flavor=scheduleFlavorText(r);
  if(r.mode !== "drink" || !flavor) return r.productName;
  const oneActiveFlavor=familyProducts(r.productName,"drink").filter(p=>p.flavor).length===1;
  if(oneActiveFlavor) return `${r.productName} (${flavor.toUpperCase()})`;
  if(r.allFlavors) return `${r.productName} (ALLE SMAKEN)`;
  return `__FLAVOR__${r.productName}||| · VOORKEUR: ${flavor.toUpperCase()}`;
}
function pdfVisibleLine(line){
  if(!line.startsWith("__FLAVOR__")) return line;
  return line.slice(10).split("|||").join("");
}
function drawPdfFlavorLine(doc,line,x,ty,maxWidth,lineH){
  const [product,suffix=""]=line.slice(10).split("|||");
  doc.setFont("helvetica","normal");doc.setTextColor(20,24,32);
  const productLines=doc.splitTextToSize(product,maxWidth);
  productLines.forEach(part=>{doc.text(part,x,ty);ty+=lineH;});
  const lastProduct=productLines.at(-1)||"",lastY=ty-lineH,lastWidth=doc.getTextWidth(lastProduct);
  doc.setFont("helvetica","bold");doc.setTextColor(116,72,145);
  if(lastWidth+doc.getTextWidth(suffix)<=maxWidth){
    doc.text(suffix,x+lastWidth,lastY);
  }else{
    doc.splitTextToSize(suffix.trim(),maxWidth).forEach(part=>{doc.text(part,x,ty);ty+=lineH;});
  }
  // Paars is uitsluitend voor het voorkeuraccent. Voorkom dat de kleur
  // doorloopt naar een volgend product, ALLE SMAKEN, OF of een opmerking.
  doc.setTextColor(45,45,55);doc.setFont("helvetica","normal");
  return ty;
}
function closePdfUnitModal(){document.getElementById("pdfUnitModal")?.classList.add("hidden");document.body.style.overflow="";}
function localISODate(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`;}
function openPdfUnitModal(){
  const box=document.getElementById("pdfWeekChoices");
  if(box){
    box.innerHTML="";
    const now=new Date();
    for(let i=0;i<5;i++){
      const d=new Date(now);d.setDate(now.getDate()+i*7);
      const wi=weekInfo(localISODate(d));
      const monday=localISODate(wi.dates[0]);
      const sunday=localISODate(wi.dates[6]);
      const option=document.createElement("button");
      option.type="button";
      option.className="pdf-week-option"+(i===0?" selected":"");
      option.dataset.value=monday;
      option.setAttribute("aria-pressed",i===0?"true":"false");
      option.innerHTML=`<span class="pdf-week-box" aria-hidden="true">${i===0?"✓":""}</span><span><strong>Week ${wi.week}</strong><small>${monday.split('-').reverse().join('-')} t/m ${sunday.split('-').reverse().join('-')}</small></span>`;
      option.addEventListener("click",()=>{
        const selected=option.classList.toggle("selected");
        option.setAttribute("aria-pressed",selected?"true":"false");
        option.querySelector(".pdf-week-box").textContent=selected?"✓":"";
      });
      box.appendChild(option);
    }
  }
  const typeInputs=[...document.querySelectorAll(".pdf-type-input")];
  const syncPdfTypes=()=>{
    const checkSelected=!!document.querySelector('.pdf-type-input[value="check"]:checked');
    document.getElementById("pdfWeekSection")?.classList.toggle("hidden",!checkSelected);
  };
  typeInputs.forEach(input=>{input.onchange=syncPdfTypes;});
  syncPdfTypes();
  document.getElementById("pdfUnitModal")?.classList.remove("hidden");document.body.style.overflow="hidden";
}
document.getElementById("printDaySchedule")?.addEventListener("click",openPdfUnitModal);

function buildUnitRows(unit){
  const rows=[];
  data.rooms.filter(r=>String(r.unit)===String(unit) && r.mode==="drink" && r.scheduleTimes && r.showOnPdf !== false).forEach(r=>roomScheduleEntries(r).forEach(entry=>{
    const scheduled={...r,scheduleTimes:entry.time,scheduleAmount:Number(entry.amount||0),scheduleNote:entry.note||""};
    rows.push({time:entry.time,r:scheduled});
  }));
  rows.sort((a,b)=>a.time.localeCompare(b.time)||String(a.r.room).localeCompare(String(b.r.room),undefined,{numeric:true}));
  const result=[],used=new Set();
  rows.forEach((x,i)=>{
    if(used.has(i)) return;
    if(x.r.scheduleChoice==="or"){
      const group=rows.map((y,j)=>({y,j})).filter(z=>!used.has(z.j)&&z.y.time===x.time&&z.y.r.scheduleChoice==="or"&&String(z.y.r.room)===String(x.r.room));
      group.forEach(z=>used.add(z.j));
      if(group.length>1){result.push({time:x.time,room:x.r.room,choice:true,items:group.map(z=>z.y.r)});return;}
    }
    used.add(i);result.push({time:x.time,room:x.r.room,choice:false,items:[x.r]});
  });
  return result;
}
function weekInfo(value){
  const base=value?new Date(value+"T12:00:00"):new Date();
  const dow=(base.getDay()+6)%7; const mon=new Date(base); mon.setDate(base.getDate()-dow);
  const dates=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
  const th=new Date(mon); th.setDate(mon.getDate()+3); const jan4=new Date(th.getFullYear(),0,4); const jan4dow=(jan4.getDay()+6)%7; const firstThu=new Date(jan4); firstThu.setDate(jan4.getDate()+(3-jan4dow));
  const week=1+Math.round((th-firstThu)/604800000);
  return {dates,week};
}
function activeDaySet(r){return new Set(normalizeDays(r.scheduleDays).split(",").filter(Boolean));}
function rowActiveOn(row,idx){
  const key=["Ma","Di","Wo","Do","Vr","Za","Zo"][idx];
  return row.items.some(r=>activeDaySet(r).has(key));
}
function rowDetailLines(row){
  if(row.choice){
    const out=[`KIES 1 VAN DE ${row.items.length}`];
    row.items.forEach((r,i)=>{
      out.push(pdfProductLine(r));
      if(r.scheduleNote) out.push(`__EXTRA__${r.scheduleNote}`);
      if(i<row.items.length-1) out.push("__OF__");
    });
    return out;
  }
  const r=row.items[0];
  return [pdfProductLine(r)].concat(r.scheduleNote?[`__EXTRA__${r.scheduleNote}`]:[]);
}
function rowAmountLines(row){
  if(row.choice){
    const out=[""];
    row.items.forEach((r,i)=>{
      out.push(amountText(r));
      if(r.scheduleNote) out.push("");
      if(i<row.items.length-1) out.push("");
    });
    return out;
  }
  const r=row.items[0];
  // Een gewone hoeveelheid is één zelfstandig tekstblok. De opmerking in de
  // productkolom mag de hoeveelheid niet kunstmatig naar boven schuiven.
  return [amountText(r)];
}
async function createSchedulePdf(unit,dateValue){
  const rows=buildUnitRows(unit);
  if(!rows.length){alert(`Voor Unit ${unit} zijn nog geen bijvoedingen met tijdstip ingevuld.`);return;}
  if(!window.jspdf?.jsPDF){alert("De PDF-module kon niet worden geladen. Controleer de internetverbinding en probeer opnieuw.");return;}
  const {dates,week}=weekInfo(dateValue), dayNames=["Ma","Di","Wo","Do","Vr","Za","Zo"];
  const {jsPDF}=window.jspdf;
  // PDF altijd expliciet A4 PORTRAIT maken.
  const doc=new jsPDF({orientation:"p",unit:"mm",format:"a4",compress:true});
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),ml=7,mr=7,top=8,bottom=7, tableW=W-ml-mr;
  // Printervriendelijk: de hele PDF heeft een volledig witte achtergrond.
  doc.setFillColor(255,255,255);doc.rect(0,0,W,H,"F");
  // Portrait: compacte kamer- en dagkolommen, met zoveel mogelijk ruimte voor de voedingsinformatie.
  const roomW=15,amountW=19,dayW=13,detailW=tableW-roomW-amountW-7*dayW;
  const fmtDate=d=>`${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}`;
  const longDate=d=>`${d.getDate()}-${d.getMonth()+1}-${d.getFullYear()}`;
  // Bepaal compacte schaal zodat de volledige week altijd op één A4 blijft.
  const groups=[]; let last=""; rows.forEach(row=>{if(row.time!==last){groups.push({time:row.time,rows:[]});last=row.time;}groups[groups.length-1].rows.push(row);});
  let fs=7.2, lineH=3.15, headerH=9, timeH=6, groupGap=2.4;
  const wrappedLineCount=(row)=>{
    doc.setFontSize(fs);
    return rowDetailLines(row).reduce((count,line)=>count+Math.max(1,doc.splitTextToSize(pdfVisibleLine(line.replace(/^__EXTRA__/,"").replace(/^__OF__$/,"OF")),detailW-3).length),0);
  };
  const rowHeight=(row)=>Math.max(7,Math.max(wrappedLineCount(row),rowAmountLines(row).length)*lineH+2.8);
  const calcHeight=()=>top+13+headerH+groups.reduce((sum,g,gi)=>sum+(gi?groupGap:0)+timeH+g.rows.reduce((s2,r)=>s2+rowHeight(r),0),0)+bottom;
  while(calcHeight()>H && fs>5.2){fs-=0.25;lineH=Math.max(2.45,lineH-.10);headerH=Math.max(7.5,headerH-.15);timeH=Math.max(5,timeH-.1);groupGap=Math.max(1.2,groupGap-.1);}
  let y=top;
  doc.setTextColor(45,45,55);doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(`Bijvoeding aftekenlijst - Unit ${unit}`,ml,y+4);y+=6;
  doc.setFont("helvetica","normal");doc.setFontSize(8);doc.text(`Week ${week} - ${longDate(dates[0])} t/m ${longDate(dates[6])}`,ml,y+3);y+=7;
  const drawHeader=()=>{
    doc.setFillColor(255,255,255);doc.rect(ml,y,tableW,headerH,"F");doc.setDrawColor(195,195,205);doc.rect(ml,y,tableW,headerH);
    let x=ml; const cells=[roomW,amountW,detailW,...Array(7).fill(dayW)]; cells.slice(0,-1).forEach(w=>{x+=w;doc.line(x,y,x,y+headerH);});
    const headerBaseline=y+headerH/2+0.9;
    doc.setFont("helvetica","bold");doc.setFontSize(fs);doc.setTextColor(45,45,55);doc.text("Kamer",ml+1.5,headerBaseline);doc.text("Hoeveelheid",ml+roomW+amountW/2,headerBaseline,{align:"center"});doc.text("Voeding / smaak / opmerking",ml+roomW+amountW+1.5,headerBaseline);
    dates.forEach((d,i)=>{doc.setTextColor(45,45,55);const cx=ml+roomW+amountW+detailW+i*dayW+dayW/2,dayTop=y+headerH/2-1.1;doc.text(dayNames[i],cx,dayTop,{align:"center"});doc.setFont("helvetica","normal");doc.text(fmtDate(d),cx,dayTop+3.1,{align:"center"});doc.setFont("helvetica","bold");}); y+=headerH;
  };
  drawHeader();
  groups.forEach((g,gi)=>{
    if(gi){
      y+=groupGap/2;
      doc.setDrawColor(210,210,215);doc.setLineWidth(0.6);doc.line(ml,y,ml+tableW,y);
      y+=groupGap/2;doc.setLineWidth(0.2);
    }
    doc.setFillColor(255,255,255);doc.rect(ml,y,tableW,timeH,"F");doc.setDrawColor(205,205,215);doc.rect(ml,y,tableW,timeH);doc.setTextColor(46,115,67);doc.setFont("helvetica","bold");doc.setFontSize(fs+1);doc.text(`${g.time} uur`,ml+2,y+timeH/2+1);y+=timeH;
    g.rows.forEach(row=>{
      const lines=rowDetailLines(row); const rh=rowHeight(row); let x=ml;
      doc.setFillColor(255,255,255);doc.rect(ml,y,tableW,rh,"F");
      doc.setDrawColor(205,205,215);doc.rect(ml,y,tableW,rh);[roomW,amountW,detailW,...Array(6).fill(dayW)].forEach(w=>{x+=w;doc.line(x,y,x,y+rh);});
      doc.setTextColor(45,45,55);doc.setFont("helvetica","bold");doc.setFontSize(fs);doc.text(String(row.room),ml+roomW/2,y+rh/2+lineH*0.28,{align:"center"});
      const amountLines=rowAmountLines(row);
      const amountTextHeight=Math.max(1,amountLines.length)*lineH;
      let aty=y+(rh-amountTextHeight)/2+lineH*0.78;
      amountLines.forEach((line)=>{
        if(line){doc.setTextColor(45,45,55);doc.setFont("helvetica","bold");doc.text(line,ml+roomW+amountW/2,aty,{align:"center"});}
        aty+=lineH;
      });
      const detailWrappedCount=lines.reduce((count,line)=>{
        if(line==="__OF__") return count+1;
        const text=pdfVisibleLine(line.startsWith("__EXTRA__")?line.slice(9):line);
        return count+Math.max(1,doc.splitTextToSize(text,detailW-3).length);
      },0);
      const detailTextHeight=Math.max(1,detailWrappedCount)*lineH;
      let ty=y+(rh-detailTextHeight)/2+lineH*0.78; lines.forEach((line,i)=>{
        doc.setTextColor(45,45,55);
        if(line==="__OF__"){
          doc.setFont("helvetica","bold");
          const cy=ty-lineH*0.15, center=ml+roomW+amountW+detailW/2;
          doc.setDrawColor(90,90,100);doc.setLineWidth(0.25);
          doc.line(center-18,cy,center-6,cy);doc.line(center+6,cy,center+18,cy);
          doc.text("OF",center,ty,{align:"center"});ty+=lineH;
          return;
        }
        const isExtra=line.startsWith("__EXTRA__");
        const isFlavor=line.startsWith("__FLAVOR__");
        const text=isExtra?line.slice(9):line;
        const isChoiceTitle=row.choice&&i===0;
        if(isFlavor){
          ty=drawPdfFlavorLine(doc,line,ml+roomW+amountW+1.5,ty,detailW-3,lineH);
          return;
        }
        doc.setFont("helvetica",isExtra?"italic":(isChoiceTitle?"bold":"normal"));
        const wrapped=doc.splitTextToSize(text,detailW-3);
        wrapped.forEach(part=>{doc.text(part,isChoiceTitle?ml+roomW+amountW+detailW/2:ml+roomW+amountW+1.5,ty,isChoiceTitle?{align:"center"}:undefined);ty+=lineH;});
      });
      for(let i=0;i<7;i++){
        // Het hele dagvak is het aftekenvak. Geen extra checkbox tekenen.
        if(!rowActiveOn(row,i)){
          // Geen bijvoeding op deze dag: groot, dik rood kruis door vrijwel het hele dagvak.
          const left=ml+roomW+amountW+detailW+i*dayW;
          const padX=dayW*0.15, padY=rh*0.15;
          doc.setDrawColor(200,45,45);doc.setLineWidth(1.0);
          doc.line(left+padX,y+padY,left+dayW-padX,y+rh-padY);
          doc.line(left+dayW-padX,y+padY,left+padX,y+rh-padY);
          doc.setLineWidth(0.2);
        }
      }
      y+=rh;
    });
  });
  // Kleine versieaanduiding onderaan het printblad.
  doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(130,130,140);doc.text("Appversie: V3.3.55",W-mr,H-3.5,{align:"right"});
  const blob=doc.output("blob"); const filename=`Bijvoeding-Unit-${unit}-week-${week}.pdf`;
  return new File([blob],filename,{type:"application/pdf"});
}


async function createOverviewPdf(unit){
  const rows=buildUnitRows(unit);
  if(!rows.length){alert(`Voor Unit ${unit} zijn nog geen bijvoedingen met tijdstip ingevuld.`);return;}
  if(!window.jspdf?.jsPDF){alert("De PDF-module kon niet worden geladen. Controleer de internetverbinding en probeer opnieuw.");return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"p",unit:"mm",format:"a4",compress:true});
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),ml=11,mr=11,top=10,bottom=9,contentW=W-ml-mr;
  doc.setFillColor(255,255,255);doc.rect(0,0,W,H,"F");
  const groups=[];let last="";rows.forEach(row=>{if(row.time!==last){groups.push({time:row.time,rows:[]});last=row.time;}groups[groups.length-1].rows.push(row);});
  let fs=10,lineH=4.3,timeH=8,gap=5,roomW=18,amountW=25,headerH=7;
  const detailW=contentW-roomW-amountW;
  const overviewLines=row=>rowDetailLines(row);
  const rowHeight=row=>{doc.setFontSize(fs);let n=0;overviewLines(row).forEach(line=>{const txt=pdfVisibleLine(line.replace(/^__EXTRA__/,"").replace(/^__OF__$/,"OF"));n+=Math.max(1,doc.splitTextToSize(txt,detailW-5).length);});return Math.max(10,Math.max(n,rowAmountLines(row).length)*lineH+4);};
  const totalHeight=()=>top+12+headerH+groups.reduce((sum,g,gi)=>sum+(gi?gap:0)+timeH+g.rows.reduce((a,r)=>a+rowHeight(r),0),0)+bottom+5;
  while(totalHeight()>H && fs>7){fs-=0.25;lineH=Math.max(3.2,lineH-.12);timeH=Math.max(6.2,timeH-.1);gap=Math.max(2.8,gap-.15);}
  let y=top;doc.setTextColor(45,45,55);doc.setFont("helvetica","bold");doc.setFontSize(15);doc.text(`Bijvoeding overzicht - Unit ${unit}`,ml,y+5);y+=11;
  doc.setDrawColor(205,205,215);doc.setLineWidth(.2);doc.rect(ml,y,contentW,headerH);
  doc.line(ml+roomW,y,ml+roomW,y+headerH);doc.line(ml+roomW+amountW,y,ml+roomW+amountW,y+headerH);
  doc.setFont("helvetica","bold");doc.setFontSize(fs);doc.setTextColor(45,45,55);
  doc.text("Kamer",ml+roomW/2,y+4.8,{align:"center"});doc.text("Hoeveelheid",ml+roomW+amountW/2,y+4.8,{align:"center"});doc.text("Voeding / smaak / opmerking",ml+roomW+amountW+2,y+4.8);y+=headerH;
  groups.forEach((g,gi)=>{
    if(gi){y+=gap/2;doc.setDrawColor(190,195,198);doc.setLineWidth(.5);doc.line(ml,y,ml+contentW,y);y+=gap/2;}
    doc.setFont("helvetica","bold");doc.setFontSize(fs+1.5);doc.setTextColor(46,115,67);doc.text(`${g.time} uur`,ml,y+5.2);y+=timeH;
    g.rows.forEach(row=>{
      const rh=rowHeight(row);doc.setDrawColor(220,220,225);doc.setLineWidth(.2);doc.line(ml,y+rh,ml+contentW,y+rh);doc.line(ml+roomW,y,ml+roomW,y+rh);doc.line(ml+roomW+amountW,y,ml+roomW+amountW,y+rh);
      doc.setTextColor(45,45,55);doc.setFont("helvetica","bold");doc.setFontSize(fs);doc.text(String(row.room),ml+roomW/2,y+5,{align:"center"});
      const amountLines=rowAmountLines(row);let aty=y+4.5;
      amountLines.forEach(line=>{if(line){doc.setFont("helvetica","bold");doc.text(line,ml+roomW+amountW/2,aty,{align:"center"});}aty+=lineH;});
      let ty=y+4.5;const x=ml+roomW+amountW+2.5;
      overviewLines(row).forEach((line,i)=>{
        if(line==="__OF__"){
          const cy=ty-1.1,center=x+(detailW-5)/2;doc.setDrawColor(95,95,100);doc.setLineWidth(.25);doc.line(center-15,cy,center-5,cy);doc.line(center+5,cy,center+15,cy);doc.setFont("helvetica","bold");doc.text("OF",center,ty,{align:"center"});ty+=lineH;return;
        }
        const extra=line.startsWith("__EXTRA__"),flavor=line.startsWith("__FLAVOR__"),text=extra?line.slice(9):line,choiceTitle=row.choice&&i===0;
        if(flavor){
          ty=drawPdfFlavorLine(doc,line,x,ty,detailW-5,lineH);
          return;
        }
        doc.setFont("helvetica",extra?"italic":(choiceTitle?"bold":"normal"));
        const wrapped=doc.splitTextToSize(text,detailW-5);wrapped.forEach(part=>{doc.text(part,choiceTitle?x+(detailW-5)/2:x,ty,choiceTitle?{align:"center"}:undefined);ty+=lineH;});
      });
      y+=rh;
    });
  });
  doc.setFont("helvetica","normal");doc.setFontSize(6.5);doc.setTextColor(130,130,140);doc.text("Appversie: V3.3.55",W-mr,H-3.5,{align:"right"});
  const blob=doc.output("blob");return new File([blob],`Bijvoeding-Overzicht-Unit-${unit}.pdf`,{type:"application/pdf"});
}
async function mergeSchedulePdfsForUnit(unit, weekFiles, weekDates){
  if(weekFiles.length===1){
    // Ook bij één week een nette unit-bestandsnaam behouden.
    return weekFiles[0];
  }
  if(!window.PDFLib?.PDFDocument){
    alert("De PDF-bundelmodule kon niet worden geladen. Controleer de internetverbinding en probeer opnieuw.");
    return null;
  }
  const merged=await PDFLib.PDFDocument.create();
  for(const file of weekFiles){
    const source=await PDFLib.PDFDocument.load(await file.arrayBuffer());
    const pages=await merged.copyPages(source,source.getPageIndices());
    pages.forEach(page=>merged.addPage(page));
  }
  const bytes=await merged.save();
  const weekNumbers=weekDates.map(d=>weekInfo(d).week);
  const first=weekNumbers[0], last=weekNumbers[weekNumbers.length-1];
  const range=first===last?`week-${first}`:`week-${first}-tm-${last}`;
  return new File([bytes],`Bijvoeding-Unit-${unit}-${range}.pdf`,{type:"application/pdf"});
}

function weeklyQuantityRows(unit){
  const rooms = data.rooms.filter(r => {
    if (String(r.unit) !== String(unit) || r.mode !== "drink" || !r.scheduleTimes) return false;
    const candidates = familyProducts(r.productName, r.mode, true);
    const selectedIds = Array.isArray(r.selectedProductIds) ? r.selectedProductIds : [];
    const selected = r.allFlavors || !selectedIds.length
      ? candidates
      : candidates.filter(p => selectedIds.includes(p.id));
    return selected.some(p => p.showOnWeeklyList !== false);
  });
  const normal = new Map();
  const orGroups = new Map();
  for (const r of rooms){
    const days = normalizeDays(r.scheduleDays).split(",").filter(Boolean).length || 7;
    const weekly = roomScheduleEntries(r).reduce((sum,e)=>sum+Number(e.amount||0),0) * days;
    if (!(weekly > 0)) continue;
    const unitLabel = r.dailyUnit || "";
    if (r.scheduleChoice === "or"){
      const gkey = `${r.room}|${normalizeDays(r.scheduleDays)}|${normalizedTimes(r.scheduleTimes).join(",")}|${unitLabel}`;
      if (!orGroups.has(gkey)) orGroups.set(gkey, {room:r.room, amount:weekly, unit:unitLabel, options:[]});
      const g = orGroups.get(gkey);
      const lbl = productWithFlavor(r);
      if (!g.options.includes(lbl)) g.options.push(lbl);
      continue;
    }
    const label = productWithFlavor(r);
    const key = `${label}|${unitLabel}`;
    const cur = normal.get(key) || {label, amount:0, unit:unitLabel};
    cur.amount += weekly;
    normal.set(key, cur);
  }
  const rows = [...normal.values()].sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  for (const g of orGroups.values()){
    rows.push({label:`Kamer ${g.room} – OF-keuze: ${g.options.join(" / ")}`, amount:g.amount, unit:g.unit, choice:true});
  }
  return rows;
}

async function createWeeklyQuantitiesPdf(unit){
  const rows = weeklyQuantityRows(unit);
  if(!rows.length){alert(`Voor Unit ${unit} zijn geen weekhoeveelheden te berekenen.`);return;}
  if(!window.jspdf?.jsPDF){alert("De PDF-module kon niet worden geladen. Controleer de internetverbinding en probeer opnieuw.");return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"p",unit:"mm",format:"a4",compress:true});
  const W=210,H=297,ml=16,mr=16,tableW=W-ml-mr;
  let y=18;
  doc.setTextColor(45,45,55);doc.setFont("helvetica","bold");doc.setFontSize(15);
  doc.text(`Weekhoeveelheden bijvoeding - Unit ${unit}`,ml,y); y+=7;
  doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(100,100,110);
  doc.text("Benodigd voor één volledige week volgens het ingestelde kamerschema.",ml,y); y+=8;
  const qtyW=38, nameW=tableW-qtyW;
  doc.setFillColor(245,245,248);doc.rect(ml,y,tableW,8,"F");doc.setDrawColor(210,210,218);doc.rect(ml,y,tableW,8);
  doc.line(ml+nameW,y,ml+nameW,y+8);doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(45,45,55);
  doc.text("Voeding / smaak",ml+2,y+5.3);doc.text("Per week",ml+nameW+qtyW/2,y+5.3,{align:"center"});y+=8;
  doc.setFontSize(8.5);
  for(const row of rows){
    const lines=doc.splitTextToSize(row.label,nameW-4);
    const rh=Math.max(9,lines.length*4.2+4);
    if(y+rh>H-16){doc.addPage();y=18;}
    doc.setDrawColor(220,220,226);doc.rect(ml,y,tableW,rh);doc.line(ml+nameW,y,ml+nameW,y+rh);
    doc.setFont("helvetica",row.choice?"italic":"normal");doc.setTextColor(45,45,55);
    lines.forEach((line,i)=>doc.text(line,ml+2,y+5+i*4.2));
    doc.setFont("helvetica","bold");doc.text(withUnit(row.amount,row.unit),ml+nameW+qtyW/2,y+rh/2+1.5,{align:"center"});
    y+=rh;
  }
  doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(120,120,130);
  doc.text("OF-keuzes worden één keer als geplande gift geteld; de gekozen variant staat als alternatief vermeld.",ml,Math.min(H-9,y+6));
  doc.setFontSize(6.5);doc.text("Appversie: V3.3.55",W-mr,H-3.5,{align:"right"});
  const blob=doc.output("blob");return new File([blob],`Bijvoeding-Weekhoeveelheden-Unit-${unit}.pdf`,{type:"application/pdf"});
}

async function makeSelectedSchedules(){
  const units=[...document.querySelectorAll(".pdf-unit-check:checked")].map(x=>x.value);
  const types=[...document.querySelectorAll(".pdf-type-input:checked")].map(x=>x.value);
  const weeks=[...document.querySelectorAll(".pdf-week-option.selected")].map(x=>x.dataset.value);
  if(!units.length){alert("Selecteer minimaal één unit.");return;}
  if(!types.length){alert("Selecteer minimaal één soort PDF.");return;}
  if(types.includes("check")&&!weeks.length){alert("Selecteer minimaal één week voor de aftekenlijst.");return;}
  closePdfUnitModal();
  const files=[];
  if(types.includes("overview")){for(const unit of units){const f=await createOverviewPdf(unit);if(f)files.push(f);}}
  if(types.includes("weekly")){for(const unit of units){const f=await createWeeklyQuantitiesPdf(unit);if(f)files.push(f);}}
  if(types.includes("check")){
    // Aftekenlijsten per unit bundelen: alle geselecteerde weken komen als pagina's
    // achter elkaar in één PDF. Zo hoeft per unit maar één bestand geprint te worden.
    for(const unit of units){
      const weekFiles=[];
      for(const weekDate of weeks){
        const f=await createSchedulePdf(unit,weekDate);
        if(f) weekFiles.push(f);
      }
      if(weekFiles.length){
        const bundled=await mergeSchedulePdfsForUnit(unit,weekFiles,weeks);
        if(bundled) files.push(bundled);
      }
    }
  }
  if(!files.length){alert("Er konden geen PDF-bestanden worden gemaakt voor de gekozen selectie.");return;}
  try{
    const title=types.length>1?"Bijvoeding PDF-lijsten":(types[0]==="overview"?"Bijvoeding overzichten":types[0]==="weekly"?"Bijvoeding weekhoeveelheden":"Bijvoeding aftekenlijsten");
    if(navigator.share && (!navigator.canShare || navigator.canShare({files}))){await navigator.share({title,text:`Bijgevoegd ${files.length} PDF-bestand${files.length===1?"":"en"}.`,files});}
    else{for(const file of files){const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}alert(`${files.length} PDF-bestand${files.length===1?"":"en"} gemaakt. Voeg ze samen als bijlagen toe aan één e-mail.`);}
  }catch(e){if(e?.name!=="AbortError") alert("Delen lukte niet. Probeer de PDF-bestanden opnieuw te maken.");}
}



// V3.3.19 — volledige back-up maken en terugzetten.
(function setupBackupTools(){
  const makeBtn = document.getElementById("makeBackup");
  const restoreBtn = document.getElementById("restoreBackup");
  const fileInput = document.getElementById("backupFileInput");
  if (!makeBtn || !restoreBtn || !fileInput) return;

  function backupDateStamp(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  makeBtn.addEventListener("click", () => {
    try {
      const payload = {
        app: "Bij- & Sondevoeding",
        version: "V3.3.55",
        createdAt: new Date().toISOString(),
        storageKey: STORAGE_KEY,
        data: data
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bij-en-Sondevoeding-backup-${backupDateStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
      alert("Back-up maken is niet gelukt.");
    }
  });

  restoreBtn.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const restored = parsed && parsed.data ? parsed.data : parsed;
      if (!restored || !Array.isArray(restored.products) || !Array.isArray(restored.rooms) || typeof restored.settings !== "object") {
        throw new Error("Ongeldig back-upbestand");
      }
      const ok = confirm("Back-up terugzetten? De huidige gegevens op dit apparaat worden vervangen door de gegevens uit dit back-upbestand.");
      if (!ok) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
      data = loadData();
      renderAll();
      alert("Back-up is teruggezet.");
      document.querySelector('[data-tab="products"]')?.click();
      window.scrollTo({top:0, behavior:"smooth"});
    } catch (err) {
      console.error(err);
      alert("Dit back-upbestand kan niet worden teruggezet. Kies een geldig back-upbestand van deze app.");
    } finally {
      fileInput.value = "";
    }
  });
})();


// V3.3.19 — zoeken op product bij Voorraad en Bestellen.
(function setupProductSearch(){
  const countInput = document.getElementById("countSearch");
  const orderInput = document.getElementById("orderSearch");
  if (!countInput || !orderInput) return;

  const normalize = value => String(value || "")
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  function filterRenderedList(container, selector, query){
    const q = normalize(query);
    const cards = [...container.querySelectorAll(selector)];
    let shown = 0;
    cards.forEach(card => {
      const match = !q || normalize(card.textContent).includes(q);
      card.style.display = match ? "" : "none";
      if (match) shown++;
    });
    let empty = container.querySelector(".search-empty");
    if (q && cards.length && shown === 0) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "empty search-empty";
        empty.textContent = "Geen producten gevonden.";
        container.appendChild(empty);
      }
      empty.style.display = "";
    } else if (empty) {
      empty.style.display = "none";
    }
  }

  const baseRenderCounting = renderCounting;
  renderCounting = function(){
    baseRenderCounting();
    filterRenderedList(countList, ".count-card", countInput.value);
  };

  const baseRenderOrders = renderOrders;
  renderOrders = function(){
    baseRenderOrders();
    filterRenderedList(orderList, ".order-card", orderInput.value);
  };

  countInput.addEventListener("input", () => filterRenderedList(countList, ".count-card", countInput.value));
  orderInput.addEventListener("input", () => filterRenderedList(orderList, ".order-card", orderInput.value));
})();

// V3.3.53 - foto/screenshot-invoer koppelen.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initOrderScan); else initOrderScan();
