'use strict';
/* ================= ليورا — النماذج ================= */

/* ---------- منتج ---------- */
let pImg = null;
function openProductForm(id, cloneFrom) {
  const p = id ? P(id) : cloneFrom ? { ...P(cloneFrom), id: null, sku: '', size: '', color: '' } : { minQty: 2 };
  pImg = p.img || null;
  const isNew = !id;
  openModal(id ? 'تعديل منتج' : cloneFrom ? 'نفس المنتج بمقاس/لون آخر' : 'منتج جديد', `
    <div class="form-grid">
      <label class="f span2"><span>اسم المنتج *</span><input id="p-name" value="${esc(p.name)}" placeholder="مثلاً: فستان صيفي مورّد"></label>
      <label class="f"><span>التصنيف</span><select id="p-cat">${opts(db.settings.categories, p.category)}</select></label>
      <label class="f"><span>المقاس</span><input id="p-size" value="${esc(p.size)}" placeholder="S / M / 2-3 سنوات"></label>
      <label class="f"><span>اللون</span><input id="p-color" value="${esc(p.color)}" placeholder="زهري"></label>
      <label class="f"><span>الكود</span><input id="p-sku" value="${esc(p.sku)}" placeholder="تلقائي"></label>
      <label class="f"><span>سعر البيع *</span><input id="p-price" type="number" step="any" min="0" value="${p.price ?? ''}"></label>
      <label class="f"><span>تنبيه إذا الكمية أقل من</span><input id="p-min" type="number" min="0" value="${p.minQty ?? 2}"></label>
      <label class="f"><span>صورة</span><input type="file" accept="image/*" onchange="pickImg(this.files[0])"></label>
      <div class="span3" id="p-img-prev">${pImg ? `<img src="${pImg}" style="height:90px;border-radius:12px"> <button class="btn btn-sm btn-ghost" onclick="pImg=null;$('#p-img-prev').innerHTML=''">إزالة الصورة</button>` : ''}</div>
      <label class="f span3"><span>ملاحظات</span><input id="p-notes" value="${esc(p.notes)}" placeholder="القماش، المورد…"></label>
      ${isNew ? `<div class="span3 section-title" style="margin:6px 0 0">رصيد موجود حالياً (اختياري — للبضاعة اللي عندكم من قبل)</div>
      <label class="f"><span>الكمية</span><input id="p-oq" type="number" min="0" step="1" placeholder="0"></label>
      <label class="f"><span>تكلفة القطعة</span><input id="p-oc" type="number" min="0" step="any" placeholder="شامل التوصيل"></label>
      <label class="f"><span>المخزن</span><select id="p-ow">${whOpts()}</select></label>` : ''}
    </div>
    ${isNew ? '<p class="note" style="margin-top:12px">💡 للبضاعة الجديدة الأفضل تسجيلها من «إدخال بضاعة» عشان تنوزع رسوم التوصيل على القطع.</p>' : ''}
    <div class="modal-foot">
      <button class="btn btn-primary" onclick="saveProduct('${id || ''}')">حفظ</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      ${id ? `<span style="flex:1"></span><button class="btn btn-danger" onclick="deleteProduct('${id}')">حذف</button>` : ''}
    </div>`);
  setTimeout(() => $('#p-name')?.focus(), 50);
}
async function pickImg(f) {
  if (!f) return;
  try { pImg = await resizeImage(f); $('#p-img-prev').innerHTML = `<img src="${pImg}" style="height:90px;border-radius:12px">`; }
  catch (e) { toast('تعذّر قراءة الصورة', true); }
}
function saveProduct(id, silent) {
  const name = $('#p-name').value.trim();
  if (!name) return toast('اكتبوا اسم المنتج', true);
  let sku = $('#p-sku').value.trim();
  if (sku && db.products.some(x => x.sku === sku && x.id !== id)) return toast('هذا الكود مستخدم لمنتج آخر', true);
  const data = {
    name, category: $('#p-cat').value, size: $('#p-size').value.trim(), color: $('#p-color').value.trim(),
    price: N($('#p-price').value), minQty: N($('#p-min').value), img: pImg, notes: $('#p-notes').value.trim(),
  };
  let p;
  if (id) { p = P(id); Object.assign(p, data, { sku: sku || p.sku }); }
  else {
    p = { id: uid(), sku: sku || nextSku(), createdAt: today(), ...data };
    db.products.push(p);
    const oq = N($('#p-oq')?.value);
    if (oq > 0) db.moves.push({ id: uid(), ts: Date.now(), date: today(), type: 'opening', pid: p.id, wid: $('#p-ow').value, qty: oq, cost: N($('#p-oc').value), note: 'رصيد افتتاحي' });
  }
  save();
  if (pendingLine) { const cb = pendingLine; pendingLine = null; cb(p); return; }
  closeModal(); render(); toast('تم حفظ المنتج ✓');
}
function deleteProduct(id) {
  if (isProductUsed(id)) return toast('ما بنقدر نحذفه لأنه موجود بفواتير. عدّلوا الكمية من الجرد بدلاً من ذلك.', true);
  if (!confirm('حذف المنتج نهائياً؟')) return;
  db.products = db.products.filter(p => p.id !== id);
  db.moves = db.moves.filter(m => m.pid !== id);
  save(); closeModal(); render(); toast('تم الحذف');
}

/* ---------- سطور الفواتير (مشترك بين الشراء والبيع) ---------- */
let F = null;            // حالة النموذج المفتوح
let pendingLine = null;  // لما نضيف منتج جديد من داخل فاتورة

function lineRowHTML(l, i) {
  const isP = F.kind === 'p';
  return `<tr data-i="${i}">
    <td style="min-width:220px"><input list="dl-prod" value="${esc(l.label || '')}" placeholder="ابحثوا عن منتج…" oninput="lineProd(${i},this.value)" onchange="lineProd(${i},this.value,true)"></td>
    <td style="width:90px"><input type="number" min="1" step="1" value="${l.qty ?? ''}" oninput="F.lines[${i}].qty=N(this.value);recalc()"></td>
    <td style="width:120px"><input type="number" min="0" step="any" value="${(isP ? l.unit : l.price) ?? ''}" data-k="${isP ? 'unit' : 'price'}" oninput="F.lines[${i}].${isP ? 'unit' : 'price'}=N(this.value);F.lines[${i}].touched=1;recalc()"></td>
    <td class="calc" id="calc-${i}"></td>
    <td style="width:40px"><button class="icon-btn" onclick="removeLine(${i})" title="حذف السطر">✕</button></td></tr>`;
}
function renderLines() {
  $('#lines-body').innerHTML = F.lines.map(lineRowHTML).join('');
  recalc();
}
function addLine() { F.lines.push({ qty: 1 }); renderLines(); const ins = $$('#lines-body tr:last-child input'); ins[0]?.focus(); }
function removeLine(i) { F.lines.splice(i, 1); if (!F.lines.length) F.lines.push({ qty: 1 }); renderLines(); }
function lineProd(i, v, final) {
  const l = F.lines[i]; l.label = v;
  const p = findProductByLabel(v);
  l.pid = p?.id || null;
  if (p && F.kind === 's' && !l.touched) {
    l.price = N(p.price);
    const inp = $(`#lines-body tr[data-i="${i}"] input[data-k="price"]`); if (inp) inp.value = l.price;
  }
  if (p && F.kind === 'p' && !l.touched && !l.unit) {
    const c = compute().avg[p.id]; // آخر تكلفة كاقتراح فقط
    if (c) { l.unit = +c.toFixed(2); const inp = $(`#lines-body tr[data-i="${i}"] input[data-k="unit"]`); if (inp) inp.value = l.unit; }
  }
  if (final && v && !p) toast('اختاروا منتج من القائمة أو أضيفوا منتج جديد', true);
  recalc();
}
function newProductInline() {
  const snapshot = F; const html = $('#modal').innerHTML;
  pendingLine = p => {
    F = snapshot; $('#modal').innerHTML = html; $('#modal').classList.add('open');
    refreshDatalist();
    let l = F.lines.find(x => !x.pid && !x.label);
    if (!l) { l = { qty: 1 }; F.lines.push(l); }
    l.pid = p.id; l.label = pLabel(p);
    if (F.kind === 's') l.price = N(p.price);
    restoreFormFields(); renderLines(); toast('تمت إضافة المنتج ✓');
  };
  saveFormFields();
  openProductForm();
}
let savedFields = {};
function saveFormFields() { savedFields = {}; $$('#modal [id^="f-"]').forEach(el => savedFields[el.id] = el.type === 'checkbox' ? el.checked : el.value); }
function restoreFormFields() { for (const [k, v] of Object.entries(savedFields)) { const el = $('#' + k); if (!el) continue; if (el.type === 'checkbox') el.checked = v; else el.value = v; } }
const linesTable = (h3) => `<table class="lines"><thead><tr><th>المنتج</th><th>الكمية</th><th>${h3}</th><th></th><th></th></tr></thead><tbody id="lines-body"></tbody></table>
  <div style="display:flex;gap:8px;margin:8px 0 16px;flex-wrap:wrap"><button class="btn btn-sm btn-soft" onclick="addLine()">+ سطر</button><button class="btn btn-sm btn-ghost" onclick="newProductInline()">+ منتج جديد غير موجود</button></div>`;

function recalc() {
  if (!F) return;
  if (F.kind === 'p') recalcPurchase(); else recalcSale();
}

/* ---------- فاتورة بضاعة (شراء) ---------- */
function openPurchaseForm(id) {
  const r = id ? db.purchases.find(x => x.id === id) : null;
  F = { kind: 'p', id, method: r?.method || 'value',
    lines: r ? r.items.map(it => ({ pid: it.pid, label: pLabel(P(it.pid)), qty: it.qty, unit: it.unit, touched: 1 })) : [{ qty: 1 }] };
  openModal(id ? `تعديل فاتورة بضاعة #${r.no}` : '📦 فاتورة بضاعة جديدة', `
    <div class="form-grid">
      <label class="f"><span>التاريخ</span><input id="f-date" type="date" value="${r?.date || today()}"></label>
      <label class="f"><span>المورد</span><input id="f-sup" value="${esc(r?.supplier)}" placeholder="اسم المورد / المحل"></label>
      <label class="f"><span>تدخل على مخزن</span><select id="f-wh">${whOpts(r?.wid)}</select></label>
    </div>
    <div class="section-title">القطع</div>
    ${linesTable('سعر شراء القطعة')}
    <div class="grid g2">
      <div>
        <div class="form-grid">
          <label class="f"><span>توصيل / شحن</span><input id="f-ship" type="number" min="0" step="any" value="${r?.feeShip ?? ''}" oninput="recalc()"></label>
          <label class="f"><span>جمارك</span><input id="f-cust" type="number" min="0" step="any" value="${r?.feeCustoms ?? ''}" oninput="recalc()"></label>
          <label class="f"><span>رسوم أخرى</span><input id="f-other" type="number" min="0" step="any" value="${r?.feeOther ?? ''}" oninput="recalc()"></label>
        </div>
        <div class="section-title" style="margin-top:14px">طريقة توزيع الرسوم على القطع</div>
        <div class="seg" id="f-method">
          <button class="${F.method === 'value' ? 'on' : ''}" onclick="F.method='value';$$('#f-method button').forEach((b,i)=>b.classList.toggle('on',i===0));recalc()">حسب السعر</button>
          <button class="${F.method === 'qty' ? 'on' : ''}" onclick="F.method='qty';$$('#f-method button').forEach((b,i)=>b.classList.toggle('on',i===1));recalc()">بالتساوي على القطع</button>
        </div>
        <p class="pmeta" style="margin-top:8px">«حسب السعر»: القطعة الأغلى بتتحمّل حصة أكبر من الرسوم.</p>
        <label class="f" style="margin-top:10px"><span>ملاحظات</span><input id="f-note" value="${esc(r?.note)}"></label>
      </div>
      <div class="summary" id="p-sum"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-primary" onclick="savePurchase()">حفظ الفاتورة</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`, { wide: true });
  renderLines();
}
function purchaseFees() { return N($('#f-ship').value) + N($('#f-cust').value) + N($('#f-other').value); }
function recalcPurchase() {
  const items = F.lines.map(l => ({ qty: N(l.qty), unit: N(l.unit) }));
  const fees = purchaseFees();
  const al = allocate(items, fees, F.method);
  al.forEach((a, i) => { const el = $('#calc-' + i); if (el) el.innerHTML = a.qty ? `تكلفة القطعة <b>${num(a.landed)}</b><br>الإجمالي ${num(a.qty * a.landed)}` : ''; });
  const goods = sum(items, i => i.qty * i.unit), units = sum(items, i => i.qty);
  $('#p-sum').innerHTML = `
    <div class="row"><span>عدد القطع</span><b>${num(units)}</b></div>
    <div class="row"><span>قيمة البضاعة</span><b>${money(goods)}</b></div>
    <div class="row"><span>الرسوم</span><b>${money(fees)}</b></div>
    <div class="row"><span>متوسط الرسوم على القطعة</span><b>${num(units ? fees / units : 0)}</b></div>
    <div class="row total"><span>الإجمالي</span><b>${money(goods + fees)}</b></div>`;
}
function savePurchase() {
  const lines = F.lines.filter(l => l.pid || l.label);
  if (!lines.length) return toast('أضيفوا قطعة واحدة على الأقل', true);
  if (lines.some(l => !l.pid)) return toast('في سطر منتجه غير معروف — اختاروه من القائمة', true);
  if (lines.some(l => N(l.qty) <= 0)) return toast('الكمية لازم تكون أكبر من صفر', true);
  const fees = purchaseFees();
  const items = allocate(lines.map(l => ({ pid: l.pid, qty: N(l.qty), unit: N(l.unit) })), fees, F.method);
  const old = F.id ? db.purchases.find(x => x.id === F.id) : null;
  const rec = {
    id: old?.id || uid(), no: old?.no || db.seq.purchase++, ts: old?.ts || Date.now(),
    date: $('#f-date').value || today(), supplier: $('#f-sup').value.trim(), wid: $('#f-wh').value,
    note: $('#f-note').value.trim(), method: F.method,
    feeShip: N($('#f-ship').value), feeCustoms: N($('#f-cust').value), feeOther: N($('#f-other').value),
    fees, goods: sum(items, i => i.qty * i.unit), items,
  };
  if (old) {
    // نتأكد ما يصير المخزون بالسالب بسبب التعديل
    const test = { ...db, purchases: db.purchases.map(x => x.id === old.id ? rec : x) };
    const neg = negativeAfter(test); if (neg) return toast(`التعديل بيخلّي «${neg}» بالسالب`, true);
    Object.assign(old, rec);
  } else db.purchases.push(rec);
  save(); F = null; closeModal(); render(); toast('تم حفظ الفاتورة ✓ والمخزون تحدّث');
}
function negativeAfter(test) {
  const c = compute(test);
  for (const p of db.products) for (const w of db.warehouses) if (c.qty(p.id, w.id) < 0 && compute().qty(p.id, w.id) >= 0) return pShort(p) + ' — ' + w.name;
  return null;
}
function viewPurchase(id) {
  const r = db.purchases.find(x => x.id === id);
  openModal(`📦 فاتورة بضاعة #${r.no}`, `
    <div class="pmeta mb">${fmtDate(r.date)} · ${esc(r.supplier || 'بدون مورد')} · ${esc(wName(r.wid))}${r.note ? ' · ' + esc(r.note) : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>المنتج</th><th class="n">الكمية</th><th class="n">سعر الشراء</th><th class="n">حصة الرسوم</th><th class="n">التكلفة النهائية للقطعة</th></tr></thead><tbody>
    ${r.items.map(it => `<tr><td>${esc(pShort(P(it.pid)))}</td><td class="n">${num(it.qty)}</td><td class="n">${num(it.unit)}</td><td class="n">${num(it.fee)}</td><td class="n"><b>${num(it.landed)}</b></td></tr>`).join('')}
    </tbody></table></div>
    <div class="summary" style="margin-top:14px">
      <div class="row"><span>البضاعة</span><b>${money(r.goods)}</b></div>
      <div class="row"><span>توصيل/شحن ${num(r.feeShip)} · جمارك ${num(r.feeCustoms)} · أخرى ${num(r.feeOther)}</span><b>${money(r.fees)}</b></div>
      <div class="row total"><span>الإجمالي</span><b>${money(r.goods + r.fees)}</b></div></div>
    <div class="modal-foot"><button class="btn btn-soft" onclick="openPurchaseForm('${id}')">تعديل</button>
      <span style="flex:1"></span><button class="btn btn-danger" onclick="deletePurchase('${id}')">حذف الفاتورة</button></div>`, { wide: true });
}
function deletePurchase(id) {
  const test = { ...db, purchases: db.purchases.filter(x => x.id !== id) };
  const neg = negativeAfter(test);
  if (neg) return toast(`ما بنقدر نحذفها: قطع منها انباعت («${neg}»)`, true);
  if (!confirm('حذف الفاتورة؟ الكميات رح تنشال من المخزون.')) return;
  db.purchases = test.purchases; save(); closeModal(); render(); toast('تم الحذف');
}

/* ---------- فاتورة بيع ---------- */
function openSaleForm(id, asReturn) {
  if (!db.products.length) { toast('أضيفوا منتجات أولاً', true); return openProductForm(); }
  const r = id ? db.sales.find(x => x.id === id) : null;
  const ret = r ? r.isReturn : !!asReturn;
  F = { kind: 's', id,
    lines: r ? r.items.map(it => ({ pid: it.pid, label: pLabel(P(it.pid)), qty: it.qty, price: it.price, touched: 1 })) : [{ qty: 1 }] };
  openModal(id ? `تعديل ${ret ? 'مرتجع' : 'فاتورة بيع'} #${r.no}` : (ret ? '↩️ مرتجع' : '🛍️ عملية بيع جديدة'), `
    <div class="form-grid">
      <label class="f"><span>التاريخ</span><input id="f-date" type="date" value="${r?.date || today()}"></label>
      <label class="f"><span>اسم الزبونة</span><input id="f-cust" value="${esc(r?.customer)}"></label>
      <label class="f"><span>الهاتف</span><input id="f-phone" value="${esc(r?.phone)}" inputmode="tel"></label>
      <label class="f"><span>قناة البيع</span><select id="f-ch">${opts(db.settings.channels, r?.channel)}</select></label>
      <label class="f"><span>من مخزن</span><select id="f-wh" onchange="recalc()">${whOpts(r?.wid)}</select></label>
      <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="f-ret" ${ret ? 'checked' : ''} onchange="recalc()"> مرتجع (القطع ترجع للمخزن)</label>
    </div>
    <div class="section-title">القطع</div>
    ${linesTable('سعر البيع')}
    <div class="grid g2">
      <div class="form-grid">
        <label class="f"><span>خصم على الفاتورة</span><input id="f-disc" type="number" min="0" step="any" value="${r?.discount ?? ''}" oninput="recalc()"></label>
        <label class="f"><span>توصيل يدفعه الزبون لنا</span><input id="f-din" type="number" min="0" step="any" value="${r?.deliveryIn ?? ''}" oninput="recalc()"></label>
        <label class="f"><span>توصيل على حسابنا</span><input id="f-dout" type="number" min="0" step="any" value="${r?.deliveryOut ?? ''}" oninput="recalc()"></label>
        <label class="f span3"><span>ملاحظات</span><input id="f-note" value="${esc(r?.note)}" placeholder="العنوان، طريقة الدفع…"></label>
      </div>
      <div class="summary" id="s-sum"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-primary" onclick="saveSale()">حفظ</button>
      <button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div>`, { wide: true });
  renderLines();
}
function availableFor(pid, wid) {
  const src = F.id ? { ...db, sales: db.sales.filter(x => x.id !== F.id) } : db;
  return compute(src).qty(pid, wid);
}
function saleDraft() {
  return {
    isReturn: $('#f-ret').checked, wid: $('#f-wh').value,
    discount: N($('#f-disc').value), deliveryIn: N($('#f-din').value), deliveryOut: N($('#f-dout').value),
    items: F.lines.filter(l => l.pid).map(l => ({ pid: l.pid, qty: N(l.qty), price: N(l.price) })),
  };
}
function recalcSale() {
  const d = saleDraft(); const c = compute();
  F.lines.forEach((l, i) => {
    const el = $('#calc-' + i); if (!el) return;
    if (!l.pid) { el.innerHTML = ''; return; }
    const av = availableFor(l.pid, d.wid);
    const cost = c.avg[l.pid] || 0;
    const warn = !d.isReturn && N(l.qty) > av;
    el.innerHTML = `<span class="${warn ? 'neg' : ''}">متوفر <b class="${warn ? 'neg' : ''}">${num(av)}</b></span><br>ربح القطعة <b class="${N(l.price) - cost < 0 ? 'neg' : 'pos'}">${num(N(l.price) - cost)}</b>`;
  });
  const n = saleNums(d, d.items.map(it => c.avg[it.pid] || 0));
  $('#s-sum').innerHTML = `
    <div class="row"><span>المجموع</span><b>${money(n.sub)}</b></div>
    ${d.discount ? `<div class="row"><span>الخصم</span><b>− ${money(d.discount)}</b></div>` : ''}
    ${d.deliveryIn ? `<div class="row"><span>توصيل من الزبون</span><b>+ ${money(d.deliveryIn)}</b></div>` : ''}
    <div class="row total"><span>${d.isReturn ? 'المبلغ المُرجع' : 'المطلوب من الزبونة'}</span><b>${money(Math.abs(n.revenue))}</b></div>
    <div class="row"><span>تكلفة القطع</span><b>${money(Math.abs(n.cogs))}</b></div>
    <div class="row"><span>${d.isReturn ? 'أثر على الربح' : 'ربح الفاتورة'}</span><b class="${n.profit < 0 ? 'neg' : 'pos'}">${money(n.profit)}</b></div>`;
}
function saveSale() {
  const lines = F.lines.filter(l => l.pid || l.label);
  if (!lines.length) return toast('أضيفوا قطعة واحدة على الأقل', true);
  if (lines.some(l => !l.pid)) return toast('في سطر منتجه غير معروف — اختاروه من القائمة', true);
  if (lines.some(l => N(l.qty) <= 0)) return toast('الكمية لازم تكون أكبر من صفر', true);
  const d = saleDraft();
  if (!d.isReturn) {
    const need = {};
    d.items.forEach(it => need[it.pid] = (need[it.pid] || 0) + it.qty);
    for (const [pid, q] of Object.entries(need)) {
      const av = availableFor(pid, d.wid);
      if (q > av) return toast(`«${pShort(P(pid))}» المتوفر ${num(av)} بس بهذا المخزن`, true);
    }
  }
  const old = F.id ? db.sales.find(x => x.id === F.id) : null;
  const rec = {
    id: old?.id || uid(), no: old?.no || db.seq.sale++, ts: old?.ts || Date.now(),
    date: $('#f-date').value || today(), customer: $('#f-cust').value.trim(), phone: $('#f-phone').value.trim(),
    channel: $('#f-ch').value, note: $('#f-note').value.trim(), ...d,
  };
  if (old) Object.assign(old, rec); else db.sales.push(rec);
  save(); F = null; closeModal(); render(); toast(d.isReturn ? 'تم تسجيل المرتجع ✓' : 'تم تسجيل البيع ✓');
}
function viewSale(id) {
  const r = db.sales.find(x => x.id === id);
  const costs = compute().saleCost[id] || [];
  const n = saleNums(r);
  openModal(`${r.isReturn ? '↩️ مرتجع' : '🛍️ فاتورة بيع'} #${r.no}`, `
    <div class="pmeta mb">${fmtDate(r.date)} · ${esc(r.customer || 'زبونة')} ${r.phone ? '· ' + esc(r.phone) : ''} · ${esc(r.channel || '')} · ${esc(wName(r.wid))}${r.note ? '<br>' + esc(r.note) : ''}</div>
    <div class="table-wrap"><table><thead><tr><th>المنتج</th><th class="n">الكمية</th><th class="n">السعر</th><th class="n">التكلفة</th><th class="n">الربح</th></tr></thead><tbody>
    ${r.items.map((it, i) => `<tr><td>${esc(pShort(P(it.pid)))}</td><td class="n">${num(it.qty)}</td><td class="n">${num(it.price)}</td><td class="n">${num(costs[i] || 0)}</td><td class="n">${num(it.qty * (it.price - (costs[i] || 0)))}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="summary" style="margin-top:14px">
      <div class="row"><span>المجموع</span><b>${money(n.sub)}</b></div>
      ${r.discount ? `<div class="row"><span>خصم</span><b>${money(r.discount)}</b></div>` : ''}
      ${r.deliveryIn ? `<div class="row"><span>توصيل من الزبون</span><b>${money(r.deliveryIn)}</b></div>` : ''}
      ${r.deliveryOut ? `<div class="row"><span>توصيل على حسابنا</span><b>${money(r.deliveryOut)}</b></div>` : ''}
      <div class="row total"><span>الإيراد</span><b>${money(n.revenue)}</b></div>
      <div class="row"><span>صافي ربح الفاتورة</span><b class="${n.profit < 0 ? 'neg' : 'pos'}">${money(n.profit)}</b></div></div>
    <div class="modal-foot"><button class="btn btn-soft" onclick="openSaleForm('${id}')">تعديل</button>
      ${r.isReturn ? '' : `<button class="btn btn-gold" onclick="returnFrom('${id}')">↩️ عمل مرتجع منها</button>`}
      <span style="flex:1"></span><button class="btn btn-danger" onclick="deleteSale('${id}')">حذف</button></div>`, { wide: true });
}
function returnFrom(id) {
  const r = db.sales.find(x => x.id === id);
  openSaleForm(null, true);
  F.lines = r.items.map(it => ({ pid: it.pid, label: pLabel(P(it.pid)), qty: it.qty, price: it.price, touched: 1 }));
  $('#f-cust').value = r.customer || ''; $('#f-phone').value = r.phone || ''; $('#f-ch').value = r.channel || ''; $('#f-wh').value = r.wid;
  $('#f-note').value = `مرتجع من فاتورة #${r.no}`;
  renderLines();
}
function deleteSale(id) {
  const test = { ...db, sales: db.sales.filter(x => x.id !== id) };
  const neg = negativeAfter(test);
  if (neg) return toast(`ما بنقدر نحذفه: «${neg}» رح يصير بالسالب`, true);
  if (!confirm('حذف الفاتورة؟ الكميات رح ترجع للمخزون.')) return;
  db.sales = test.sales; save(); closeModal(); render(); toast('تم الحذف');
}

/* ---------- جرد / تحويل / مخازن ---------- */
function openCountForm() {
  openModal('📝 جرد وتسوية كمية', `
    <p class="note mb">عدّوا القطع فعلياً واكتبوا العدد الحقيقي — التطبيق بيسجّل الفرق (نقص أو زيادة) كحركة تسوية.</p>
    <div class="form-grid two">
      <label class="f span2"><span>المنتج</span><input id="c-prod" list="dl-prod" oninput="countInfo()" placeholder="ابحثوا عن منتج…"></label>
      <label class="f"><span>المخزن</span><select id="c-wh" onchange="countInfo()">${whOpts()}</select></label>
      <label class="f"><span>العدد الفعلي</span><input id="c-qty" type="number" min="0" step="1" oninput="countInfo()"></label>
      <label class="f span2"><span>السبب</span><input id="c-note" placeholder="جرد دوري، تالف، هدية…"></label>
    </div>
    <div class="summary" id="c-info" style="margin-top:12px">اختاروا منتج</div>
    <div class="modal-foot"><button class="btn btn-primary" onclick="saveCount()">تسجيل</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>`);
}
function countInfo() {
  const p = findProductByLabel($('#c-prod').value);
  if (!p) return $('#c-info').innerHTML = 'اختاروا منتج من القائمة';
  const sys = compute().qty(p.id, $('#c-wh').value);
  const v = $('#c-qty').value; const diff = v === '' ? null : N(v) - sys;
  $('#c-info').innerHTML = `<div class="row"><span>الكمية بالنظام</span><b>${num(sys)}</b></div>
    ${diff === null ? '' : `<div class="row total"><span>الفرق</span><b class="${diff < 0 ? 'neg' : 'pos'}">${diff > 0 ? '+' : ''}${num(diff)}</b></div>`}`;
}
function saveCount() {
  const p = findProductByLabel($('#c-prod').value);
  if (!p) return toast('اختاروا منتج', true);
  if ($('#c-qty').value === '') return toast('اكتبوا العدد الفعلي', true);
  const wid = $('#c-wh').value;
  const diff = N($('#c-qty').value) - compute().qty(p.id, wid);
  if (!diff) { closeModal(); return toast('الكمية مطابقة ✓'); }
  db.moves.push({ id: uid(), ts: Date.now(), date: today(), type: 'adjust', pid: p.id, wid, qty: diff, cost: 0, note: $('#c-note').value.trim() || 'جرد' });
  save(); closeModal(); render(); toast('تم تسجيل التسوية ✓');
}
function openTransferForm() {
  if (db.warehouses.length < 2) { toast('أضيفوا مخزن ثاني أولاً', true); return openWarehouseForm(); }
  openModal('⇄ تحويل بين المخازن', `
    <div class="form-grid two">
      <label class="f span2"><span>المنتج</span><input id="t-prod" list="dl-prod" placeholder="ابحثوا عن منتج…" oninput="trInfo()"></label>
      <label class="f"><span>من</span><select id="t-from" onchange="trInfo()">${whOpts(db.warehouses[0].id)}</select></label>
      <label class="f"><span>إلى</span><select id="t-to">${whOpts(db.warehouses[1].id)}</select></label>
      <label class="f"><span>الكمية</span><input id="t-qty" type="number" min="1" step="1" value="1"></label>
      <label class="f"><span>التاريخ</span><input id="t-date" type="date" value="${today()}"></label>
    </div>
    <div class="pmeta" id="t-info" style="margin-top:10px"></div>
    <div class="modal-foot"><button class="btn btn-primary" onclick="saveTransfer()">تحويل</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>`);
}
function trInfo() { const p = findProductByLabel($('#t-prod').value); $('#t-info').textContent = p ? `المتوفر بالمخزن المصدر: ${num(compute().qty(p.id, $('#t-from').value))}` : ''; }
function saveTransfer() {
  const p = findProductByLabel($('#t-prod').value);
  const from = $('#t-from').value, to = $('#t-to').value, q = N($('#t-qty').value);
  if (!p) return toast('اختاروا منتج', true);
  if (from === to) return toast('اختاروا مخزنين مختلفين', true);
  if (q <= 0) return toast('الكمية غير صحيحة', true);
  if (q > compute().qty(p.id, from)) return toast('الكمية أكبر من المتوفر', true);
  db.moves.push({ id: uid(), ts: Date.now(), date: $('#t-date').value || today(), type: 'transfer', pid: p.id, from, to, qty: q });
  save(); closeModal(); render(); toast('تم التحويل ✓');
}
function deleteMove(id) {
  const test = { ...db, moves: db.moves.filter(m => m.id !== id) };
  const neg = negativeAfter(test);
  if (neg) return toast(`ما بنقدر نحذفها: «${neg}» رح يصير بالسالب`, true);
  if (!confirm('حذف هذه الحركة؟')) return;
  db.moves = test.moves; save(); render(); toast('تم الحذف');
}
function openWarehouseForm(id) {
  const w = id ? W(id) : {};
  openModal(id ? 'تعديل مخزن' : 'مخزن جديد', `
    <label class="f"><span>اسم المخزن</span><input id="w-name" value="${esc(w.name)}" placeholder="مثلاً: البيت، المحل، مخزن أمي"></label>
    <div class="modal-foot"><button class="btn btn-primary" onclick="saveWarehouse('${id || ''}')">حفظ</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    ${id && db.warehouses.length > 1 ? `<span style="flex:1"></span><button class="btn btn-danger" onclick="deleteWarehouse('${id}')">حذف</button>` : ''}</div>`);
  setTimeout(() => $('#w-name')?.focus(), 50);
}
function saveWarehouse(id) {
  const name = $('#w-name').value.trim(); if (!name) return toast('اكتبوا الاسم', true);
  if (id) W(id).name = name; else db.warehouses.push({ id: uid(), name });
  save(); closeModal(); render(); toast('تم الحفظ ✓');
}
function deleteWarehouse(id) {
  const used = db.purchases.some(r => r.wid === id) || db.sales.some(r => r.wid === id) || db.moves.some(m => m.wid === id || m.from === id || m.to === id);
  if (used) return toast('المخزن مستخدم بفواتير/حركات — ما بنقدر نحذفه', true);
  db.warehouses = db.warehouses.filter(w => w.id !== id); save(); closeModal(); render();
}

/* ---------- المصاريف ---------- */
function openExpenseForm(id) {
  const e = id ? db.expenses.find(x => x.id === id) : {};
  openModal(id ? 'تعديل مصروف' : '🧾 مصروف جديد', `
    <div class="form-grid two">
      <label class="f"><span>التاريخ</span><input id="e-date" type="date" value="${e.date || today()}"></label>
      <label class="f"><span>النوع</span><select id="e-type">${opts(db.settings.expenseTypes, e.type)}</select></label>
      <label class="f"><span>المبلغ</span><input id="e-amt" type="number" min="0" step="any" value="${e.amount ?? ''}"></label>
      <label class="f"><span>ملاحظة</span><input id="e-note" value="${esc(e.note)}"></label>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" onclick="saveExpense('${id || ''}')">حفظ</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
      ${id ? `<span style="flex:1"></span><button class="btn btn-danger" onclick="deleteExpense('${id}')">حذف</button>` : ''}</div>`);
}
function saveExpense(id) {
  const amt = N($('#e-amt').value); if (amt <= 0) return toast('اكتبوا المبلغ', true);
  const data = { date: $('#e-date').value || today(), type: $('#e-type').value, amount: amt, note: $('#e-note').value.trim() };
  if (id) Object.assign(db.expenses.find(x => x.id === id), data); else db.expenses.push({ id: uid(), ...data });
  save(); closeModal(); render(); toast('تم الحفظ ✓');
}
function deleteExpense(id) { if (!confirm('حذف المصروف؟')) return; db.expenses = db.expenses.filter(x => x.id !== id); save(); closeModal(); render(); }

/* ---------- بيانات تجريبية ---------- */
function loadDemo() {
  if ((db.products.length || db.sales.length) && !confirm('البيانات التجريبية رح تستبدل البيانات الحالية. متأكدين؟')) return;
  db = defaultDB();
  db.warehouses.push({ id: 'w-shop', name: 'المحل' });
  const mk = (name, category, size, color, price) => { const p = { id: uid(), sku: nextSku(), name, category, size, color, price, minQty: 2, createdAt: today() }; db.products.push(p); return p; };
  const ps = [
    mk('فستان صيفي مورّد', 'نسائي', 'M', 'زهري', 120), mk('فستان صيفي مورّد', 'نسائي', 'L', 'زهري', 120),
    mk('عباية كريب', 'نسائي', 'مقاس واحد', 'أسود', 180), mk('بلوزة شيفون', 'نسائي', 'S', 'بيج', 75),
    mk('طقم بناتي توتو', 'أطفال - بنات', '4-5 سنوات', 'ليلكي', 65), mk('بيجامة قطن', 'أطفال - بنات', '2-3 سنوات', 'وردي', 45),
    mk('طقم ولادي جينز', 'أطفال - أولاد', '6 سنوات', 'أزرق', 70), mk('أفرول مواليد', 'بيبي', '0-3 أشهر', 'أبيض', 35),
    mk('شنطة كتف', 'إكسسوارات', '', 'نيود', 55), mk('توكة شعر لؤلؤ', 'إكسسوارات', '', 'ذهبي', 15),
  ];
  const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return localISO(x); };
  let ts = 1;
  const buy = (days, wid, sup, lines, ship) => {
    const items = allocate(lines.map(([i, q, u]) => ({ pid: ps[i].id, qty: q, unit: u })), ship, 'value');
    db.purchases.push({ id: uid(), no: db.seq.purchase++, ts: ts++, date: d(days), supplier: sup, wid, method: 'value', feeShip: ship, feeCustoms: 0, feeOther: 0, fees: ship, goods: sum(items, i => i.qty * i.unit), items });
  };
  buy(170, 'w-main', 'مورد تركيا', [[0, 10, 55], [1, 8, 55], [2, 6, 90], [3, 12, 30]], 120);
  buy(120, 'w-main', 'مصنع محلي', [[4, 15, 25], [5, 20, 18], [6, 10, 30], [7, 20, 12]], 80);
  buy(60, 'w-shop', 'مورد الصين', [[8, 15, 20], [9, 40, 4], [0, 6, 52], [2, 4, 88]], 150);
  buy(15, 'w-main', 'مورد تركيا', [[3, 8, 31], [4, 10, 26], [5, 10, 18]], 60);
  const names = ['أم محمد', 'سارة', 'رنا', 'هبة', 'لينا', 'دعاء', 'نور', 'ريم', 'آلاء', 'منى'];
  const chs = ['إنستغرام', 'واتساب', 'فيسبوك', 'المحل', 'تيك توك'];
  const c0 = () => compute();
  for (let k = 0; k < 70; k++) {
    const days = Math.floor(165 - k * 2.3);
    const wid = k % 4 === 0 ? 'w-shop' : 'w-main';
    const items = [];
    const n = 1 + (k % 3 === 0 ? 1 : 0);
    for (let j = 0; j < n; j++) {
      const p = ps[(k * 7 + j * 3) % ps.length];
      cache = null;
      const av = c0().qty(p.id, wid) - sum(items.filter(i => i.pid === p.id), i => i.qty);
      const pAvail = db.purchases.some(r => r.date <= d(days) && r.wid === wid && r.items.some(i => i.pid === p.id));
      if (av >= 1 && pAvail) items.push({ pid: p.id, qty: 1, price: p.price });
    }
    if (!items.length) continue;
    db.sales.push({ id: uid(), no: db.seq.sale++, ts: ts++, date: d(days), customer: names[k % names.length], phone: '', channel: chs[k % chs.length], wid, isReturn: false,
      discount: k % 5 === 0 ? 10 : 0, deliveryIn: wid === 'w-main' ? 0 : 0, deliveryOut: k % 6 === 0 ? 15 : 0, items });
    cache = null;
  }
  const exp = [['إعلانات', 60], ['تغليف', 20], ['مواصلات', 15]];
  for (let m = 0; m < 6; m++) exp.forEach(([type, amount], i) => db.expenses.push({ id: uid(), date: d(m * 30 + i * 5 + 2), type, amount, note: '' }));
  save(); location.hash = '#dashboard'; render(); toast('تم تحميل بيانات تجريبية 🌸');
}

/* ---------- تشغيل ---------- */
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
