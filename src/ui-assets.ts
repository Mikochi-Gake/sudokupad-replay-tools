export const UI_HTML = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Sudoku Replay Desk</title>
  <link rel="stylesheet" href="/app.css">
</head>
<body>
  <main class="shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">LOCAL · PRIVATE · UNOFFICIAL</p>
        <h1>数独复盘桌</h1>
        <p class="lede">把 SudokuPad 回放放下来，看看刚才那一盘发生了什么。</p>
      </div>
      <div class="local-badge"><span></span>只在本机处理</div>
    </header>

    <section id="drop-zone" class="drop-zone" tabindex="0" role="button" aria-describedby="drop-hint">
      <input id="file-input" type="file" accept=".replay,application/json" hidden>
      <div class="sudoku-mark" aria-hidden="true"></div>
      <div class="drop-copy">
        <strong id="drop-title">拖入 .replay 文件</strong>
        <span id="drop-hint">或者点这里选择文件 · 最大 8 MiB</span>
      </div>
    </section>

    <section id="workspace" class="workspace" hidden>
      <div class="file-row">
        <div><span class="file-label">当前回放</span><strong id="file-name"></strong></div>
        <button id="replace-file" class="text-button" type="button">换一份</button>
      </div>

      <nav class="modes" aria-label="复盘模式">
        <button type="button" data-mode="mistakes" class="active">错误与回退</button>
        <button type="button" data-mode="summary">快速检查</button>
        <button type="button" data-mode="speed">提速线索</button>
        <button type="button" data-mode="export">导出给 Chat</button>
      </nav>

      <div id="status" class="status" role="status" aria-live="polite"></div>
      <div id="result" class="result"></div>
    </section>

    <footer>文件不会离开这台电脑。关闭启动窗口后，本地页面也会停止。</footer>
  </main>
  <script src="/app.js" defer></script>
</body>
</html>`;

export const UI_CSS = String.raw`:root {
  --paper: #f6f8fa;
  --surface: #ffffff;
  --ink: #17233b;
  --muted: #607089;
  --grid: #a9b7c9;
  --line: #d9e1ea;
  --blue: #315efb;
  --blue-soft: #edf1ff;
  --error: #d94f5c;
  --error-soft: #fff0f1;
  --success: #12866f;
  --success-soft: #e8f7f3;
  --shadow: 0 18px 50px rgba(36, 55, 84, .10);
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background: var(--paper);
  font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
}
button, input { font: inherit; }
button { color: inherit; }
.shell { width: min(920px, calc(100% - 32px)); margin: 0 auto; padding: 52px 0 28px; }
.masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 28px; margin-bottom: 28px; }
.eyebrow { margin: 0 0 8px; color: var(--blue); font: 700 12px/1.2 "Cascadia Mono", monospace; letter-spacing: .11em; }
h1 { margin: 0; font: 700 clamp(32px, 6vw, 52px)/1 "Bahnschrift", "Segoe UI", sans-serif; letter-spacing: -.035em; }
.lede { margin: 14px 0 0; color: var(--muted); font-size: 16px; }
.local-badge { display: flex; align-items: center; gap: 8px; white-space: nowrap; color: var(--success); font-size: 13px; font-weight: 650; padding-top: 8px; }
.local-badge span { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 5px var(--success-soft); }

.drop-zone {
  min-height: 260px;
  display: grid;
  grid-template-columns: 150px 1fr;
  align-items: center;
  gap: 48px;
  padding: 48px 64px;
  border: 2px dashed var(--grid);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: border-color .18s ease, transform .18s ease, background .18s ease;
}
.drop-zone:hover, .drop-zone.dragging, .drop-zone:focus-visible { border-color: var(--blue); background: #fbfcff; transform: translateY(-2px); outline: none; }
.sudoku-mark {
  width: 150px;
  aspect-ratio: 1;
  border: 3px solid var(--ink);
  background-color: #fff;
  background-image:
    linear-gradient(to right, transparent 32.6%, var(--ink) 32.6%, var(--ink) 34%, transparent 34%, transparent 65.9%, var(--ink) 65.9%, var(--ink) 67.3%, transparent 67.3%),
    linear-gradient(to bottom, transparent 32.6%, var(--ink) 32.6%, var(--ink) 34%, transparent 34%, transparent 65.9%, var(--ink) 65.9%, var(--ink) 67.3%, transparent 67.3%),
    repeating-linear-gradient(to right, transparent 0, transparent calc(11.111% - 1px), var(--grid) calc(11.111% - 1px), var(--grid) 11.111%),
    repeating-linear-gradient(to bottom, transparent 0, transparent calc(11.111% - 1px), var(--grid) calc(11.111% - 1px), var(--grid) 11.111%);
}
.drop-copy { display: flex; flex-direction: column; gap: 10px; }
.drop-copy strong { font: 650 24px/1.2 "Bahnschrift", "Segoe UI", sans-serif; }
.drop-copy span { color: var(--muted); }

.workspace { margin-top: 22px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); box-shadow: var(--shadow); overflow: hidden; }
.file-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 22px; border-bottom: 1px solid var(--line); }
.file-row > div { min-width: 0; display: flex; align-items: baseline; gap: 12px; }
.file-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
.text-button { border: 0; background: transparent; color: var(--blue); cursor: pointer; padding: 6px 2px; font-weight: 650; }
.modes { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--line); }
.modes button { border: 0; border-right: 1px solid var(--line); background: #fbfcfd; padding: 14px 10px; cursor: pointer; font-weight: 650; }
.modes button:last-child { border-right: 0; }
.modes button.active { color: var(--blue); background: var(--blue-soft); box-shadow: inset 0 -3px var(--blue); }
.modes button:focus-visible, .text-button:focus-visible, .primary:focus-visible, .secondary:focus-visible { outline: 3px solid rgba(49, 94, 251, .25); outline-offset: 2px; }
.status { min-height: 0; }
.status:not(:empty) { padding: 12px 22px; color: var(--muted); background: #fbfcfd; border-bottom: 1px solid var(--line); }
.status.error { color: var(--error); background: var(--error-soft); }
.result { min-height: 230px; padding: 26px 22px 30px; }
.empty { display: grid; place-items: center; min-height: 170px; color: var(--muted); text-align: center; }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
.metric { padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: #fbfcfd; }
.metric span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 7px; }
.metric strong { font: 650 22px/1 "Cascadia Mono", monospace; }
h2 { margin: 0 0 16px; font: 650 21px/1.2 "Bahnschrift", "Segoe UI", sans-serif; }
.list { display: grid; gap: 10px; }
.event { display: grid; grid-template-columns: 90px 1fr auto; gap: 14px; align-items: center; padding: 13px 14px; border-left: 3px solid var(--grid); background: #f8fafc; border-radius: 4px 10px 10px 4px; }
.event.error-event { border-left-color: var(--error); background: var(--error-soft); }
.event time, .mono { font-family: "Cascadia Mono", monospace; }
.event small { display: block; margin-top: 4px; }
.event small, .note { color: var(--muted); }
.pill { padding: 4px 8px; border-radius: 999px; background: var(--blue-soft); color: var(--blue); font-size: 12px; font-weight: 700; }
.ok-panel { padding: 20px; border: 1px solid #bfe6dc; background: var(--success-soft); border-radius: 12px; color: #0d6756; }
.warning { padding: 14px; border: 1px solid #f1c4c8; background: var(--error-soft); border-radius: 10px; color: #9e3540; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
.primary, .secondary { border-radius: 9px; padding: 11px 16px; cursor: pointer; font-weight: 700; }
.primary { border: 1px solid var(--blue); color: white; background: var(--blue); }
.secondary { border: 1px solid var(--line); background: white; }
.check-row { display: flex; align-items: center; gap: 8px; color: var(--muted); }
footer { margin-top: 20px; color: var(--muted); text-align: center; font-size: 12px; }

@media (max-width: 680px) {
  .shell { padding-top: 28px; }
  .masthead { display: block; }
  .local-badge { margin-top: 14px; }
  .drop-zone { grid-template-columns: 1fr; justify-items: center; text-align: center; gap: 24px; padding: 36px 24px; }
  .sudoku-mark { width: 120px; }
  .modes { grid-template-columns: repeat(2, 1fr); }
  .modes button:nth-child(2) { border-right: 0; }
  .modes button:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .event { grid-template-columns: 76px 1fr; }
  .event .pill { grid-column: 2; justify-self: start; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
}`;

export const UI_JS = String.raw`(() => {
  const dropZone = document.querySelector('#drop-zone');
  const input = document.querySelector('#file-input');
  const workspace = document.querySelector('#workspace');
  const fileName = document.querySelector('#file-name');
  const status = document.querySelector('#status');
  const result = document.querySelector('#result');
  const modes = [...document.querySelectorAll('[data-mode]')];
  let review = null;
  let activeMode = 'mistakes';
  let currentFile = null;

  function formatTime(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return minutes + ':' + seconds;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function metric(label, value) {
    const box = el('div', 'metric');
    box.append(el('span', '', label), el('strong', '', value));
    return box;
  }

  function heading(text) {
    return el('h2', '', text);
  }

  function renderSummary() {
    const data = review.summary;
    const grid = el('div', 'metrics');
    grid.append(
      metric('用时', formatTime(data.durationMs)),
      metric('动作', String(data.actionCount)),
      metric('盘面', data.metadata.rows + '×' + data.metadata.cols),
      metric('最终错格', data.hasSolution ? String(data.finalSolutionMismatchCount) : '未知')
    );
    result.append(grid);
    result.append(heading(data.metadata.title || '未命名题目'));
    const details = el('div', 'list');
    details.append(el('div', 'event', '作者：' + (data.metadata.author || '未记录')));
    details.append(el('div', 'event', 'SudokuPad ' + data.metadata.appVersion + ' · ' + data.metadata.format + ' / ' + data.metadata.compression));
    data.warnings.forEach(item => details.append(el('div', 'warning', item.message)));
    result.append(details);
  }

  function renderMistakes() {
    const mistakes = review.mistakes;
    const rollbacks = review.rollbacks;
    result.append(heading('错误输入'));
    if (!review.summary.hasSolution) {
      result.append(el('div', 'warning', '这份回放没有内嵌答案，无法判断某次输入是否正确。仍可查看撤销与重做。'));
    } else if (mistakes.length === 0) {
      result.append(el('div', 'ok-panel', '没有发现原始错填。undo / redo 恢复出来的中间状态不会被重复算成新错误。'));
    } else {
      const list = el('div', 'list');
      mistakes.forEach(item => {
        const row = el('div', 'event error-event');
        row.append(el('time', '', formatTime(item.timestampMs)));
        const copy = el('div');
        copy.append(el('strong', '', item.cell + ' 填了 ' + item.entered + '，答案是 ' + item.solution));
        const resolution = item.resolution
          ? ' · ' + formatTime(item.resolution.elapsedMs) + ' 后通过 ' + item.resolution.via + ' 改变'
          : ' · 此后没有移除';
        copy.append(el('small', '', '动作 #' + item.action + resolution));
        row.append(copy, el('span', 'pill', '错填'));
        list.append(row);
      });
      result.append(list);
    }
    result.append(heading('撤销与重做'));
    if (rollbacks.length === 0) result.append(el('p', 'note', '这一盘没有记录到撤销或重做。'));
    else {
      const list = el('div', 'list');
      rollbacks.slice(0, 30).forEach(item => {
        const text = item.type === 'ud'
          ? '撤销动作 ' + item.undoes.map(value => '#' + value).join(', ')
          : '重做动作 ' + item.redoes.map(value => '#' + value).join(', ');
        const row = el('div', 'event');
        row.append(el('time', '', formatTime(item.timestampMs)), el('div', '', text), el('span', 'pill', '#' + item.action));
        list.append(row);
      });
      result.append(list);
    }
  }

  function renderSpeed() {
    const data = review.speedClues;
    const grid = el('div', 'metrics');
    grid.append(
      metric('有效动作', String(data.meaningfulActions)),
      metric('填数动作', String(data.valueActions)),
      metric('候选动作', String(data.candidateActions)),
      metric('选格占比', Math.round(data.selectionShare * 100) + '%')
    );
    result.append(grid, heading('最长思考间隔'));
    const list = el('div', 'list');
    data.longestGaps.forEach(item => {
      const row = el('div', 'event');
      const where = item.affectedCells.length ? item.affectedCells.join(', ') : item.type;
      row.append(el('time', '', formatTime(item.timestampMs)), el('div', '', where + ' · 动作 #' + item.action), el('span', 'pill', formatTime(item.gapMs)));
      list.append(row);
    });
    result.append(list, el('p', 'note', '这里显示的是两次盘面推进之间的时间，只能提示可能的扫描或推理瓶颈，不能单独证明你使用了哪种技巧。'));
  }

  function downloadReview(includeSelection) {
    const payload = JSON.parse(JSON.stringify(review));
    if (includeSelection !== payload.timeline.includedSelection) {
      status.textContent = '若要包含选格动作，请重新勾选后解析；当前先导出默认精简版本。';
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const base = (currentFile?.name || 'replay').replace(/\.replay$/i, '');
    link.href = URL.createObjectURL(blob);
    link.download = base + '.review.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function copyPrompt() {
    const prompt = '请分析我附上的 SudokuPad .review.json：先总结错填与回退，再根据最长推进间隔和候选编辑给出提速建议。不要仅凭停顿时间臆测具体技巧；如果需要判断技巧，请告诉我还需要哪张题目截图。';
    try {
      await navigator.clipboard.writeText(prompt);
      status.textContent = '给 Chat 的说明已经复制。把 .review.json 一起上传即可。';
    } catch {
      status.textContent = prompt;
    }
  }

  function renderExport() {
    result.append(heading('交给普通 Chat 继续分析'));
    result.append(el('p', 'note', '导出的 JSON 默认去掉纯选格动作，保留时间、盘面变化、错填和 undo / redo 关系。文件仍然只在本机生成。'));
    const actions = el('div', 'actions');
    const download = el('button', 'primary', '下载 .review.json');
    download.type = 'button';
    download.addEventListener('click', () => downloadReview(false));
    const copy = el('button', 'secondary', '复制给 Chat 的说明');
    copy.type = 'button';
    copy.addEventListener('click', copyPrompt);
    actions.append(download, copy);
    result.append(actions);
  }

  function render() {
    result.replaceChildren();
    if (!review) return;
    if (activeMode === 'summary') renderSummary();
    else if (activeMode === 'speed') renderSpeed();
    else if (activeMode === 'export') renderExport();
    else renderMistakes();
  }

  async function analyze(file) {
    currentFile = file;
    dropZone.hidden = true;
    workspace.hidden = false;
    fileName.textContent = file.name;
    status.className = 'status';
    status.textContent = '正在拆解回放…';
    result.replaceChildren(el('div', 'empty', '读取动作和重建盘面中'));
    try {
      const response = await fetch('/api/analyze?name=' + encodeURIComponent(file.name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      const payload = await response.json();
      if (!response.ok) throw payload.error || new Error('解析失败');
      review = payload;
      status.textContent = '解析完成 · ' + payload.summary.actionCount + ' 个动作 · ' + formatTime(payload.summary.durationMs);
      render();
    } catch (error) {
      review = null;
      status.className = 'status error';
      if (error && error.code === 'UNSUPPORTED_PUZZLE_ENCODING') {
        status.textContent = '这份回放使用 SCL / Penpa 一类的题目编码，当前版本还不能重建盘面和答案。';
      } else {
        status.textContent = '没有读懂这份回放：' + (error && error.message ? error.message : String(error));
      }
      result.replaceChildren(el('div', 'empty', '你可以换一份 .replay 文件再试。'));
    }
  }

  function choose() { input.click(); }
  dropZone.addEventListener('click', choose);
  dropZone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); }
  });
  input.addEventListener('change', () => input.files?.[0] && analyze(input.files[0]));
  document.querySelector('#replace-file').addEventListener('click', choose);
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  }));
  dropZone.addEventListener('drop', event => event.dataTransfer?.files?.[0] && analyze(event.dataTransfer.files[0]));
  modes.forEach(button => button.addEventListener('click', () => {
    activeMode = button.dataset.mode;
    modes.forEach(item => item.classList.toggle('active', item === button));
    render();
  }));
})();`;
