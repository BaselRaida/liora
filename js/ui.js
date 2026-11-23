'use strict';
/* ================= ليورا — الواجهة العامة ================= */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  dress: '<path d="M9 3h6l-1.2 4.5L18 21H6l4.2-13.5z"/><path d="M10.5 7.5h3"/>',
  box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  store: '<path d="M3 21V9l9-6 9 6v12"/><path d="M8 21v-7h8v7"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};
const icon = k => `<svg viewBox="0 0 24 24">${ICONS[k]}</svg>`;

const VIEWS = {
  dashboard: { t: 'الرئيسية', i: 'home', r: () => vDashboard(), m: true },
  products: { t: 'المنتجات', i: 'dress', r: () => vProducts(), m: true },
  purchases: { t: 'إدخال بضاعة', i: 'box', r: () => vPurchases(), m: true },
  sales: { t: 'المبيعات', i: 'bag', r: () => vSales(), m: true },
  stock: { t: 'المخازن والجرد', i: 'store', r: () => vStock() },
  expenses: { t: 'المصاريف', i: 'receipt', r: () => vExpenses() },
  reports: { t: 'التقارير والأرباح', i: 'chart', r: () => vReports(), m: true },
  settings: { t: 'الإعدادات', i: 'gear', r: () => vSettings() },
};

function currentView() { const k = location.hash.slice(1).split('?')[0]; return VIEWS[k] ? k : 'dashboard'; }

function renderNav() {
  const cur = currentView();
  $('#nav').innerHTML = Object.entries(VIEWS).map(([k, v]) =>
    `<a class="nav-item ${k === cur ? 'active' : ''}" href="#${k}">${icon(v.i)}<span>${v.t}</span></a>`).join('');
  $('#bottomNav').innerHTML = Object.entries(VIEWS).filter(([, v]) => v.m).map(([k, v]) =>
    `<a class="${k === cur ? 'active' : ''}" href="#${k}">${icon(v.i)}<span>${v.t.split(' ')[0]}</span></a>`).join('') +
    `<a class="${['stock', 'expenses', 'settings'].includes(cur) ? 'active' : ''}" href="javascript:openMore()">${icon('gear')}<span>المزيد</span></a>`;
}

function openMore() {
  openModal('المزيد', `<div class="grid" style="gap:8px">${['stock', 'expenses', 'settings'].map(k =>
    `<a class="nav-item" href="#${k}" onclick="closeModal()">${icon(VIEWS[k].i)}<span>${VIEWS[k].t}</span></a>`).join('')}</div>`);
}

function render() {
  const k = currentView();
  $('#pageTitle').textContent = VIEWS[k].t;
  $('#shopName').textContent = db.settings.shop || 'إدارة المخزون';
  document.title = `${VIEWS[k].t} · ${db.settings.shop || 'ليورا'}`;
  renderNav();
  $('#view').innerHTML = VIEWS[k].r();
  refreshDatalist();
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

function refreshDatalist() {
  $('#dl-prod').innerHTML = db.products.map(p => `<option value="${esc(pLabel(p))}">`).join('');
}
function findProductByLabel(v) {
  v = (v || '').trim();
  if (!v) return null;
  const m = v.match(/\[([^\]]+)\]\s*$/);
  if (m) return db.products.find(p => p.sku === m[1]) || null;
  return db.products.find(p => p.sku === v || pLabel(p) === v) || null;
}

/* ---------- Modal & toast ---------- */
function openModal(title, body, opts = {}) {
  $('#modal').innerHTML = `<div class="modal-card ${opts.wide ? 'wide' : ''}">
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" onclick="closeModal()">✕</button></div>
    <div class="modal-body">${body}</div></div>`;
  $('#modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() { $('#modal').classList.remove('open'); $('#modal').innerHTML = ''; document.body.style.overflow = ''; }
let toastT;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'toast', 2600);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- Small UI helpers ---------- */
const opts = (arr, sel) => arr.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
const whOpts = sel => opts(db.warehouses.map(w => [w.id, w.name]), sel);
const thumb = p => `<div class="thumb">${p?.img ? `<img src="${p.img}" alt="">` : '👗'}</div>`;
const emptyBox = (emoji, text, btn = '') => `<div class="empty"><span class="big">${emoji}</span>${text}${btn ? `<div style="margin-top:12px">${btn}</div>` : ''}</div>`;
const kpi = (lbl, val, hint = '', cls = '') => `<div class="card kpi ${cls}"><div class="lbl">${lbl}</div><div class="val">${val}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
const signCls = v => v < 0 ? 'neg' : '';

/* ---------- Charts (SVG بدون مكتبات) ---------- */
function barChart(data) {
  const W = 640, H = 230, padT = 14, padB = 30, padX = 8;
  const vals = data.flatMap(d => [d.revenue, d.profit]);
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const range = max - min, plotH = H - padT - padB;
  const y = v => padT + (max - v) / range * plotH;
  const slot = (W - padX * 2) / data.length, bw = Math.min(22, slot / 3.2);
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const v = min + range * i / 3, yy = y(v);
    g += `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke="#F6E4EA" stroke-dasharray="${v === 0 ? '' : '4 4'}"/>`;
  }
  data.forEach((d, i) => {
    // RTL: الأحدث على اليسار → نرسم من اليمين
    const cx = W - padX - slot * i - slot / 2;
    const bar = (v, x, fill) => { const y0 = y(0), y1 = y(v); return `<rect x="${x}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.max(1.5, Math.abs(y1 - y0))}" rx="5" fill="${fill}"><title>${num(v)}</title></rect>`; };
    g += bar(d.revenue, cx + 1, '#E59AB2');
    g += bar(d.profit, cx - bw - 1, d.profit < 0 ? '#D0566B' : '#5B2A4A');
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="12" fill="#9A7E8C" font-family="IBM Plex Sans Arabic">${d.label}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg>
    <div class="legend"><span><i style="background:#E59AB2"></i>المبيعات</span><span><i style="background:#5B2A4A"></i>صافي الربح</span></div></div>`;
}

function hbars(rows) {
  if (!rows.length) return emptyBox('🌷', 'لا يوجد بيانات بعد');
  const max = Math.max(...rows.map(r => Math.abs(r.v)), 1);
  return rows.map(r => `<div class="hbar"><span title="${esc(r.l)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.l)}</span>
    <div class="track"><div class="fill" style="width:${Math.max(2, Math.abs(r.v) / max * 100)}%"></div></div>
    <b style="direction:ltr">${r.t ?? num(r.v)}</b></div>`).join('');
}

/* ---------- Image resize ---------- */
function resizeImage(file, size = 320) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, size / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}

/* ---------- CSV ---------- */
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function toCSV(rows) {
  return '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
}
