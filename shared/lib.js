/* ============================================================
   공통 헬퍼 라이브러리 — 모든 챕터 페이지가 <script src> 로 로드.
   전역 네임스페이스 VZ 에 함수 제공.
   ============================================================ */
(function (global) {
  'use strict';

  // ---- 숫자 포맷 ----
  const fmt = (n, d = 2) => {
    if (!isFinite(n)) return '∞';
    const r = Number(n).toFixed(d);
    return Object.is(parseFloat(r), -0) ? (0).toFixed(d) : r;
  };

  // ---- 벡터/행렬 연산 ----
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  // 행벡터 v(1×n) × 행렬 W(n×m) → out(1×m).  out_j = Σ_i v_i·W[i][j]
  const vecMat = (v, W) => W[0].map((_, j) => +v.reduce((s, x, i) => s + x * W[i][j], 0).toFixed(4));
  // 행렬 A(p×n) × 행렬 B(n×m) → (p×m)
  const matMul = (A, B) =>
    A.map(row => B[0].map((_, j) => +row.reduce((s, x, k) => s + x * B[k][j], 0).toFixed(4)));
  const transpose = M => M[0].map((_, j) => M.map(r => r[j]));

  // ---- softmax (수치 안정 버전) ----
  const softmax = (arr) => {
    const m = Math.max(...arr);
    const ex = arr.map(x => Math.exp(x - m));
    const s = ex.reduce((a, b) => a + b, 0) || 1;
    return ex.map(e => e / s);
  };

  // ---- 색상 팔레트 (단어/시리즈용) ----
  const PALETTE = ['#60a5fa', '#fbbf24', '#94a3b8', '#34d399', '#f472b6', '#c084fc', '#fb7185', '#37bdf8'];

  /* ============================================================
     mxMatrix: 행렬을 대괄호+라벨+shape 로 그리는 HTML 문자열 생성
     data    : 2차원 배열
     opts:
       rowLabs : 좌측 행 라벨 배열 (string, HTML 허용)
       colLabs : 상단 열 라벨 배열
       acc     : 대괄호 색 (CSS color / var)
       title   : 상단 제목
       shape   : 하단 shape 텍스트 (예 '[4×3]')
       hlRow   : 강조할 행 인덱스 (-1=없음)
       hlCol   : 강조할 열 인덱스
       pct     : true면 값을 ×100 정수%로 표시
       fmtCell : (v,r,c)=>string  커스텀 셀 포맷
       zeroDim : true면 0을 흐리게(zero 클래스)
     ============================================================ */
  function mxMatrix(data, opts = {}) {
    const {
      rowLabs = [], colLabs = [], acc = 'var(--line)', title = '', shape = '',
      hlRow = -1, hlCol = -1, pct = false, fmtCell = null, zeroDim = false
    } = opts;
    const cols = data[0].length;
    const tmpl = `grid-template-columns:repeat(${cols},50px)`;
    const head = colLabs.length
      ? `<div class="mx-colhead" style="${tmpl}">${colLabs.map(c => `<div class="h">${c}</div>`).join('')}</div>`
      : '';
    const grid = `<div class="mx-grid" style="${tmpl}">` +
      data.map((row, r) => row.map((v, c) => {
        const cls = [
          'mx-cell',
          (r === hlRow || c === hlCol) ? 'hl' : '',
          (zeroDim && v === 0) ? 'zero' : ''
        ].filter(Boolean).join(' ');
        const txt = fmtCell ? fmtCell(v, r, c) : (pct ? Math.round(v * 100) : fmt(v));
        return `<div class="${cls}">${txt}</div>`;
      }).join('')).join('') + `</div>`;
    const rl = rowLabs.length
      ? `<div class="mx-rowlabs ${colLabs.length ? 'head-pad' : ''}">${rowLabs.map(l => `<div class="mx-rowlab">${l}</div>`).join('')}</div>`
      : '';
    return `<div class="mx" style="--acc:${acc}">${title ? `<div class="mx-title">${title}</div>` : ''}
      <div class="mx-body">${rl}<div class="mx-colwrap">${head}<div class="mx-bracket">${grid}</div></div></div>
      ${shape ? `<div class="mx-shape">${shape}</div>` : ''}</div>`;
  }

  // op 연결 (A × B = C 형태)
  function opRow(parts, ops) {
    // parts: HTML 배열, ops: 사이에 들어갈 기호 배열(parts.length-1)
    let html = '<div class="mx-op-row">';
    parts.forEach((p, i) => {
      html += p;
      if (i < ops.length) html += `<div class="mx-bigop">${ops[i]}</div>`;
    });
    return html + '</div>';
  }

  /* ============================================================
     스텝퍼: 버튼들로 패널 전환
     containerSel: 스텝 버튼 컨테이너, panelSel: 패널 셀렉터
     버튼 data-s 와 패널 data-panel 매칭
     ============================================================ */
  function setupStepper(stepperSel = '#stepper', panelSel = '[data-panel]') {
    const stepper = document.querySelector(stepperSel);
    if (!stepper) return;
    const panels = [...document.querySelectorAll(panelSel)];
    stepper.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = b.dataset.s;
      stepper.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      panels.forEach(p => p.classList.toggle('show', p.dataset.panel === s));
      const top = stepper.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }

  /* ============================================================
     뷰 토글: 두 컨테이너 사이를 전환 (single ⇄ tensor 등)
     toggleSel 안의 button[data-v] 클릭 → views[data-v] 만 표시
     onShow(v) 콜백으로 지연 렌더 가능
     ============================================================ */
  function setupViewToggle(toggleSel, views, onShow) {
    const toggle = document.querySelector(toggleSel);
    if (!toggle) return;
    const shown = {};
    toggle.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const v = b.dataset.v;
      toggle.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      if (onShow && !shown[v]) { onShow(v); shown[v] = true; }
      Object.keys(views).forEach(key => {
        const el = document.querySelector(views[key]);
        if (el) el.style.display = (key === v) ? '' : 'none';
      });
    });
  }

  /* ============================================================
     상단 네비 마운트: 허브 링크 + 챕터 배지
     el: 컨테이너, badge: 'CH 02 · Tensor' 등
     ============================================================ */
  function mountTopnav(sel, badge) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.innerHTML =
      `<a class="home" href="index.html">← 목차로</a><span class="chapbadge">${badge}</span>`;
  }

  // 가로 막대 행 (barrow) HTML
  function barRow(label, frac, { win = false, color = null, pctText = null } = {}) {
    const c = color || (win ? 'var(--hot)' : 'var(--q)');
    return `<div class="barrow ${win ? 'win' : ''}">
      <div class="bw">${label}${win ? ' 🏆' : ''}</div>
      <div class="track"><div class="fill" style="width:${(frac * 100).toFixed(1)}%;background:${c}"></div></div>
      <div class="pct">${pctText != null ? pctText : (frac * 100).toFixed(1) + '%'}</div>
    </div>`;
  }

  global.VZ = {
    fmt, dot, vecMat, matMul, transpose, softmax, PALETTE,
    mxMatrix, opRow, setupStepper, setupViewToggle, mountTopnav, barRow
  };
})(window);

/* ============================================================
   선형대수 2D 시각화 엔진 (VZ.LA) — 모든 챕터 공유
   좌표계: 원점 중앙, y는 위가 양수. 행렬 M=[[a,c],[b,d]] (열=기저상 î,ĵ).
   점 변환:  x' = a·x + c·y,  y' = b·x + d·y
   ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;

  // 좌표계 보드: unit = 1단위당 픽셀
  function board(opts = {}) {
    const { W = 360, H = 360, unit = 40 } = opts;
    const cx = W / 2, cy = H / 2;
    return {
      W, H, unit, cx, cy,
      X: x => cx + x * unit,        // 수학 x → svg px
      Y: y => cy - y * unit,        // 수학 y → svg px (뒤집기)
    };
  }
  // 2×2 행렬 M 을 점 [x,y] 에 적용
  const apply = (M, x, y) => [M[0][0] * x + M[0][1] * y, M[1][0] * x + M[1][1] * y];
  // 항등→목표 보간 (t: 0~1)
  const lerpM = (M, t) => {
    const I = [[1, 0], [0, 1]];
    return [[I[0][0] + (M[0][0] - I[0][0]) * t, I[0][1] + (M[0][1] - I[0][1]) * t],
            [I[1][0] + (M[1][0] - I[1][0]) * t, I[1][1] + (M[1][1] - I[1][1]) * t]];
  };
  const det = M => M[0][0] * M[1][1] - M[0][1] * M[1][0];

  // 변형된 격자선 path (정수선 -R..R). M 적용한 두 끝점을 직선으로 잇는다.
  function gridPaths(b, M, R = 6, opts = {}) {
    const { color = 'rgba(255,255,255,.10)', axisColor = 'rgba(255,255,255,.28)', sw = 1 } = opts;
    let p = '';
    const line = (x1, y1, x2, y2, c, w) => {
      const [ax, ay] = apply(M, x1, y1), [bx, by] = apply(M, x2, y2);
      p += `<line x1="${b.X(ax).toFixed(1)}" y1="${b.Y(ay).toFixed(1)}" x2="${b.X(bx).toFixed(1)}" y2="${b.Y(by).toFixed(1)}" stroke="${c}" stroke-width="${w}"/>`;
    };
    for (let k = -R; k <= R; k++) {
      if (k === 0) continue;
      line(k, -R, k, R, color, sw);   // 세로선 x=k
      line(-R, k, R, k, color, sw);   // 가로선 y=k
    }
    // 변형된 축 (x축 y=0, y축 x=0)
    line(-R, 0, R, 0, axisColor, 1.5);
    line(0, -R, 0, R, axisColor, 1.5);
    return p;
  }

  // 벡터 화살표 (수학좌표 vx,vy)
  function arrow(b, vx, vy, color, label, opts = {}) {
    const { lw = 2.5, dot = false } = opts;
    const x2 = b.X(vx), y2 = b.Y(vy);
    const id = 'ah' + Math.round(Math.abs(vx * 97 + vy * 131)) + color.replace(/[^a-z0-9]/gi, '');
    let s = `<defs><marker id="${id}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
      <path d="M0,0 L9,4.5 L0,9 Z" fill="${color}"/></marker></defs>`;
    s += `<line x1="${b.cx}" y1="${b.cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${lw}" marker-end="url(#${id})"/>`;
    if (dot) s += `<circle cx="${x2}" cy="${y2}" r="3.5" fill="${color}"/>`;
    if (label) s += `<text x="${x2 + (vx >= 0 ? 8 : -8)}" y="${y2 - 8}" fill="${color}" font-size="13" font-weight="700" font-family="JetBrains Mono" text-anchor="${vx >= 0 ? 'start' : 'end'}">${label}</text>`;
    return s;
  }

  // 전체 변환 보드 SVG: 격자 + 기저벡터 î,ĵ + (선택) 단위정사각형/점
  // M: 2×2, opts.shape:'square'면 변형 단위정사각형 음영, opts.pts:[[x,y,color,label]...]
  function transformSVG(b, M, opts = {}) {
    const { showBasis = true, shape = 'square', pts = [], R = 6, gridColor } = opts;
    let s = `<svg width="${b.W}" height="${b.H}" viewBox="0 0 ${b.W} ${b.H}" style="max-width:100%;display:block">`;
    s += gridPaths(b, M, R, gridColor ? { color: gridColor } : {});
    // 변형된 단위 정사각형 (0,0)-(1,0)-(1,1)-(0,1)
    if (shape === 'square') {
      const c = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => apply(M, x, y));
      const poly = c.map(([x, y]) => `${b.X(x).toFixed(1)},${b.Y(y).toFixed(1)}`).join(' ');
      const fill = det(M) < 0 ? 'rgba(251,113,133,.18)' : 'rgba(55,189,248,.16)';
      s += `<polygon points="${poly}" fill="${fill}" stroke="none"/>`;
    }
    if (showBasis) {
      const i = apply(M, 1, 0), j = apply(M, 0, 1);
      s += arrow(b, i[0], i[1], 'var(--q)', 'î');
      s += arrow(b, j[0], j[1], 'var(--k)', 'ĵ');
    }
    pts.forEach(([x, y, color, label]) => {
      const [px, py] = apply(M, x, y);
      s += arrow(b, px, py, color || 'var(--hot)', label, { dot: true });
    });
    s += `</svg>`;
    return s;
  }

  // 보간 애니메이션: from(기본=항등)→M 으로 cb(curM) 반복 호출. dur ms.
  // 반환: 취소 함수 — 재호출 전에 이전 핸들을 호출하면 중복 실행/깜빡임을 막는다.
  // from 을 직전 단계 행렬로 주면 단계 누적 애니메이션(예: SVD Vᵀ→ΣVᵀ→A)이 된다.
  function animateTo(M, cb, dur = 800, done, from = null) {
    const A = from || [[1, 0], [0, 1]];
    const lp = t => [[A[0][0] + (M[0][0] - A[0][0]) * t, A[0][1] + (M[0][1] - A[0][1]) * t],
                     [A[1][0] + (M[1][0] - A[1][0]) * t, A[1][1] + (M[1][1] - A[1][1]) * t]];
    const t0 = performance.now();
    let cancelled = false, raf = 0;
    function frame(now) {
      if (cancelled) return;
      let t = Math.min(1, (now - t0) / dur);
      t = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
      cb(lp(t));
      if (t < 1) raf = requestAnimationFrame(frame); else if (done) done();
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }

  VZ.LA = { board, apply, lerpM, det, gridPaths, arrow, transformSVG, animateTo };
})(window);
