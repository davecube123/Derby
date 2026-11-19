// Weight-over-time line chart (single series, inline SVG) with tap/hover tooltip.
// One series => no legend; the section heading names it. Optional dashed target line.

const W = 340;
const H = 170;
const PAD = { l: 40, r: 12, t: 12, b: 26 };

const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @param points [{date:'YYYY-MM-DD', kg:number}] oldest first (2 or more)
 * @param opts { target?: number, fmtDate(dateStr) => string, label: string, targetLabel: string }
 */
export function weightChart(points, opts) {
  const xs = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const values = points.map((p) => p.kg);
  if (opts.target > 0) values.push(opts.target);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = Math.max(hi - lo, 0.1);
  lo -= span * 0.15;
  hi += span * 0.15;
  const x0 = xs[0];
  const x1 = xs[xs.length - 1] === x0 ? x0 + 864e5 : xs[xs.length - 1];
  const X = (t) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const Y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  const ticks = [0, 0.5, 1].map((f) => lo + (hi - lo) * (0.1 + f * 0.8));
  const grid = ticks
    .map((v) => `<line class="ch-grid" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>
      <text class="ch-axis" x="${PAD.l - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${v.toFixed(2)}</text>`)
    .join('');
  const pts = points.map((p, i) => [X(xs[i]), Y(p.kg)]);
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const target = opts.target > 0
    ? `<line class="ch-target" x1="${PAD.l}" x2="${W - PAD.r}" y1="${Y(opts.target).toFixed(1)}" y2="${Y(opts.target).toFixed(1)}"/>
       <text class="ch-target-label" x="${W - PAD.r}" y="${(Y(opts.target) - 5).toFixed(1)}" text-anchor="end">${escAttr(opts.targetLabel)}</text>`
    : '';
  const dots = pts.map(([x, y]) => `<circle class="ch-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`).join('');
  const data = escAttr(JSON.stringify(points.map((p, i) => ({ x: pts[i][0], y: pts[i][1], d: opts.fmtDate(p.date), v: p.kg }))));

  return `<figure class="chart" data-points="${data}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escAttr(opts.label)}">
      ${grid}
      <text class="ch-axis" x="${PAD.l}" y="${H - 6}">${escAttr(opts.fmtDate(points[0].date))}</text>
      <text class="ch-axis" x="${W - PAD.r}" y="${H - 6}" text-anchor="end">${escAttr(opts.fmtDate(points[points.length - 1].date))}</text>
      ${target}
      <path class="ch-line" d="${path}"/>
      ${dots}
      <line class="ch-cross" x1="0" x2="0" y1="${PAD.t}" y2="${H - PAD.b}" visibility="hidden"/>
      <circle class="ch-focus" r="6" visibility="hidden"/>
      <rect class="ch-hit" x="0" y="0" width="${W}" height="${H}"/>
    </svg>
    <div class="ch-tip" hidden></div>
  </figure>`;
}

/** Crosshair + tooltip on hover or tap (nearest point by x). */
export function bindCharts(root) {
  for (const fig of root.querySelectorAll('figure.chart')) {
    const pts = JSON.parse(fig.dataset.points);
    const svg = fig.querySelector('svg');
    const cross = fig.querySelector('.ch-cross');
    const focus = fig.querySelector('.ch-focus');
    const tip = fig.querySelector('.ch-tip');
    const show = (e) => {
      const r = svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * W;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.x - sx) < Math.abs(best.x - sx)) best = p;
      cross.setAttribute('x1', best.x); cross.setAttribute('x2', best.x);
      focus.setAttribute('cx', best.x); focus.setAttribute('cy', best.y);
      cross.setAttribute('visibility', 'visible'); focus.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<strong>${best.v.toFixed(2)} kg</strong><span>${escAttr(best.d)}</span>`;
      const px = (best.x / W) * r.width;
      tip.style.left = `${Math.min(Math.max(px, 50), r.width - 50)}px`;
      tip.style.top = `${(best.y / H) * r.height}px`;
    };
    const hide = () => {
      cross.setAttribute('visibility', 'hidden'); focus.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    // On touch screens lifting the finger also fires pointerleave; keep the tip until the next tap.
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  }
}
