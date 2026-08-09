let data=loadData(),currentMode="drink";

function loadData(){
  try{
    const stored=localStorage.getItem(STORAGE_KEY);
    const d=stored?JSON.parse(stored):structuredClone(defaults);
    if(!d.settings)d.settings={drinkWeeks:3,sondeWeeks:3};
    if(!Array.isArray(d.products))d.products=[];
    if(!Array.isArray(d.rooms))d.rooms=[];
    d.products.forEach((p,i)=>{
      if(p.order==null)p.order=i+1;
      if(p.minimumStock==null)p.minimumStock=0;
    });
    if(!d.rooms.length){
      const f=(name,flavor,mode="drink")=>d.products.find(p=>p.mode===mode&&p.name===name&&p.flavor===flavor)?.id;
      d.rooms=[
        {id:crypto.randomUUID(),mode:"drink",room:"113",unit:"1",productId:f("Glucerna","Niet gespecificeerd"),dailyAmount:3,dailyUnit:"flesjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"207",unit:"2",productId:f("Ensure Two Cal","Niet gespecificeerd"),dailyAmount:3,dailyUnit:"flesjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"210",unit:"2",productId:f("Abound","Neutraal"),dailyAmount:1,dailyUnit:"zakjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"214",unit:"2",productId:f("Ensure Plus Advance","Niet gespecificeerd"),dailyAmount:1,dailyUnit:"flesjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"220",unit:"2",productId:f("Nutridrink Crème 2 kcal Protein","Niet gespecificeerd"),dailyAmount:1,dailyUnit:"bakjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"221",unit:"2",productId:f("Abound","Sinaasappel"),dailyAmount:1,dailyUnit:"zakjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"221",unit:"2",productId:f("Ensure Plus Advance","Niet gespecificeerd"),dailyAmount:1,dailyUnit:"flesjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"305",unit:"3",productId:f("Abound","Neutraal"),dailyAmount:2,dailyUnit:"zakjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"305",unit:"3",productId:f("Glucerna","Aardbei"),dailyAmount:1,dailyUnit:"flesjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"306",unit:"3",productId:f("Vruchtenkwark of vla","Niet gespecificeerd"),dailyAmount:1,dailyUnit:"bakjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"312",unit:"3",productId:f("Drinkyoghurt","Niet gespecificeerd"),dailyAmount:2,dailyUnit:"flesjes"},
        {id:crypto.randomUUID(),mode:"drink",room:"315",unit:"3",productId:f("Nutridrink Crème 2 kcal Protein","Niet gespecificeerd"),dailyAmount:1,dailyUnit:"bakjes"},
        {id:crypto.randomUUID(),mode:"sonde",room:"210",unit:"2",productId:f("Jevity 1.5","","sonde"),dailyAmount:1600,dailyUnit:"ml"}
      ]
    }
    return d
  }catch(e){return structuredClone(defaults)}
}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll()}
function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]))}
function fmt(n){return Number.isInteger(Number(n))?String(Number(n)):Number(n).toFixed(1).replace(".",",")}
function modeLabel(){return currentMode==="drink"?"Bijvoeding":currentMode==="sonde"?"Sondevoeding":"Algemene voorraad"}
function targetWeeks(){return currentMode==="drink"?data.settings.drinkWeeks:data.settings.sondeWeeks}
function productsForMode(){return data.products.filter(p=>p.mode===currentMode).sort((a,b)=>a.order-b.order)}
function roomsForMode(){return data.rooms.filter(r=>r.mode===currentMode)}
function labelProduct(p){return p.flavor?`${p.name} · ${p.flavor}`:p.name}
function plural(unit,n){
  const m={flesje:"flesjes",bakje:"bakjes",fles:"flessen",doos:"dozen",pot:"potten",pak:"pakken"};
  return n===1?unit:(m[unit]||unit+"en")
}
function weeklyUsage(pid){return data.rooms.filter(r=>r.productId===pid).reduce((s,r)=>s+Number(r.dailyAmount||0)*7,0)}
function stockUnits(p){return Number(p.stockFull||0)*Number(p.contentPerOrderUnit||1)+Number(p.stockLoose||0)}
function orderedUnits(p){return Number(p.alreadyOrdered||0)*Number(p.contentPerOrderUnit||1)}
function stockPackages(p){return Number(p.stockFull||0)+(Number(p.stockLoose||0)/Number(p.contentPerOrderUnit||1))}
function belowMinimum(p){return stockPackages(p)<Number(p.minimumStock||0)}
function advice(p){
  const weekly=weeklyUsage(p.id);
  const usageTarget=currentMode==="general"
    ? Number(p.generalTarget||0)
    : weekly*targetWeeks();

  const minimumTarget=Number(p.minimumStock||0)*Number(p.contentPerOrderUnit||1);

  // De hoogste grens geldt:
  // - gewenste voorraad op basis van verbruik of handmatige doelvoorraad
  // - minimumvoorraad per product
  const needed=Math.max(usageTarget,minimumTarget);

  const available=stockUnits(p)+orderedUnits(p);
  const shortage=Math.max(0,needed-available);
  const orderUnits=Math.ceil(shortage/Number(p.contentPerOrderUnit||1));

  return {weekly,usageTarget,minimumTarget,needed,available,orderUnits}
}
function renderProductOptions(){
  const opts=productsForMode().map(p=>`<option value="${p.id}">${esc(labelProduct(p))}</option>`).join("");
  roomProduct.innerHTML=opts||`<option value="">Nog geen product</option>`;
  generalProduct.innerHTML=opts||`<option value="">Nog geen artikel</option>`
}
function renderCounting(){
  const ps=productsForMode();
  countList.innerHTML=ps.length?ps.map(p=>{
    const loose=p.orderUnit==="doos";
    return `<div class="item count-card">
      <strong>${esc(labelProduct(p))}</strong><br>
      <span class="muted">Voorraad in ${esc(plural(p.orderUnit,2))}</span>
      ${belowMinimum(p)?`<div class="status-danger" style="margin-top:6px">Onder minimumvoorraad</div>`:""}
      <div class="counter-wrap">
        <button class="counter-btn" onclick="changeStock('${p.id}',-1)">−</button>
        <div class="counter-value">${fmt(p.stockFull)} ${esc(plural(p.orderUnit,p.stockFull))}</div>
        <button class="counter-btn" onclick="changeStock('${p.id}',1)">+</button>
      </div>
      ${loose?`<div style="margin-top:12px"><span class="muted">Losse zakjes</span><div class="counter-wrap"><button class="counter-btn" onclick="changeLoose('${p.id}',-1)">−</button><div class="counter-value">${fmt(p.stockLoose)} zakjes</div><button class="counter-btn" onclick="changeLoose('${p.id}',1)">+</button></div></div>`:""}
    </div>`
  }).join(""):`<div class="empty">Nog geen producten.</div>`
}
function renderUsage(){
  if(currentMode==="general"){
    roomFormCard.classList.add("hidden");generalTargetCard.classList.remove("hidden");usageListTitle.textContent="Algemene artikelen";
    const ps=productsForMode();
    usageList.innerHTML=ps.length?ps.map(p=>`<div class="item"><strong>${esc(labelProduct(p))}</strong><br><span class="muted">Gewenste voorraad: ${fmt(p.generalTarget||0)} ${esc(plural(p.orderUnit,p.generalTarget||0))}</span></div>`).join(""):`<div class="empty">Nog geen algemene artikelen.</div>`;
    return
  }
  roomFormCard.classList.remove("hidden");generalTargetCard.classList.add("hidden");usageListTitle.textContent="Ingevoerde kamers";
  const rs=roomsForMode().sort((a,b)=>Number(a.unit)-Number(b.unit)||String(a.room).localeCompare(String(b.room),undefined,{numeric:true})||labelProduct(data.products.find(x=>x.id===a.productId)||{}).localeCompare(labelProduct(data.products.find(x=>x.id===b.productId)||{})));
  usageList.innerHTML=rs.length?rs.map(r=>{
    const p=data.products.find(x=>x.id===r.productId);
    return `<div class="item"><div class="item-head"><div><strong>Kamer ${esc(r.room)}</strong><br><span class="muted">Unit ${esc(r.unit)} · ${p?esc(labelProduct(p)):"Geen product"}</span></div></div><div style="margin-top:8px"><strong>${fmt(r.dailyAmount)} ${esc(r.dailyUnit)} per dag</strong></div><div class="actions">
      <button class="small-primary" onclick="editRoom('${r.id}')">Wijzigen</button>
      <button class="small-danger" onclick="deleteRoom('${r.id}')">Verwijderen</button>
    </div></div>`
  }).join(""):`<div class="empty">Nog geen kamers ingevoerd.</div>`
}
function renderProducts(){
  const ps=productsForMode();
  productList.innerHTML=ps.length?ps.map((p,i)=>`<div class="item product-sort-item" data-product-id="${p.id}">
    <div class="item-head"><div><strong>${esc(labelProduct(p))}</strong><br><span class="muted">Voorraad in ${esc(plural(p.orderUnit,2))}</span></div><button type="button" class="drag-handle" aria-label="Sleep om product te verplaatsen" title="Sleep om te verplaatsen">☰</button></div>
    <div style="margin-top:8px">
      Voorraad: <strong>${fmt(p.stockFull)} ${esc(plural(p.orderUnit,p.stockFull))}${p.orderUnit==="doos"?` + ${fmt(p.stockLoose)} zakjes`:""}</strong><br>
      Besteld: <strong>${fmt(p.alreadyOrdered)} ${esc(plural(p.orderUnit,p.alreadyOrdered))}</strong><br>
      Minimum: <strong>${fmt(p.minimumStock||0)} ${esc(plural(p.orderUnit,p.minimumStock||0))}</strong>
      ${belowMinimum(p)?`<br><span class="status-danger">Onder minimumvoorraad</span>`:""}
    </div>
    <div class="actions">
      <button class="small-primary" onclick="editStock('${p.id}')">Wijzigen</button>
      <button class="small-danger" onclick="deleteProduct('${p.id}')">Verwijderen</button>
    </div></div>`).join(""):`<div class="empty">Nog geen producten.</div>`
}

let draggedProductItem=null;
productList.addEventListener("pointerdown",e=>{
  const handle=e.target.closest(".drag-handle");
  if(!handle)return;
  const item=handle.closest(".product-sort-item");
  if(!item)return;
  draggedProductItem=item;
  item.classList.add("dragging");
  handle.setPointerCapture?.(e.pointerId);
  e.preventDefault();
});
productList.addEventListener("pointermove",e=>{
  if(!draggedProductItem)return;
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest(".product-sort-item");
  if(!target||target===draggedProductItem||target.parentElement!==productList)return;
  const rect=target.getBoundingClientRect();
  const before=e.clientY<rect.top+rect.height/2;
  productList.insertBefore(draggedProductItem,before?target:target.nextSibling);
});
function finishProductDrag(){
  if(!draggedProductItem)return;
  draggedProductItem.classList.remove("dragging");
  draggedProductItem=null;
  [...productList.querySelectorAll(".product-sort-item")].forEach((el,i)=>{
    const p=data.products.find(x=>x.id===el.dataset.productId);
    if(p)p.order=i+1;
  });
  saveData();
}
productList.addEventListener("pointerup",finishProductDrag);
productList.addEventListener("pointercancel",finishProductDrag);

function renderOrders(){
  const rows=productsForMode().map(p=>({p,a:advice(p)})).filter(x=>currentMode==="general"||x.a.weekly>0);
  orderList.innerHTML=rows.length?rows.map(({p,a})=>`<div class="item note">
    <strong>${esc(labelProduct(p))}</strong><br>
    ${a.orderUnits>0
      ? `<span class="status-danger">${a.orderUnits} ${esc(plural(p.orderUnit,a.orderUnits))} bestellen</span>`
      : `<span class="status-ok">Voldoende voorraad</span>`}
    <div class="muted" style="margin-top:5px">
      ${currentMode==="general"
        ? `Doelvoorraad: ${fmt(a.needed/Number(p.contentPerOrderUnit||1))} ${esc(plural(p.orderUnit,a.needed/Number(p.contentPerOrderUnit||1)))}`
        : `Verbruik: ${fmt(a.weekly)} ${esc(p.consumptionUnit)} per week`}
      ${Number(p.minimumStock||0)>0
        ? `<br>Minimum: ${fmt(p.minimumStock)} ${esc(plural(p.orderUnit,p.minimumStock))}`
        : ""}
    </div>
  </div>`).join(""):`<div class="empty">Nog geen bestelgegevens.</div>`
}
function renderOverview(){
  overviewTitle.textContent=modeLabel();usageTabBtn.textContent=currentMode==="general"?"Algemeen":"Kamers";
  statUsageLabel.textContent=currentMode==="general"?"Artikelen":"Kamers";statUsage.textContent=currentMode==="general"?productsForMode().length:roomsForMode().length;
  statProducts.textContent=productsForMode().length;statOrders.textContent=productsForMode().filter(p=>advice(p).orderUnits>0).length;
  weeksCard.classList.toggle("hidden",currentMode==="general");statWeeks.textContent=currentMode==="general"?"Handmatig":`${targetWeeks()} weken`;
  document.querySelectorAll(".week-picker button").forEach(b=>b.classList.toggle("active",Number(b.dataset.weeks)===targetWeeks()));
  const attention=productsForMode().map(p=>({p,a:advice(p),low:belowMinimum(p)})).filter(x=>x.a.orderUnits>0||x.low);
  attentionList.innerHTML=attention.length?attention.map(({p,a,low})=>`<div class="item"><strong>${esc(labelProduct(p))}</strong><br>${low?`<span class="status-danger">Onder minimumvoorraad</span><br>`:""}${a.orderUnits>0?`<span class="status-danger">${a.orderUnits} ${esc(plural(p.orderUnit,a.orderUnits))} bestellen</span>`:""}</div>`).join(""):`<div class="empty">Geen directe aandachtspunten.</div>`
}
function renderAll(){
  flavorField.classList.toggle("hidden",currentMode==="sonde");
  looseField.classList.toggle("hidden",orderUnit.value!=="doos");
  renderProductOptions();renderCounting();renderUsage();renderProducts();renderOrders();renderOverview()
}
function changeStock(id,d){const p=data.products.find(x=>x.id===id);p.stockFull=Math.max(0,Number(p.stockFull||0)+d);saveData()}
function changeLoose(id,d){const p=data.products.find(x=>x.id===id);p.stockLoose=Math.max(0,Number(p.stockLoose||0)+d);saveData()}
function moveProduct(id,dir){
  const ps=productsForMode(),i=ps.findIndex(p=>p.id===id),j=i+dir;if(j<0||j>=ps.length)return;
  const a=ps[i].order,b=ps[j].order;ps[i].order=b;ps[j].order=a;saveData()
}
let editingRoomId=null;
function editRoom(id){
  const r=data.rooms.find(x=>x.id===id);
  if(!r)return;
  const modeProducts=data.products.filter(p=>p.mode===r.mode).sort((a,b)=>a.order-b.order);
  if(!modeProducts.length){alert("Er zijn geen producten beschikbaar.");return}
  editingRoomId=id;
  editRoomNumber.value=r.room;
  editRoomUnit.value=String(r.unit);
  editRoomProduct.innerHTML=modeProducts.map(p=>`<option value="${p.id}">${esc(labelProduct(p))}</option>`).join("");
  editRoomProduct.value=r.productId;
  editDailyAmount.value=r.dailyAmount;
  const p=data.products.find(x=>x.id===r.productId);
  editDailyUnit.value=p?p.consumptionUnit:r.dailyUnit;
  roomEditModal.classList.remove("hidden");
  document.body.style.overflow="hidden";
}
function closeRoomEdit(){
  editingRoomId=null;
  roomEditModal.classList.add("hidden");
  document.body.style.overflow="";
}
editRoomProduct.onchange=()=>{
  const p=data.products.find(x=>x.id===editRoomProduct.value);
  if(p)editDailyUnit.value=p.consumptionUnit;
};
saveRoomEdit.onclick=()=>{
  const r=data.rooms.find(x=>x.id===editingRoomId);
  const p=data.products.find(x=>x.id===editRoomProduct.value);
  const amount=Number(String(editDailyAmount.value).replace(",","."));
  const roomNumber=editRoomNumber.value.trim();
  if(!r||!p||!roomNumber||!Number.isFinite(amount)||amount<=0){alert("Vul kamernummer, product en verbruik in.");return}
  r.room=roomNumber;
  r.unit=editRoomUnit.value;
  r.productId=p.id;
  r.dailyAmount=amount;
  r.dailyUnit=p.consumptionUnit;
  closeRoomEdit();
  saveData();
};
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!roomEditModal.classList.contains("hidden"))closeRoomEdit();if(!productEditModal.classList.contains("hidden"))closeProductEdit()});
function deleteRoom(id){if(confirm("Deze kamerregel verwijderen?")){data.rooms=data.rooms.filter(r=>r.id!==id);saveData()}}
function deleteProduct(id){
  if(data.rooms.some(r=>r.productId===id)){alert("Dit product is nog gekoppeld aan een kamer.");return}
  if(confirm("Dit product verwijderen?")){data.products=data.products.filter(p=>p.id!==id);saveData()}
}
let editingProductId=null;
function editStock(id){
  const p=data.products.find(x=>x.id===id);if(!p)return;
  editingProductId=id;
  editProductName.value=p.name||"";
  editFlavor.value=p.flavor||"";
  editFlavorField.classList.toggle("hidden",p.mode==="sonde");
  editConsumptionUnit.value=p.consumptionUnit;
  editOrderUnit.value=p.orderUnit;
  editContentPerOrderUnit.value=p.contentPerOrderUnit;
  editStockFull.value=p.stockFull||0;
  editStockLoose.value=p.stockLoose||0;
  editAlreadyOrdered.value=p.alreadyOrdered||0;
  editMinimumStock.value=p.minimumStock||0;
  editLooseField.classList.toggle("hidden",p.orderUnit!=="doos");
  productEditModal.classList.remove("hidden");
  document.body.style.overflow="hidden";
}
function closeProductEdit(){
  editingProductId=null;
  productEditModal.classList.add("hidden");
  document.body.style.overflow="";
}
editOrderUnit.onchange=()=>editLooseField.classList.toggle("hidden",editOrderUnit.value!=="doos");
saveProductEdit.onclick=()=>{
  const p=data.products.find(x=>x.id===editingProductId);if(!p)return;
  const name=editProductName.value.trim();
  const flavor=p.mode==="sonde"?"":editFlavor.value.trim();
  const content=Number(String(editContentPerOrderUnit.value).replace(",","."));
  if(!name||!Number.isFinite(content)||content<=0){alert("Vul productnaam en inhoud per besteleenheid in.");return}
  p.name=name;p.flavor=flavor;p.consumptionUnit=editConsumptionUnit.value;p.orderUnit=editOrderUnit.value;p.contentPerOrderUnit=content;
  p.stockFull=Math.max(0,Number(editStockFull.value)||0);
  p.stockLoose=p.orderUnit==="doos"?Math.max(0,Number(editStockLoose.value)||0):0;
  p.alreadyOrdered=Math.max(0,Number(editAlreadyOrdered.value)||0);
  p.minimumStock=Math.max(0,Number(editMinimumStock.value)||0);
  data.rooms.filter(r=>r.productId===p.id).forEach(r=>r.dailyUnit=p.consumptionUnit);
  closeProductEdit();saveData();
};
document.querySelectorAll(".mode-btn").forEach(b=>b.onclick=()=>{currentMode=b.dataset.mode;document.querySelectorAll(".mode-btn").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderAll()});
document.querySelectorAll(".tab-btn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab-btn").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.getElementById(b.dataset.tab).classList.add("active")});
document.querySelectorAll(".week-picker button").forEach(b=>b.onclick=()=>{if(currentMode==="drink")data.settings.drinkWeeks=Number(b.dataset.weeks);else data.settings.sondeWeeks=Number(b.dataset.weeks);saveData()});
orderUnit.onchange=()=>looseField.classList.toggle("hidden",orderUnit.value!=="doos");
saveRoom.onclick=()=>{
  const roomV=room.value.trim(),unitV=unit.value,productId=roomProduct.value,dailyAmountV=Number(dailyAmount.value),dailyUnitV=dailyUnit.value,p=data.products.find(x=>x.id===productId);
  if(!roomV||!productId||dailyAmountV<=0){alert("Vul kamernummer, product en verbruik in.");return}
  if(p&&p.consumptionUnit!==dailyUnitV){alert(`Kies ${p.consumptionUnit} als eenheid.`);return}
  data.rooms.push({id:crypto.randomUUID(),mode:currentMode,room:roomV,unit:unitV,productId,dailyAmount:dailyAmountV,dailyUnit:dailyUnitV});room.value="";dailyAmount.value="";saveData()
};
saveGeneralTarget.onclick=()=>{const p=data.products.find(x=>x.id===generalProduct.value),target=Number(generalTarget.value);if(!p||target<0){alert("Vul een geldige voorraad in.");return}p.generalTarget=target;generalTarget.value="";saveData()};
saveProduct.onclick=()=>{
  const name=productName.value.trim(),fl=currentMode==="sonde"?"":flavor.value.trim(),cu=consumptionUnit.value,ou=orderUnit.value,content=Number(contentPerOrderUnit.value),sf=Number(stockFull.value||0),sl=ou==="doos"?Number(stockLoose.value||0):0,ao=Number(alreadyOrdered.value||0),min=Number(minimumStock.value||0);
  if(!name||content<=0){alert("Vul productnaam en inhoud per besteleenheid in.");return}
  const maxOrder=Math.max(0,...productsForMode().map(p=>p.order||0));
  data.products.push({id:crypto.randomUUID(),mode:currentMode,name,flavor:fl,consumptionUnit:cu,orderUnit:ou,contentPerOrderUnit:content,stockFull:sf,stockLoose:sl,alreadyOrdered:ao,generalTarget:0,minimumStock:min,order:maxOrder+1});
  productName.value="";flavor.value="";contentPerOrderUnit.value="";stockFull.value="0";stockLoose.value="0";alreadyOrdered.value="0";minimumStock.value="0";saveData()
};
renderAll();
