'use strict';
/* ================= ليورا — البيانات والحسابات ================= */
const KEY = 'liora-db-v1';
const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const localISO = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const today = () => localISO(new Date());
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const N = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num = v => nf.format(Math.round((v || 0) * 100) / 100);
const money = v => `${num(v)} <small class="cur">${esc(db.settings.currency)}</small>`;
const pct = v => isFinite(v) ? nf0.format(v) + '%' : '—';
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const fmtDate = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]} ${y}`; };

function defaultDB() {
  return {
    version: 1,
    settings: {
      shop: 'ليورا',
      currency: '₪',
      categories: ['نسائي', 'بناتي', 'أطفال - بنات', 'أطفال - أولاد', 'بيبي', 'إكسسوارات'],
      channels: ['إنستغرام', 'واتساب', 'فيسبوك', 'تيك توك', 'المحل', 'أخرى'],
      expenseTypes: ['إعلانات', 'تغليف', 'إيجار', 'مواصلات', 'أخرى'],
    },
    warehouses: [{ id: 'w-main', name: 'المخزن الرئيسي' }],
    products: [], purchases: [], sales: [], moves: [], expenses: [],
    seq: { sku: 1001, purchase: 1, sale: 1 },
  };
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.version) { const base = defaultDB(); return { ...base, ...d, settings: { ...base.settings, ...d.settings }, seq: { ...base.seq, ...d.seq } }; }
  } catch (e) { /* ignore */ }
  return defaultDB();
}

let db = load();
let cache = null;

function save() {
  cache = null;
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('⚠️ مساحة التخزين ممتلئة — خففوا الصور أو خذوا نسخة احتياطية', true); }
}

const P = id => db.products.find(p => p.id === id);
const W = id => db.warehouses.find(w => w.id === id);
const wName = id => W(id)?.name || '—';
const pLabel = p => p ? `${p.name}${p.size ? ' · ' + p.size : ''}${p.color ? ' · ' + p.color : ''} [${p.sku}]` : '(منتج محذوف)';
const pShort = p => p ? `${p.name}${p.size ? ' · ' + p.size : ''}${p.color ? ' · ' + p.color : ''}` : '(منتج محذوف)';

/* ---------------------------------------------------------------
   كل الكميات ومتوسط التكلفة تنحسب بإعادة تشغيل الحركات بالترتيب.
   هيك أي تعديل أو حذف لفاتورة قديمة بيصحّح كل شي تلقائياً.
---------------------------------------------------------------- */
function compute(src = db) {
  if (src === db && cache) return cache;
  const stock = {}, avg = {}, saleCost = {}, log = [];
  const add = (pid, wid, q) => { const s = stock[pid] || (stock[pid] = {}); s[wid] = (s[wid] || 0) + q; };
  const tot = pid => Object.values(stock[pid] || {}).reduce((a, b) => a + b, 0);
  const inCost = (pid, q, c) => {
    const q0 = Math.max(0, tot(pid)), a0 = avg[pid] || 0;
    avg[pid] = q0 + q > 0 ? (q0 * a0 + q * c) / (q0 + q) : c;
  };

  const ev = [
    ...src.purchases.map(r => ['p', r]),
    ...src.sales.map(r => ['s', r]),
    ...src.moves.map(r => ['m', r]),
  ].sort((a, b) => a[1].date < b[1].date ? -1 : a[1].date > b[1].date ? 1 : (a[1].ts || 0) - (b[1].ts || 0));

  for (const [k, r] of ev) {
    if (k === 'p') {
      for (const it of r.items) {
        inCost(it.pid, it.qty, it.landed);
        add(it.pid, r.wid, it.qty);
        log.push({ date: r.date, ts: r.ts, kind: 'purchase', pid: it.pid, qty: it.qty, wid: r.wid, note: `فاتورة شراء #${r.no}${r.supplier ? ' — ' + r.supplier : ''}` });
      }
    } else if (k === 's') {
      const sign = r.isReturn ? 1 : -1;
      saleCost[r.id] = r.items.map(it => {
        const c = avg[it.pid] || 0;
        add(it.pid, r.wid, sign * it.qty);
        log.push({ date: r.date, ts: r.ts, kind: r.isReturn ? 'return' : 'sale', pid: it.pid, qty: sign * it.qty, wid: r.wid, note: `${r.isReturn ? 'مرتجع' : 'بيع'} #${r.no}${r.customer ? ' — ' + r.customer : ''}` });
        return c;
      });
    } else if (r.type === 'transfer') {
      add(r.pid, r.from, -r.qty); add(r.pid, r.to, r.qty);
      log.push({ date: r.date, ts: r.ts, kind: 'transfer', pid: r.pid, qty: r.qty, wid: r.from, wid2: r.to, note: r.note || '', moveId: r.id });
    } else {
      if (r.qty > 0 && r.cost > 0) inCost(r.pid, r.qty, r.cost);
      add(r.pid, r.wid, r.qty);
      log.push({ date: r.date, ts: r.ts, kind: r.type, pid: r.pid, qty: r.qty, wid: r.wid, note: r.note || '', moveId: r.id });
    }
  }

  const res = {
    stock, avg, saleCost, log,
    qty: (pid, wid) => wid ? (stock[pid]?.[wid] || 0) : Object.values(stock[pid] || {}).reduce((a, b) => a + b, 0),
  };
  if (src === db) cache = res;
  return res;
}

/* حساب أرقام فاتورة بيع */
function saleNums(s, costs) {
  costs = costs || compute().saleCost[s.id] || [];
  const sub = sum(s.items, it => it.qty * it.price);
  const cg = s.items.reduce((a, it, i) => a + it.qty * (costs[i] || 0), 0);
  const sign = s.isReturn ? -1 : 1;
  const revenue = sign * (sub - N(s.discount)) + N(s.deliveryIn);
  const cogs = sign * cg;
  const profit = revenue - cogs - N(s.deliveryOut);
  const units = sign * sum(s.items, it => it.qty);
  return { sub, revenue, cogs, profit, units };
}

/* توزيع رسوم التوصيل/الشحن على المنتجات */
function allocate(items, fees, method) {
  let m = method;
  const valueBase = sum(items, it => it.qty * it.unit);
  if (m === 'value' && valueBase <= 0) m = 'qty';
  const base = m === 'qty' ? sum(items, it => it.qty) : valueBase;
  return items.map(it => {
    const w = m === 'qty' ? it.qty : it.qty * it.unit;
    const fee = base > 0 ? fees * w / base : 0;
    return { ...it, fee, landed: it.unit + (it.qty > 0 ? fee / it.qty : 0) };
  });
}

/* الفترات الزمنية */
function monthKey(offset = 0) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset); return localISO(d).slice(0, 7); }
function periodRange(key, from, to) {
  const t = today();
  switch (key) {
    case 'today': return [t, t];
    case 'week': { const d = new Date(); d.setDate(d.getDate() - 6); return [localISO(d), t]; }
    case 'month': { const m = monthKey(0); return [m + '-01', m + '-31']; }
    case 'lastmonth': { const m = monthKey(-1); return [m + '-01', m + '-31']; }
    case 'year': return [t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31'];
    case 'custom': return [from || '0000-00-00', to || '9999-12-31'];
    default: return ['0000-00-00', '9999-12-31'];
  }
}

/* تجميع الإحصائيات لفترة */
function stats(from, to) {
  const c = compute();
  const r = { revenue: 0, cogs: 0, deliveryOut: 0, gross: 0, expenses: 0, net: 0, units: 0, orders: 0, returns: 0, purchases: 0, purchaseFees: 0, byProd: {}, byCat: {}, byChannel: {}, byExpense: {} };
  for (const s of db.sales) {
    if (s.date < from || s.date > to) continue;
    const costs = c.saleCost[s.id] || [];
    const n = saleNums(s, costs);
    r.revenue += n.revenue; r.cogs += n.cogs; r.deliveryOut += N(s.deliveryOut); r.units += n.units;
    s.isReturn ? r.returns++ : r.orders++;
    const ch = s.channel || 'أخرى';
    const cr = r.byChannel[ch] || (r.byChannel[ch] = { revenue: 0, profit: 0, orders: 0 });
    cr.revenue += n.revenue; cr.profit += n.profit; if (!s.isReturn) cr.orders++;
    const sign = s.isReturn ? -1 : 1;
    const discRate = n.sub > 0 ? N(s.discount) / n.sub : 0;
    s.items.forEach((it, i) => {
      const rev = sign * it.qty * it.price * (1 - discRate);
      const prof = rev - sign * it.qty * (costs[i] || 0);
      const p = P(it.pid);
      const bp = r.byProd[it.pid] || (r.byProd[it.pid] = { units: 0, revenue: 0, profit: 0 });
      bp.units += sign * it.qty; bp.revenue += rev; bp.profit += prof;
      const cat = p?.category || 'بدون تصنيف';
      const bc = r.byCat[cat] || (r.byCat[cat] = { units: 0, revenue: 0, profit: 0 });
      bc.units += sign * it.qty; bc.revenue += rev; bc.profit += prof;
    });
  }
  for (const e of db.expenses) {
    if (e.date < from || e.date > to) continue;
    r.expenses += N(e.amount);
    r.byExpense[e.type || 'أخرى'] = (r.byExpense[e.type || 'أخرى'] || 0) + N(e.amount);
  }
  for (const p of db.purchases) {
    if (p.date < from || p.date > to) continue;
    r.purchases += p.goods + p.fees; r.purchaseFees += p.fees;
  }
  r.gross = r.revenue - r.cogs - r.deliveryOut;
  r.net = r.gross - r.expenses;
  r.margin = r.revenue > 0 ? r.gross / r.revenue * 100 : NaN;
  r.avgOrder = r.orders > 0 ? r.revenue / r.orders : 0;
  return r;
}

function monthly(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = monthKey(-i);
    const s = stats(m + '-01', m + '-31');
    out.push({ key: m, label: MONTHS[+m.slice(5) - 1], revenue: s.revenue, profit: s.net });
  }
  return out;
}

function stockSummary() {
  const c = compute();
  let units = 0, cost = 0, retail = 0;
  for (const p of db.products) {
    const q = Math.max(0, c.qty(p.id));
    units += q; cost += q * (c.avg[p.id] || 0); retail += q * N(p.price);
  }
  return { units, cost, retail, profit: retail - cost };
}

function lowStock() {
  const c = compute();
  return db.products.filter(p => c.qty(p.id) <= N(p.minQty ?? 2)).sort((a, b) => c.qty(a.id) - c.qty(b.id));
}

function isProductUsed(pid) {
  return db.purchases.some(r => r.items.some(i => i.pid === pid)) ||
    db.sales.some(r => r.items.some(i => i.pid === pid)) ||
    db.moves.some(m => m.pid === pid && m.type !== 'opening');
}

function nextSku() { return 'J' + (db.seq.sku++); }
