// @ts-check
const fs = require('fs');
const path = require('path');

class CustomHtmlReporter {
  constructor(options = {}) {
    this.outputFolder = options.outputFolder || './tests/reports/html-report';
    this.results = [];
    this.startTime = null;
    this.endTime = null;
    this.suiteName = options.title || 'Playwright Test Report';
  }

  onBegin(config, suite) {
    this.startTime = new Date();
    this.config = config;
    this.rootSuite = suite;
  }

  onTestEnd(test, result) {
    this.results.push({
      title: test.title,
      file: test.location.file ? path.basename(test.location.file) : 'unknown',
      filePath: test.location.file || '',
      line: test.location.line,
      suite: test.parent?.title || '',
      project: test.parent?.project()?.name || 'default',
      status: result.status,
      duration: result.duration,
      retries: result.retry,
      errors: result.errors.map(e => ({
        message: e.message || '',
        stack: e.stack || '',
        snippet: e.snippet || '',
      })),
      steps: result.steps.map(s => ({
        title: s.title,
        category: s.category,
        duration: s.duration,
        error: s.error ? s.error.message : null,
      })),
      annotations: test.annotations || [],
    });
  }

  async onEnd(result) {
    this.endTime = new Date();
    const totalDuration = this.endTime - this.startTime;

    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const flaky = this.results.filter(r => r.status === 'passed' && r.retries > 0).length;
    const timedOut = this.results.filter(r => r.status === 'timedOut').length;
    const total = this.results.length;

    // Group by project
    const byProject = {};
    for (const r of this.results) {
      if (!byProject[r.project]) byProject[r.project] = [];
      byProject[r.project].push(r);
    }

    // Group by file
    const byFile = {};
    for (const r of this.results) {
      if (!byFile[r.file]) byFile[r.file] = [];
      byFile[r.file].push(r);
    }

    const html = this._generateHtml({
      title: this.suiteName,
      startTime: this.startTime,
      endTime: this.endTime,
      totalDuration,
      passed,
      failed,
      skipped,
      flaky,
      timedOut,
      total,
      results: this.results,
      byProject,
      byFile,
      overallStatus: result.status,
    });

    const outputDir = path.resolve(this.outputFolder);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');
    console.log(`\n  Custom HTML report written to ${path.join(outputDir, 'index.html')}\n`);
  }

  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(0);
    return `${mins}m ${secs}s`;
  }

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _statusIcon(status) {
    const map = {
      passed: '✅',
      failed: '❌',
      skipped: '⏭️',
      timedOut: '⏱️',
      interrupted: '🚫',
    };
    return map[status] || '❓';
  }

  _statusClass(status) {
    const map = {
      passed: 'status-passed',
      failed: 'status-failed',
      skipped: 'status-skipped',
      timedOut: 'status-timeout',
      interrupted: 'status-failed',
    };
    return map[status] || 'status-unknown';
  }

  _browserIcon(project) {
    const name = project.toLowerCase();
    if (name.includes('chromium') || name.includes('chrome')) return '🌐';
    if (name.includes('firefox')) return '🦊';
    if (name.includes('webkit') || name.includes('safari')) return '🧭';
    if (name.includes('edge')) return '🔷';
    return '🖥️';
  }

  _generateHtml(data) {
    const {
      title, startTime, endTime, totalDuration,
      passed, failed, skipped, flaky, timedOut, total,
      results, byProject, byFile, overallStatus,
    } = data;

    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    const testRowsHtml = results.map((r, i) => {
      const errorsHtml = r.errors.length > 0
        ? `<div class="error-block">${r.errors.map(e =>
          `<pre class="error-message">${this._escapeHtml(e.message)}</pre>`
        ).join('')}</div>`
        : '';

      const stepsHtml = r.steps.length > 0
        ? `<div class="steps-block">
            <div class="steps-toggle" onclick="this.parentElement.classList.toggle('open')">
              <span class="toggle-icon">▶</span> ${r.steps.length} step${r.steps.length > 1 ? 's' : ''}
            </div>
            <div class="steps-list">
              ${r.steps.map(s => `
                <div class="step-item ${s.error ? 'step-error' : ''}">
                  <span class="step-category">${this._escapeHtml(s.category || '')}</span>
                  <span class="step-title">${this._escapeHtml(s.title)}</span>
                  <span class="step-duration">${this._formatDuration(s.duration)}</span>
                </div>
              `).join('')}
            </div>
          </div>`
        : '';

      return `
        <tr class="test-row ${this._statusClass(r.status)}" data-status="${r.status}" data-project="${r.project}" data-file="${r.file}">
          <td class="cell-index">${i + 1}</td>
          <td class="cell-status"><span class="badge badge-${r.status}">${r.status.toUpperCase()}</span></td>
          <td class="cell-title">
            <div class="test-title">${this._escapeHtml(r.title)}</div>
            <div class="test-meta">${this._escapeHtml(r.file)}:${r.line}</div>
            ${errorsHtml}
            ${stepsHtml}
          </td>
          <td class="cell-project"><span class="project-badge">${this._browserIcon(r.project)} ${this._escapeHtml(r.project)}</span></td>
          <td class="cell-duration">${this._formatDuration(r.duration)}</td>
          <td class="cell-retry">${r.retries > 0 ? `<span class="retry-badge">${r.retries}</span>` : '—'}</td>
        </tr>
      `;
    }).join('');

    const projectTabsHtml = Object.entries(byProject).map(([proj, tests]) => {
      const pPassed = tests.filter(t => t.status === 'passed').length;
      const pFailed = tests.filter(t => t.status === 'failed').length;
      return `
        <div class="project-card" onclick="filterByProject('${this._escapeHtml(proj)}')">
          <div class="project-icon">${this._browserIcon(proj)}</div>
          <div class="project-name">${this._escapeHtml(proj)}</div>
          <div class="project-stats">
            <span class="mini-passed">${pPassed} ✓</span>
            ${pFailed > 0 ? `<span class="mini-failed">${pFailed} ✗</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${this._escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-primary: #0f0f14;
      --bg-secondary: #16161e;
      --bg-card: #1c1c27;
      --bg-hover: #22222f;
      --border: #2a2a3a;
      --text-primary: #e4e4ef;
      --text-secondary: #8888a0;
      --text-muted: #55556a;
      --accent: #7c6af4;
      --accent-light: #9d8ff7;
      --green: #3dd68c;
      --green-bg: rgba(61, 214, 140, 0.1);
      --red: #f4556c;
      --red-bg: rgba(244, 85, 108, 0.1);
      --yellow: #f4c542;
      --yellow-bg: rgba(244, 197, 66, 0.1);
      --blue: #56b4f9;
      --blue-bg: rgba(86, 180, 249, 0.1);
      --radius: 12px;
      --radius-sm: 8px;
      --shadow: 0 4px 24px rgba(0,0,0,0.3);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      border-bottom: 1px solid var(--border);
      padding: 32px 40px;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(124, 106, 244, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }
    .header h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 6px;
    }
    .header-meta {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      color: var(--text-secondary);
      font-size: 13px;
    }
    .header-meta span { display: flex; align-items: center; gap: 5px; }
    .overall-badge {
      display: inline-block;
      margin-left: 12px;
      padding: 2px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .overall-passed { background: var(--green-bg); color: var(--green); }
    .overall-failed { background: var(--red-bg); color: var(--red); }

    /* Container */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 28px 40px 60px;
    }

    /* Summary cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .summary-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .summary-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
    .summary-value {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.2;
    }
    .summary-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .card-total .summary-value { color: var(--accent-light); }
    .card-passed .summary-value { color: var(--green); }
    .card-failed .summary-value { color: var(--red); }
    .card-skipped .summary-value { color: var(--yellow); }
    .card-duration .summary-value { color: var(--blue); font-size: 28px; }
    .card-rate .summary-value { color: var(--green); }

    /* Donut chart */
    .chart-section {
      display: flex;
      gap: 24px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }
    .donut-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      min-width: 220px;
    }
    .donut-wrapper {
      position: relative;
      width: 160px;
      height: 160px;
    }
    .donut-wrapper svg { transform: rotate(-90deg); }
    .donut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    .donut-center .rate { font-size: 28px; font-weight: 700; color: var(--green); }
    .donut-center .rate-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; }
    .donut-legend {
      display: flex;
      gap: 16px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    /* Project cards */
    .projects-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      flex: 1;
    }
    .project-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      flex: 1;
      min-width: 160px;
    }
    .project-card:hover, .project-card.active {
      border-color: var(--accent);
      background: var(--bg-hover);
      box-shadow: 0 0 0 1px var(--accent);
    }
    .project-icon { font-size: 28px; margin-bottom: 6px; }
    .project-name { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
    .project-stats { font-size: 12px; color: var(--text-secondary); }
    .mini-passed { color: var(--green); margin-right: 6px; }
    .mini-failed { color: var(--red); }

    /* Toolbar */
    .toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 7px 16px;
      border-radius: 20px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover { border-color: var(--accent); color: var(--text-primary); }
    .filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .search-input {
      background: var(--bg-card);
      border: 1px solid var(--border);
      color: var(--text-primary);
      padding: 7px 16px;
      border-radius: 20px;
      font-size: 13px;
      flex: 1;
      min-width: 200px;
      outline: none;
      transition: border 0.2s;
    }
    .search-input::placeholder { color: var(--text-muted); }
    .search-input:focus { border-color: var(--accent); }

    /* Table */
    .table-wrapper {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      background: var(--bg-secondary);
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      font-weight: 600;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    tbody tr {
      border-bottom: 1px solid var(--border);
      transition: background 0.15s;
    }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: var(--bg-hover); }
    td {
      padding: 14px 16px;
      font-size: 14px;
      vertical-align: top;
    }
    .cell-index { width: 40px; color: var(--text-muted); font-size: 12px; }
    .cell-status { width: 100px; }
    .cell-project { width: 140px; }
    .cell-duration { width: 90px; text-align: right; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .cell-retry { width: 60px; text-align: center; }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .badge-passed { background: var(--green-bg); color: var(--green); }
    .badge-failed { background: var(--red-bg); color: var(--red); }
    .badge-skipped { background: var(--yellow-bg); color: var(--yellow); }
    .badge-timedOut { background: var(--red-bg); color: var(--yellow); }
    .project-badge {
      display: inline-block;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      padding: 2px 10px;
      border-radius: 6px;
      font-size: 12px;
    }
    .retry-badge {
      background: var(--yellow-bg);
      color: var(--yellow);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }

    /* Test details */
    .test-title { font-weight: 600; margin-bottom: 2px; }
    .test-meta { font-size: 12px; color: var(--text-muted); }

    /* Error block */
    .error-block { margin-top: 10px; }
    .error-message {
      background: var(--red-bg);
      border: 1px solid rgba(244, 85, 108, 0.2);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      font-size: 12px;
      color: var(--red);
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      line-height: 1.5;
    }

    /* Steps block */
    .steps-block { margin-top: 10px; }
    .steps-toggle {
      font-size: 12px;
      color: var(--accent-light);
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .steps-toggle:hover { color: var(--accent); }
    .toggle-icon {
      display: inline-block;
      transition: transform 0.2s;
      font-size: 10px;
    }
    .steps-block.open .toggle-icon { transform: rotate(90deg); }
    .steps-list {
      display: none;
      margin-top: 8px;
      padding-left: 12px;
      border-left: 2px solid var(--border);
    }
    .steps-block.open .steps-list { display: block; }
    .step-item {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 3px 0;
      font-size: 12px;
      color: var(--text-secondary);
    }
    .step-item.step-error { color: var(--red); }
    .step-category {
      background: var(--bg-secondary);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .step-title { flex: 1; }
    .step-duration { color: var(--text-muted); font-variant-numeric: tabular-nums; }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--text-muted);
    }
    .empty-state .icon { font-size: 48px; margin-bottom: 12px; }

    /* Footer */
    .footer {
      text-align: center;
      padding: 20px;
      color: var(--text-muted);
      font-size: 12px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header { padding: 20px; }
      .container { padding: 16px; }
      .summary-grid { grid-template-columns: repeat(3, 1fr); }
      .cell-project, .cell-retry { display: none; }
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .summary-card, .project-card, .donut-card {
      animation: fadeIn 0.4s ease-out both;
    }
    .summary-card:nth-child(2) { animation-delay: 0.05s; }
    .summary-card:nth-child(3) { animation-delay: 0.1s; }
    .summary-card:nth-child(4) { animation-delay: 0.15s; }
    .summary-card:nth-child(5) { animation-delay: 0.2s; }
    .summary-card:nth-child(6) { animation-delay: 0.25s; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-content">
      <h1>
        🎭 ${this._escapeHtml(title)}
        <span class="overall-badge ${overallStatus === 'passed' ? 'overall-passed' : 'overall-failed'}">
          ${overallStatus === 'passed' ? '● All Passed' : '● Has Failures'}
        </span>
      </h1>
      <div class="header-meta">
        <span>📅 ${startTime.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
        <span>🕐 ${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} → ${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
        <span>⏱️ Duration: <strong>${this._formatDuration(totalDuration)}</strong></span>
      </div>
    </div>
  </div>

  <div class="container">

    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card card-total">
        <div class="summary-value">${total}</div>
        <div class="summary-label">Total Tests</div>
      </div>
      <div class="summary-card card-passed">
        <div class="summary-value">${passed}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-card card-failed">
        <div class="summary-value">${failed}</div>
        <div class="summary-label">Failed</div>
      </div>
      <div class="summary-card card-skipped">
        <div class="summary-value">${skipped}</div>
        <div class="summary-label">Skipped</div>
      </div>
      <div class="summary-card card-duration">
        <div class="summary-value">${this._formatDuration(totalDuration)}</div>
        <div class="summary-label">Duration</div>
      </div>
      <div class="summary-card card-rate">
        <div class="summary-value">${passRate}%</div>
        <div class="summary-label">Pass Rate</div>
      </div>
    </div>

    <!-- Chart + Projects row -->
    <div class="chart-section">
      <!-- Donut Chart -->
      <div class="donut-card">
        ${this._generateDonut(passed, failed, skipped, timedOut, total, passRate)}
        <div class="donut-legend">
          <div class="legend-item"><span class="legend-dot" style="background:var(--green)"></span> Passed</div>
          <div class="legend-item"><span class="legend-dot" style="background:var(--red)"></span> Failed</div>
          ${skipped > 0 ? '<div class="legend-item"><span class="legend-dot" style="background:var(--yellow)"></span> Skipped</div>' : ''}
          ${timedOut > 0 ? '<div class="legend-item"><span class="legend-dot" style="background:var(--blue)"></span> Timed Out</div>' : ''}
        </div>
      </div>

      <!-- Browsers / Projects -->
      <div class="projects-row">
        ${projectTabsHtml}
      </div>
    </div>

    <!-- Filters -->
    <div class="toolbar">
      <button class="filter-btn active" onclick="filterByStatus('all')">All (${total})</button>
      <button class="filter-btn" onclick="filterByStatus('passed')">✅ Passed (${passed})</button>
      <button class="filter-btn" onclick="filterByStatus('failed')">❌ Failed (${failed})</button>
      ${skipped > 0 ? `<button class="filter-btn" onclick="filterByStatus('skipped')">⏭️ Skipped (${skipped})</button>` : ''}
      <input class="search-input" type="text" placeholder="🔍  Search tests..." oninput="searchTests(this.value)" />
    </div>

    <!-- Test Results Table -->
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Status</th>
            <th>Test</th>
            <th>Browser</th>
            <th style="text-align:right">Duration</th>
            <th style="text-align:center">Retry</th>
          </tr>
        </thead>
        <tbody id="testTableBody">
          ${testRowsHtml || `
            <tr><td colspan="6">
              <div class="empty-state">
                <div class="icon">🧪</div>
                <div>No test results found</div>
              </div>
            </td></tr>
          `}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated by Custom Playwright Reporter &nbsp;·&nbsp; ${startTime.toISOString()}
    </div>
  </div>

  <script>
    // Filtering
    let currentStatus = 'all';
    let currentProject = 'all';
    let currentSearch = '';

    function applyFilters() {
      const rows = document.querySelectorAll('.test-row');
      rows.forEach(row => {
        const status = row.dataset.status;
        const project = row.dataset.project;
        const text = row.textContent.toLowerCase();
        const matchStatus = currentStatus === 'all' || status === currentStatus;
        const matchProject = currentProject === 'all' || project === currentProject;
        const matchSearch = !currentSearch || text.includes(currentSearch.toLowerCase());
        row.style.display = (matchStatus && matchProject && matchSearch) ? '' : 'none';
      });
    }

    function filterByStatus(status) {
      currentStatus = status;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      applyFilters();
    }

    function filterByProject(project) {
      currentProject = currentProject === project ? 'all' : project;
      document.querySelectorAll('.project-card').forEach(c => c.classList.remove('active'));
      if (currentProject !== 'all') {
        event.target.closest('.project-card').classList.add('active');
      }
      applyFilters();
    }

    function searchTests(query) {
      currentSearch = query;
      applyFilters();
    }
  </script>

</body>
</html>`;
  }

  _generateDonut(passed, failed, skipped, timedOut, total, passRate) {
    if (total === 0) {
      return `<div class="donut-wrapper">
        <div class="donut-center">
          <div class="rate">—</div>
          <div class="rate-label">No tests</div>
        </div>
      </div>`;
    }

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const segments = [
      { count: passed, color: 'var(--green)' },
      { count: failed, color: 'var(--red)' },
      { count: skipped, color: 'var(--yellow)' },
      { count: timedOut, color: 'var(--blue)' },
    ].filter(s => s.count > 0);

    let offset = 0;
    const circles = segments.map(seg => {
      const pct = seg.count / total;
      const dashLen = pct * circumference;
      const dashGap = circumference - dashLen;
      const circle = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${seg.color}" stroke-width="16" stroke-dasharray="${dashLen} ${dashGap}" stroke-dashoffset="${-offset}" stroke-linecap="round" opacity="0.9"/>`;
      offset += dashLen;
      return circle;
    }).join('');

    return `<div class="donut-wrapper">
      <svg viewBox="0 0 160 160" width="160" height="160">
        <circle cx="80" cy="80" r="${radius}" fill="none" stroke="var(--border)" stroke-width="16"/>
        ${circles}
      </svg>
      <div class="donut-center">
        <div class="rate">${passRate}%</div>
        <div class="rate-label">Pass Rate</div>
      </div>
    </div>`;
  }
}

module.exports = CustomHtmlReporter;
