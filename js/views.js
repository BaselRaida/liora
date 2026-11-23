'use strict';
/* ================= ليورا — الصفحات ================= */

/* ---------- الرئيسية ---------- */
function vDashboard() {
  const [f, t] = periodRange('month');
  const s = stats(f, t);
  const st = stockSummary();
  const low = lowStock().slice(0, 6);
  const c = compute();
  const recent = [...db.sales].sort((a, b) => (b.date + b.ts) > (a.date + a.ts) ? 1 : -1).slice(0, 6);
  const top = Object.entries(s.byProd).sort((a, b) => b[1].units - a[1].units).slice(0, 5);
  const h = new Date().getHours();
  const greet = h < 12 ? 'صباح الخير' : 'مساء الخير';

  if (!db.products.length) {
    return `<div class="hello"><div><h2>${greet} 🌸</h2><p>أهلاً بكم في ${esc(db.settings.shop)} — خلّينا نبدأ</p></div></div>
    <div class="card">${emptyBox('👗', 'لسا ما في منتجات. ابدؤوا بإضافة أول منتج أو أول فاتورة بضاعة.',
      `<button class="btn btn-primary" onclick="openProductForm()">+ منتج جديد</button>
       <button class="btn btn-soft" onclick="openPurchaseForm()">+ فاتورة بضاعة</button>
       <button class="btn btn-ghost" onclick="loadDemo()">جرّب ببيانات تجريبية</button>`)}</div>`;
  }

  return `
  <div class="hello">
    <div><h2>${greet} 🌸</h2><p>ملخص ${MONTHS[new Date().getMonth()]} — ${esc(db.settings.shop)}</p></div>
    <div class="sp"></div>
    <button class="btn btn-ghost" onclick="openProductForm()">+ منتج</button>
  </div>

  <div class="grid g4 mb">
    ${kpi('مبيعات هذا الشهر', money(s.revenue), `${s.orders} طلب · ${num(s.units)} قطعة`, 'rose')}
    ${kpi('صافي الربح', `<span class="${signCls(s.net)}">${money(s.net)}</span>`, `بعد المصاريف (${money(s.expenses)})`, 'plum')}
    ${kpi('هامش الربح', pct(s.margin), `ربح إجمالي ${money(s.gross)}`)}
    ${kpi('متوسط الطلب', money(s.avgOrder), s.returns ? `${s.returns} مرتجع` : 'بدون مرتجعات')}
  </div>

  <div class="section-title">المخزون الآن</div>
  <div class="grid g4 mb">
    ${kpi('القطع بالمخزون', num(st.units), `${db.products.length} صنف`)}
    ${kpi('قيمة المخزون (تكلفة)', money(st.cost), 'شامل رسوم التوصيل')}
    ${kpi('قيمته بسعر البيع', money(st.retail))}
    ${kpi('الربح المتوقع', `<span class="pos">${money(st.profit)}</span>`, 'لو انباع كله')}
  </div>

  <div class="grid g2 mb">
    <div class="card"><h3>📈 آخر 6 أشهر</h3>${barChart(monthly(6))}</div>
    <div class="card"><h3>⚠️ قارب على النفاد<span class="sp"></span><a class="btn btn-sm btn-ghost" href="#products?low">الكل</a></h3>
      ${low.length ? low.map(p => `<div class="list-row">${thumb(p)}<div class="grow"><div class="t">${esc(pShort(p))}</div><div class="s">${esc(p.category || '')}</div></div>
        <span class="tag ${c.qty(p.id) <= 0 ? 'red' : 'gold'}">${num(c.qty(p.id))} قطعة</span></div>`).join('') : emptyBox('✨', 'كل المنتجات متوفرة')}
    </div>
  </div>

  <div class="grid g2">
    <div class="card"><h3>🛍️ آخر المبيعات<span class="sp"></span><a class="btn btn-sm btn-ghost" href="#sales">الكل</a></h3>
      ${recent.length ? recent.map(r => { const n = saleNums(r); return `<div class="list-row" style="cursor:pointer" onclick="viewSale('${r.id}')">
        <div class="thumb">${r.isReturn ? '↩️' : '🛍️'}</div><div class="grow"><div class="t">${esc(r.customer || 'زبونة')} · #${r.no}</div><div class="s">${fmtDate(r.date)} · ${esc(r.channel || '')}</div></div>
        <div style="text-align:left"><b class="${signCls(n.revenue)}">${money(n.revenue)}</b><div class="s ${signCls(n.profit)}" style="font-size:12px">ربح ${num(n.profit)}</div></div></div>`; }).join('')
        : emptyBox('🛍️', 'لا يوجد مبيعات بعد', `<button class="btn btn-primary" onclick="openSaleForm()">+ أول عملية بيع</button>`)}
    </div>
    <div class="card"><h3>🌟 الأكثر مبيعاً هذا الشهر</h3>
      ${top.length ? top.map(([pid, v]) => { const p = P(pid); return `<div class="list-row">${thumb(p)}<div class="grow"><div class="t">${esc(pShort(p))}</div><div class="s">ربح ${num(v.profit)}</div></div><span class="tag">${num(v.units)} قطعة</span></div>`; }).join('') : emptyBox('🌷', 'لا يوجد مبيعات هذا الشهر')}
    </div>
  </div>`;
}

/* ---------- المنتجات ---------- */
const pf = { q: '', cat: '', wh: '', low: false };
function vProducts() {
  if (location.hash.includes('?low')) { pf.low = true; history.replaceState(null, '', '#products'); }
  const c = compute();
  let list = db.products.filter(p => {
    const hay = `${p.name} ${p.sku} ${p.color} ${p.size} ${p.category} ${p.notes || ''}`.toLowerCase();
    if (pf.q && !hay.includes(pf.q.toLowerCase())) return false;
    if (pf.cat && p.category !== pf.cat) return false;
    if (pf.wh && c.qty(p.id, pf.wh) <= 0) return false;
    if (pf.low && c.qty(p.id) > N(p.minQty ?? 2)) return false;
    return true;
  });
  list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const cards = list.map(p => {
    const q = pf.wh ? c.qty(p.id, pf.wh) : c.qty(p.id);
    const cost = c.avg[p.id] || 0;
    const margin = N(p.price) > 0 && cost > 0 ? (N(p.price) - cost) / N(p.price) * 100 : NaN;
    const perWh = db.warehouses.map(w => `${w.name}: ${num(c.qty(p.id, w.id))}`).join('\n');
    return `<div class="pcard">
      <div class="pimg">${p.img ? `<img src="${p.img}" alt="">` : '<span class="ph">👗</span>'}
        <span class="qty ${q <= N(p.minQty ?? 2) ? 'low' : ''}" title="${esc(perWh)}">${num(q)} قطعة</span></div>
      <div class="pbody">
        <div class="pname">${esc(p.name)}</div>
        <div class="pmeta">${p.category ? `<span class="tag">${esc(p.category)}</span>` : ''}${p.size ? `<span class="tag plum">${esc(p.size)}</span>` : ''}${p.color ? `<span class="tag gold">${esc(p.color)}</span>` : ''}</div>
        <div class="pmeta">${esc(p.sku)}</div>
        <div class="pprice"><span class="sell">${money(N(p.price))}</span>
          <span class="cost">تكلفة ${num(cost)}<br><span class="${margin < 0 ? 'neg' : 'pos'}">هامش ${pct(margin)}</span></span></div>
      </div>
      <div class="pfoot">
        <button class="btn btn-sm btn-soft" onclick="openProductForm('${p.id}')">تعديل</button>
        <button class="btn btn-sm btn-ghost" onclick="openProductForm(null,'${p.id}')" title="نفس المنتج بمقاس/لون مختلف">+ مقاس/لون</button>
      </div></div>`;
  }).join('');
  return `<div class="toolbar">
    <input class="grow" placeholder="🔍 بحث بالاسم، الكود، اللون، المقاس…" value="${esc(pf.q)}" oninput="pf.q=this.value;rerenderKeepFocus(this)">
    <select style="width:auto" onchange="pf.cat=this.value;render()"><option value="">كل التصنيفات</option>${opts(db.settings.categories, pf.cat)}</select>
    <select style="width:auto" onchange="pf.wh=this.value;render()"><option value="">كل المخازن</option>${whOpts(pf.wh)}</select>
    <label class="check"><input type="checkbox" ${pf.low ? 'checked' : ''} onchange="pf.low=this.checked;render()"> النواقص فقط</label>
    <button class="btn btn-primary" onclick="openProductForm()">+ منتج جديد</button>
  </div>
  <div class="pmeta" style="margin:-6px 4px 12px">${list.length} صنف · ${num(sum(list, p => Math.max(0, pf.wh ? c.qty(p.id, pf.wh) : c.qty(p.id))))} قطعة</div>
  ${list.length ? `<div class="pgrid">${cards}</div>` : `<div class="card">${emptyBox('👗', db.products.length ? 'لا يوجد نتائج' : 'لا يوجد منتجات بعد', `<button class="btn btn-primary" onclick="openProductForm()">+ منتج جديد</button>`)}</div>`}`;
}
function rerenderKeepFocus(el) {
  const pos = el.selectionStart, ph = el.placeholder;
  render();
  const n = $$('#view input').find(i => i.placeholder === ph);
  if (n) { n.focus(); n.setSelectionRange(pos, pos); }
}

/* ---------- المشتريات ---------- */
function vPurchases() {
  const list = [...db.purchases].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  const [f, t] = periodRange('month'); const s = stats(f, t);
  return `<div class="grid g3 mb">
    ${kpi('مشتريات هذا الشهر', money(s.purchases), 'بضاعة + رسوم', 'rose')}
    ${kpi('رسوم توصيل/شحن هذا الشهر', money(s.purchaseFees), 'موزّعة على تكلفة القطع')}
    ${kpi('عدد الفواتير الكلي', num(db.purchases.length))}
  </div>
  <div class="card"><h3>📦 فواتير البضاعة<span class="sp"></span><button class="btn btn-primary" onclick="openPurchaseForm()">+ فاتورة بضاعة</button></h3>
  ${list.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>المورد</th><th>المخزن</th><th class="n">القطع</th><th class="n">البضاعة</th><th class="n">الرسوم</th><th class="n">الإجمالي</th><th></th></tr></thead><tbody>
    ${list.map(p => `<tr class="click" onclick="viewPurchase('${p.id}')"><td>${p.no}</td><td>${fmtDate(p.date)}</td><td>${esc(p.supplier || '—')}</td><td>${esc(wName(p.wid))}</td>
      <td class="n">${num(sum(p.items, i => i.qty))}</td><td class="n">${num(p.goods)}</td><td class="n">${num(p.fees)}</td><td class="n"><b>${money(p.goods + p.fees)}</b></td>
      <td class="actions"><span class="tag">عرض</span></td></tr>`).join('')}
  </tbody></table></div>` : emptyBox('📦', 'سجّلوا كل شحنة بضاعة هون — الكمية والتكلفة ورسوم التوصيل، والتطبيق بيوزّع الرسوم على القطع تلقائياً.', `<button class="btn btn-primary" onclick="openPurchaseForm()">+ أول فاتورة</button>`)}
  </div>`;
}

/* ---------- المبيعات ---------- */
const sf = { period: 'month', q: '', from: '', to: '' };
function vSales() {
  const [f, t] = periodRange(sf.period, sf.from, sf.to);
  const s = stats(f, t);
  let list = db.sales.filter(r => r.date >= f && r.date <= t);
  if (sf.q) { const q = sf.q.toLowerCase(); list = list.filter(r => `${r.customer} ${r.phone} ${r.no} ${r.channel} ${r.items.map(i => pLabel(P(i.pid))).join(' ')}`.toLowerCase().includes(q)); }
  list.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  return `${periodBar(sf, 'sf')}
  <div class="grid g4 mb">
    ${kpi('الإيرادات', money(s.revenue), `${s.orders} طلب`, 'rose')}
    ${kpi('تكلفة البضاعة المباعة', money(s.cogs))}
    ${kpi('الربح الإجمالي', `<span class="${signCls(s.gross)}">${money(s.gross)}</span>`, `هامش ${pct(s.margin)}`, 'plum')}
    ${kpi('القطع المباعة', num(s.units), s.returns ? `${s.returns} مرتجع` : '')}
  </div>
  <div class="card"><h3>🛍️ الفواتير<span class="sp"></span>
    <input style="max-width:220px" placeholder="🔍 زبونة، رقم، منتج…" value="${esc(sf.q)}" oninput="sf.q=this.value;rerenderKeepFocus(this)">
    <button class="btn btn-primary" onclick="openSaleForm()">+ بيع</button></h3>
  ${list.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>الزبونة</th><th>القناة</th><th>المنتجات</th><th class="n">المبلغ</th><th class="n">الربح</th></tr></thead><tbody>
    ${list.map(r => { const n = saleNums(r); return `<tr class="click" onclick="viewSale('${r.id}')"><td>${r.no}${r.isReturn ? ' <span class="tag red">مرتجع</span>' : ''}</td><td>${fmtDate(r.date)}</td>
      <td>${esc(r.customer || '—')}</td><td>${r.channel ? `<span class="tag">${esc(r.channel)}</span>` : ''}</td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.items.map(i => `${pShort(P(i.pid))} ×${i.qty}`).join('، '))}</td>
      <td class="n"><b class="${signCls(n.revenue)}">${money(n.revenue)}</b></td><td class="n ${n.profit < 0 ? 'neg' : 'pos'}">${num(n.profit)}</td></tr>`; }).join('')}
  </tbody></table></div>` : emptyBox('🛍️', 'لا يوجد مبيعات بهالفترة', `<button class="btn btn-primary" onclick="openSaleForm()">+ بيع</button>`)}
  </div>`;
}

function periodBar(state, name) {
  const P = [['today', 'اليوم'], ['week', '7 أيام'], ['month', 'هذا الشهر'], ['lastmonth', 'الشهر الماضي'], ['year', 'هذه السنة'], ['all', 'الكل'], ['custom', 'فترة محددة']];
  return `<div class="toolbar"><div class="seg">${P.map(([k, l]) => `<button class="${state.period === k ? 'on' : ''}" onclick="${name}.period='${k}';render()">${l}</button>`).join('')}</div>
    ${state.period === 'custom' ? `<input type="date" style="width:auto" value="${state.from}" onchange="${name}.from=this.value;render()"> ←
      <input type="date" style="width:auto" value="${state.to}" onchange="${name}.to=this.value;render()">` : ''}</div>`;
}

/* ---------- المخازن والجرد ---------- */
const stf = { wh: '', q: '', tab: 'stock' };
function vStock() {
  const c = compute();
  const whCards = db.warehouses.map(w => {
    let u = 0, v = 0;
    for (const p of db.products) { const q = Math.max(0, c.qty(p.id, w.id)); u += q; v += q * (c.avg[p.id] || 0); }
    return `<div class="card kpi"><div class="lbl">🏬 ${esc(w.name)}</div><div class="val">${num(u)} <small class="cur">قطعة</small></div><div class="hint">قيمة ${money(v)}</div>
      <div style="margin-top:10px;display:flex;gap:6px;position:relative;z-index:1"><button class="btn btn-sm btn-ghost" onclick="openWarehouseForm('${w.id}')">تعديل</button></div></div>`;
  }).join('');
  const tabs = `<div class="seg mb">${[['stock', 'الكميات'], ['log', 'سجل الحركات']].map(([k, l]) => `<button class="${stf.tab === k ? 'on' : ''}" onclick="stf.tab='${k}';render()">${l}</button>`).join('')}</div>`;

  let body;
  if (stf.tab === 'stock') {
    const prods = db.products.filter(p => !stf.q || pLabel(p).toLowerCase().includes(stf.q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    body = prods.length ? `<div class="table-wrap"><table><thead><tr><th>المنتج</th>${db.warehouses.map(w => `<th class="n">${esc(w.name)}</th>`).join('')}<th class="n">المجموع</th><th class="n">متوسط التكلفة</th><th class="n">القيمة</th></tr></thead><tbody>
      ${prods.map(p => `<tr><td><div style="display:flex;gap:8px;align-items:center">${thumb(p)}<div><div>${esc(pShort(p))}</div><div class="pmeta">${esc(p.sku)}</div></div></div></td>
        ${db.warehouses.map(w => { const q = c.qty(p.id, w.id); return `<td class="n ${q < 0 ? 'neg' : ''}">${num(q)}</td>`; }).join('')}
        <td class="n"><b>${num(c.qty(p.id))}</b></td><td class="n">${num(c.avg[p.id] || 0)}</td><td class="n">${num(Math.max(0, c.qty(p.id)) * (c.avg[p.id] || 0))}</td></tr>`).join('')}
    </tbody></table></div>` : emptyBox('🏬', 'لا يوجد منتجات');
  } else {
    const KIND = { purchase: ['دخل — شراء', 'green'], sale: ['طلع — بيع', 'red'], return: ['رجع — مرتجع', 'gold'], transfer: ['تحويل', 'plum'], adjust: ['تسوية جرد', 'gold'], opening: ['رصيد افتتاحي', 'green'] };
    let log = [...c.log].filter(l => !stf.wh || l.wid === stf.wh || l.wid2 === stf.wh);
    if (stf.q) log = log.filter(l => (pLabel(P(l.pid)) + l.note).toLowerCase().includes(stf.q.toLowerCase()));
    log.sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));
    body = log.length ? `<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المنتج</th><th>المخزن</th><th class="n">الكمية</th><th>ملاحظة</th><th></th></tr></thead><tbody>
      ${log.slice(0, 400).map(l => `<tr><td>${fmtDate(l.date)}</td><td><span class="tag ${KIND[l.kind][1]}">${KIND[l.kind][0]}</span></td><td>${esc(pShort(P(l.pid)))}</td>
        <td>${esc(wName(l.wid))}${l.wid2 ? ' ← ' + esc(wName(l.wid2)) : ''}</td><td class="n ${l.qty < 0 ? 'neg' : 'pos'}"><b>${l.qty > 0 ? '+' : ''}${num(l.qty)}</b></td>
        <td>${esc(l.note)}</td><td class="actions">${l.moveId ? `<button class="icon-btn" title="حذف" onclick="deleteMove('${l.moveId}')">🗑</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : emptyBox('📋', 'لا يوجد حركات');
  }

  return `<div class="toolbar">
      <button class="btn btn-primary" onclick="openCountForm()">📝 جرد / تسوية كمية</button>
      <button class="btn btn-soft" onclick="openTransferForm()">⇄ تحويل بين المخازن</button>
      <button class="btn btn-ghost" onclick="openWarehouseForm()">+ مخزن جديد</button></div>
    <div class="grid g3 mb">${whCards}</div>
    <div class="card">${tabs}
      <div class="toolbar"><input class="grow" placeholder="🔍 بحث عن منتج…" value="${esc(stf.q)}" oninput="stf.q=this.value;rerenderKeepFocus(this)">
      ${stf.tab === 'log' ? `<select style="width:auto" onchange="stf.wh=this.value;render()"><option value="">كل المخازن</option>${whOpts(stf.wh)}</select>` : ''}</div>
      ${body}</div>`;
}

/* ---------- المصاريف ---------- */
const ef = { period: 'month', from: '', to: '' };
function vExpenses() {
  const [f, t] = periodRange(ef.period, ef.from, ef.to);
  const list = db.expenses.filter(e => e.date >= f && e.date <= t).sort((a, b) => b.date.localeCompare(a.date));
  const s = stats(f, t);
  return `${periodBar(ef, 'ef')}
  <div class="grid g2 mb">
    <div class="card kpi rose"><div class="lbl">مجموع المصاريف</div><div class="val">${money(s.expenses)}</div><div class="hint">إعلانات، تغليف، إيجار… (غير تكلفة البضاعة)</div></div>
    <div class="card"><h3>حسب النوع</h3>${hbars(Object.entries(s.byExpense).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v })))}</div>
  </div>
  <div class="card"><h3>🧾 المصاريف<span class="sp"></span><button class="btn btn-primary" onclick="openExpenseForm()">+ مصروف</button></h3>
  ${list.length ? `<div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>ملاحظة</th><th class="n">المبلغ</th><th></th></tr></thead><tbody>
    ${list.map(e => `<tr class="click" onclick="openExpenseForm('${e.id}')"><td>${fmtDate(e.date)}</td><td><span class="tag">${esc(e.type)}</span></td><td>${esc(e.note || '')}</td><td class="n"><b>${money(N(e.amount))}</b></td><td class="actions"><span class="tag">تعديل</span></td></tr>`).join('')}
  </tbody></table></div>` : emptyBox('🧾', 'لا يوجد مصاريف بهالفترة')}
  </div>`;
}

/* ---------- التقارير ---------- */
const rf = { period: 'month', from: '', to: '' };
function vReports() {
  const [f, t] = periodRange(rf.period, rf.from, rf.to);
  const s = stats(f, t);
  const st = stockSummary();
  const top = Object.entries(s.byProd).sort((a, b) => b[1].revenue - a[1].revenue);
  return `${periodBar(rf, 'rf')}
  <div class="grid g4 mb">
    ${kpi('الإيرادات', money(s.revenue), `${s.orders} طلب · ${num(s.units)} قطعة`, 'rose')}
    ${kpi('صافي الربح', `<span>${money(s.net)}</span>`, `هامش صافي ${pct(s.revenue > 0 ? s.net / s.revenue * 100 : NaN)}`, 'plum')}
    ${kpi('الربح الإجمالي', money(s.gross), `هامش ${pct(s.margin)}`)}
    ${kpi('المشتريات بالفترة', money(s.purchases), `منها رسوم ${num(s.purchaseFees)}`)}
  </div>

  <div class="grid g2 mb">
    <div class="card"><h3>🧮 كشف الأرباح</h3>
      <div class="summary">
        <div class="row"><span>الإيرادات (بعد الخصومات)</span><b>${money(s.revenue)}</b></div>
        <div class="row"><span>− تكلفة البضاعة المباعة</span><b>${money(s.cogs)}</b></div>
        <div class="row"><span>− توصيل على حسابنا</span><b>${money(s.deliveryOut)}</b></div>
        <div class="row" style="font-weight:700"><span>= الربح الإجمالي</span><b>${money(s.gross)}</b></div>
        <div class="row"><span>− المصاريف</span><b>${money(s.expenses)}</b></div>
        <div class="row total"><span>= صافي الربح</span><b class="${signCls(s.net)}">${money(s.net)}</b></div>
      </div>
      <div class="note" style="margin-top:12px">تكلفة كل قطعة = سعر الشراء + حصتها من رسوم التوصيل والشحن، محسوبة بالمتوسط المرجّح.</div>
    </div>
    <div class="card"><h3>📈 آخر 12 شهر</h3>${barChart(monthly(12))}</div>
  </div>

  <div class="grid g2 mb">
    <div class="card"><h3>حسب التصنيف</h3>${hbars(Object.entries(s.byCat).sort((a, b) => b[1].revenue - a[1].revenue).map(([l, v]) => ({ l, v: v.revenue, t: `${num(v.revenue)} · ربح ${num(v.profit)}` })))}</div>
    <div class="card"><h3>حسب قناة البيع</h3>${hbars(Object.entries(s.byChannel).sort((a, b) => b[1].revenue - a[1].revenue).map(([l, v]) => ({ l, v: v.revenue, t: `${num(v.revenue)} · ${v.orders} طلب` })))}</div>
  </div>

  <div class="card mb"><h3>👗 أداء المنتجات<span class="sp"></span><button class="btn btn-sm btn-gold" onclick="exportSalesCSV('${f}','${t}')">⬇ تصدير Excel (CSV)</button></h3>
    ${top.length ? `<div class="table-wrap"><table><thead><tr><th>المنتج</th><th class="n">قطع مباعة</th><th class="n">الإيراد</th><th class="n">الربح</th><th class="n">الهامش</th><th class="n">المتبقي</th></tr></thead><tbody>
      ${top.map(([pid, v]) => `<tr><td><div style="display:flex;gap:8px;align-items:center">${thumb(P(pid))}${esc(pShort(P(pid)))}</div></td><td class="n">${num(v.units)}</td><td class="n">${num(v.revenue)}</td>
        <td class="n ${v.profit < 0 ? 'neg' : 'pos'}">${num(v.profit)}</td><td class="n">${pct(v.revenue ? v.profit / v.revenue * 100 : NaN)}</td><td class="n">${num(compute().qty(pid))}</td></tr>`).join('')}
    </tbody></table></div>` : emptyBox('📊', 'لا يوجد مبيعات بهالفترة')}
  </div>

  <div class="grid g4">
    ${kpi('قطع بالمخزون الآن', num(st.units))}
    ${kpi('قيمة المخزون (تكلفة)', money(st.cost))}
    ${kpi('قيمته بسعر البيع', money(st.retail))}
    ${kpi('ربح متوقع من المخزون', money(st.profit))}
  </div>`;
}

function exportSalesCSV(f, t) {
  const c = compute();
  const rows = [['رقم الفاتورة', 'التاريخ', 'النوع', 'الزبونة', 'القناة', 'المخزن', 'الكود', 'المنتج', 'التصنيف', 'الكمية', 'سعر البيع', 'تكلفة القطعة', 'ربح السطر']];
  db.sales.filter(s => s.date >= f && s.date <= t).sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
    const costs = c.saleCost[s.id] || [];
    s.items.forEach((it, i) => {
      const p = P(it.pid); const sign = s.isReturn ? -1 : 1;
      rows.push([s.no, s.date, s.isReturn ? 'مرتجع' : 'بيع', s.customer || '', s.channel || '', wName(s.wid), p?.sku || '', pShort(p), p?.category || '',
        sign * it.qty, it.price, (costs[i] || 0).toFixed(2), (sign * it.qty * (it.price - (costs[i] || 0))).toFixed(2)]);
    });
  });
  downloadFile(`مبيعات_${f}_${t}.csv`.replace(/0000-00-00|9999-12-31/g, 'all'), toCSV(rows), 'text/csv;charset=utf-8');
}

/* ---------- الإعدادات ---------- */
function vSettings() {
  const s = db.settings;
  const size = new Blob([localStorage.getItem(KEY) || '']).size;
  return `<div class="grid g2">
  <div class="card"><h3>🌸 بيانات المتجر</h3>
    <div class="form-grid two">
      <label class="f span2"><span>اسم المتجر</span><input id="st-shop" value="${esc(s.shop)}"></label>
      <label class="f"><span>العملة</span><input id="st-cur" value="${esc(s.currency)}" placeholder="₪ / د.أ / $"></label>
      <div></div>
      <label class="f span2"><span>التصنيفات (افصلوا بفاصلة)</span><textarea id="st-cats" rows="2">${esc(s.categories.join('، '))}</textarea></label>
      <label class="f span2"><span>قنوات البيع</span><textarea id="st-ch" rows="2">${esc(s.channels.join('، '))}</textarea></label>
      <label class="f span2"><span>أنواع المصاريف</span><textarea id="st-ex" rows="2">${esc(s.expenseTypes.join('، '))}</textarea></label>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" onclick="saveSettings()">حفظ</button></div>
  </div>
  <div class="card"><h3>💾 النسخ الاحتياطي</h3>
    <p class="note">البيانات محفوظة على هذا الجهاز وهذا المتصفح فقط. خذوا نسخة احتياطية بشكل دوري (مثلاً كل أسبوع) واحفظوها على الواتساب أو الدرايف، وبتقدروا تفتحوها على أي جهاز ثاني.</p>
    <p class="pmeta">حجم البيانات الحالي: ${num(size / 1024)} KB · ${db.products.length} منتج · ${db.sales.length} فاتورة بيع · ${db.purchases.length} فاتورة شراء</p>
    <div class="modal-foot">
      <button class="btn btn-primary" onclick="exportBackup()">⬇ تنزيل نسخة احتياطية</button>
      <label class="btn btn-soft">⬆ استرجاع نسخة<input type="file" accept=".json,application/json" hidden onchange="importBackup(this.files[0])"></label>
    </div>
    <div class="section-title">أخرى</div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="loadDemo()">تحميل بيانات تجريبية</button>
      <button class="btn btn-danger" onclick="resetAll()">مسح كل البيانات</button>
    </div>
  </div></div>`;
}
const splitList = v => v.split(/[,،\n]/).map(x => x.trim()).filter(Boolean);
function saveSettings() {
  const s = db.settings;
  s.shop = $('#st-shop').value.trim() || 'ليورا';
  s.currency = $('#st-cur').value.trim() || '₪';
  s.categories = splitList($('#st-cats').value);
  s.channels = splitList($('#st-ch').value);
  s.expenseTypes = splitList($('#st-ex').value);
  save(); render(); toast('تم الحفظ ✓');
}
function exportBackup() {
  downloadFile(`liora-backup-${today()}.json`, JSON.stringify(db), 'application/json');
  db.lastBackup = today(); save();
}
function importBackup(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d.version || !Array.isArray(d.products)) throw 0;
      if (!confirm('استرجاع النسخة رح يستبدل كل البيانات الحالية. متأكدين؟')) return;
      localStorage.setItem(KEY, JSON.stringify(d)); db = load(); cache = null; render(); toast('تم الاسترجاع ✓');
    } catch (e) { toast('الملف غير صالح', true); }
  };
  fr.readAsText(file);
}
function resetAll() {
  if (!confirm('رح ينمسح كل شي (منتجات، فواتير، مصاريف). خذوا نسخة احتياطية أولاً. متأكدين؟')) return;
  if (!confirm('تأكيد أخير: مسح كل البيانات؟')) return;
  db = defaultDB(); save(); location.hash = '#dashboard'; render(); toast('تم المسح');
}
