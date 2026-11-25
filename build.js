// braytron.cz static site builder. No dependencies: run with `node build.js`.
// Reads content/posts/*.md and data/tools.json, writes the site into dist/.
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = {
  url: 'https://braytron.cz',
  name: 'Braytron',
  tagline: 'Which AI will replace Creo and AutoCAD?',
  description: 'Weekly tracker of AI CAD tools racing to replace Creo and AutoCAD: parts, feature trees, assemblies, drawings and consistency, scored with sources.',
  publisher: 'Luxxo s. r. o.',
  publisherUrl: 'https://luxxo.sk',
  lang: 'en'
};

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const READINESS = { 1: 'Early', 2: 'Usable', 3: 'Proven' };

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const write = (rel, content) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

function inline(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const ext = /^https?:\/\//.test(href) && !href.startsWith(SITE.url);
    return `<a href="${href}"${ext ? ' rel="noopener"' : ''}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}

function markdown(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.type}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      flushPara(); flushList();
      const lvl = m[1].length;
      const id = m[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${lvl} id="${id}">${inline(m[2])}</h${lvl}>`);
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\d+\.\s+(.*)$/))) {
      flushPara();
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return out.join('\n');
}

// ---------- load content ----------
function loadPosts() {
  const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  const slugs = new Set();
  const posts = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) { fail(`${file}: missing front matter block`); continue; }
    const meta = {};
    for (const l of m[1].split('\n')) {
      const i = l.indexOf(':');
      if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    }
    for (const k of ['title', 'description', 'date']) if (!meta[k]) fail(`${file}: missing "${k}"`);
    if (meta.date && !/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) fail(`${file}: date must be YYYY-MM-DD`);
    if (meta.description && meta.description.length > 170) fail(`${file}: description over 170 characters`);
    const slug = file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    if (!/^[a-z0-9-]+$/.test(slug)) fail(`${file}: file name must be lowercase letters, digits and dashes`);
    if (slugs.has(slug)) fail(`${file}: duplicate slug "${slug}"`);
    slugs.add(slug);
    const body = m[2].trim();
    const words = body.split(/\s+/).length;
    if (words < 250) fail(`${file}: only ${words} words, minimum is 250`);
    posts.push({
      ...meta, slug, words,
      tags: (meta.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      html: markdown(body),
      url: `/news/${slug}/`
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

function loadTools() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tools.json'), 'utf8'));
  const cats = new Set(data.categories.map(c => c.id));
  data.tools.forEach((t, i) => {
    for (const k of ['name', 'category', 'url', 'what', 'bestFor', 'readiness']) if (t[k] === undefined) fail(`tools.json #${i}: missing "${k}"`);
    if (!cats.has(t.category)) fail(`tools.json ${t.name}: unknown category "${t.category}"`);
    if (![1, 2, 3].includes(t.readiness)) fail(`tools.json ${t.name}: readiness must be 1, 2 or 3`);
    if (!/^https:\/\//.test(t.url || '')) fail(`tools.json ${t.name}: url must start with https://`);
  });
  return data;
}

function loadBenchmark() {
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'benchmark.json'), 'utf8'));
  const tests = new Set(b.tests.map(t => t.id));
  const crit = b.criteria.map(c => c.id);
  b.results.forEach((r, i) => {
    if (!b.tools.includes(r.tool)) fail(`benchmark.json result #${i}: tool "${r.tool}" not in tools list`);
    if (!tests.has(r.test)) fail(`benchmark.json result #${i}: unknown test "${r.test}"`);
    for (const c of crit) if (![0, 1, 2].includes(r.scores && r.scores[c])) fail(`benchmark.json result #${i}: score "${c}" must be 0, 1 or 2`);
  });
  return b;
}

function loadTracker() {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tracker.json'), 'utf8'));
  const caps = t.capabilities.map(c => c.id);
  t.candidates.forEach(c => {
    for (const id of caps) {
      const cell = c.cells[id];
      if (!cell) fail(`tracker.json ${c.name}: missing capability "${id}"`);
      else if (!t.statuses[cell.status]) fail(`tracker.json ${c.name}/${id}: unknown status "${cell.status}"`);
      else if ((cell.status === 'yes' || cell.status === 'partial') && !cell.source && !(cell.note && /^Text and sketch/.test(cell.note))) fail(`tracker.json ${c.name}/${id}: "${cell.status}" needs a source`);
    }
    c.points = caps.reduce((s, id) => s + (c.cells[id] ? t.statuses[c.cells[id].status].points : 0), 0);
  });
  t.max = caps.length * 2;
  t.candidates.sort((a, b) => b.points - a.points);
  return t;
}

function trackerTable(t) {
  const mark = (cell) => {
    const st = t.statuses[cell.status];
    const inner = `<span class="mk mk-${cell.status}" aria-hidden="true"></span><span class="st">${esc(st.label)}</span>${cell.note ? `<span class="nt">${esc(cell.note)}</span>` : ''}`;
    return cell.source ? `<a class="cellk" href="${esc(cell.source)}" rel="noopener">${inner}</a>` : `<span class="cellk">${inner}</span>`;
  };
  return `
<div class="track-wrap" tabindex="0" role="region" aria-label="Replacement tracker table">
<table class="track">
  <thead><tr><th scope="col" class="c-tool">Contender</th><th scope="col" class="c-score">Score</th>${t.capabilities.map(c => `<th scope="col" title="${esc(c.why)}">${esc(c.name)}</th>`).join('')}</tr></thead>
  <tbody>${t.candidates.map(c => `
    <tr${c.publisher ? ' class="own"' : ''}>
      <th scope="row" class="c-tool"><a href="${esc(c.url)}"${c.publisher ? '' : ' rel="noopener"'}>${esc(c.name)}</a>${c.publisher ? '<small>From our publisher</small>' : ''}</th>
      <td class="c-score"><span class="score"><b>${c.points}</b>/${t.max}</span><span class="bar"><i style="width:${Math.round(c.points / t.max * 100)}%"></i></span></td>
      ${t.capabilities.map(cap => `<td>${mark(c.cells[cap.id])}</td>`).join('')}
    </tr>`).join('')}
  </tbody>
</table>
</div>`;
}

let SHOW_BENCHMARK = false;

// ---------- templates ----------
function layout({ title, description, canonical, body, jsonld, type = 'website', current = '', noindex = false }) {
  const fullTitle = title ? `${title} | ${SITE.name}` : `${SITE.name}: ${SITE.tagline}`;
  const navItems = [['/', 'Tracker', 'home'], ['/news/', 'News', 'news']];
  if (SHOW_BENCHMARK) navItems.push(['/benchmark/', 'Benchmark', 'benchmark']);
  navItems.push(['/about/', 'About', 'about']);
  const nav = navItems
    .map(([href, label, key]) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="${SITE.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${SITE.url}${canonical}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title || SITE.name)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE.url}${canonical}">
<meta property="og:site_name" content="${SITE.name}">
<meta name="twitter:card" content="summary">
<link rel="alternate" type="application/rss+xml" title="${SITE.name} news" href="/feed.xml">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231F3FB4'/%3E%3Cpath d='M9 8h9a5 5 0 0 1 0 10H9zm0 10h10a5 5 0 0 1 0 10H9z' fill='none' stroke='%23fff' stroke-width='3'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <a class="brand" href="/">Braytron</a>
  <nav aria-label="Main">${nav}</nav>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <p>Braytron tracks which AI will be the first to replace Creo and AutoCAD, updated every week.</p>
  <p>Published by <a href="${SITE.publisherUrl}">${SITE.publisher}</a>, Bratislava. Makers of <a href="https://luxxo.sk/ai-cad/">Luxxo CAD</a>.</p>
  <p><a href="/feed.xml">RSS feed</a> · <a href="/about/">How we rate tools</a></p>
</footer>
</body>
</html>`;
}

const gauge = (n) => `<span class="gauge" data-level="${n}" title="${READINESS[n]}"><i></i><i></i><i></i><span>${READINESS[n]}</span></span>`;

function postList(posts) {
  return `<ol class="posts">${posts.map(p => `
  <li>
    <time datetime="${p.date}">${fmtDate(p.date)}</time>
    <h3><a href="${p.url}">${esc(p.title)}</a></h3>
    <p>${esc(p.description)}</p>
  </li>`).join('')}
</ol>`;
}

function shortlist(data) {
  return data.categories.map(cat => {
    const tools = data.tools.filter(t => t.category === cat.id); // editorial order from tools.json
    return `
<section class="crib" id="${cat.id}" aria-labelledby="h-${cat.id}">
  <div class="crib-head">
    <h3 id="h-${cat.id}">${esc(cat.name)}</h3>
    <p>${esc(cat.intro)}</p>
  </div>
  <ul class="tools">${tools.map(t => `
    <li${t.publisher ? ' class="own"' : ''}>
      <div class="tool-name"><a href="${esc(t.url)}"${t.publisher ? '' : ' rel="noopener"'}>${esc(t.name)}</a>${t.publisher ? '<small>From our publisher</small>' : ''}</div>
      <p class="tool-what">${esc(t.what)}</p>
      <p class="tool-best"><span class="k">Best for</span> ${esc(t.bestFor)}</p>
      ${gauge(t.readiness)}
    </li>`).join('')}
  </ul>
</section>`;
  }).join('');
}

function benchmarkPage(b) {
  const crit = b.criteria;
  const max = crit.length * 2;
  const cell = (tool, test) => b.results.find(r => r.tool === tool && r.test === test);
  const sum = (r) => crit.reduce((s, c) => s + r.scores[c.id], 0);
  const tested = b.tools.filter(t => b.results.some(r => r.tool === t));
  const totals = tested.map(t => {
    const rs = b.results.filter(r => r.tool === t);
    return { tool: t, points: rs.reduce((s, r) => s + sum(r), 0), done: rs.length };
  }).sort((a, x) => x.points - a.points);

  const resultsTable = tested.length ? `
  <h2 id="results">Results</h2>
  <div class="table-wrap"><table class="bench">
    <thead><tr><th scope="col">Tool</th>${b.tests.map(t => `<th scope="col">${esc(t.name)}</th>`).join('')}<th scope="col">Total</th></tr></thead>
    <tbody>${totals.map(({ tool, points, done }) => `<tr><th scope="row">${esc(tool)}</th>${b.tests.map(t => { const r = cell(tool, t.id); return `<td>${r ? `${sum(r)}<small>/${max}</small>` : '<span class="na">Not yet</span>'}</td>`; }).join('')}<td><strong>${points}</strong><small>/${done * max}</small></td></tr>`).join('')}</tbody>
  </table></div>
  ${b.tests.map(t => {
    const rs = b.results.filter(r => r.test === t.id);
    if (!rs.length) return '';
    return `<h3 id="r-${t.id}">${esc(t.name)}</h3>${rs.map(r => `
    <div class="bench-note">
      ${r.image ? `<img src="${esc(r.image)}" alt="${esc(r.tool)} result for the ${esc(t.name.toLowerCase())} test" loading="lazy">` : ''}
      <p><strong>${esc(r.tool)}</strong>: ${sum(r)} of ${max}${r.timeSec ? `, ${r.timeSec} s` : ''}. ${esc(r.notes || '')}</p>
    </div>`).join('')}`;
  }).join('')}` : `<p class="status">${esc(b.status)}</p>`;

  return layout({
    title: b.title, canonical: '/benchmark/', current: 'benchmark', noindex: !SHOW_BENCHMARK,
    description: 'Five real engineering parts, the same prompts, every major text-to-CAD tool. Scored by a mechanical engineer on geometry, dimensions, editability and STEP export.',
    body: `
<article class="post">
  <header>
    <h1>${esc(b.title)}, round ${b.round}</h1>
    <p class="lede">Five ordinary engineering parts, the same prompt in every tool, scored by a mechanical engineer with 17 years of design experience.</p>
  </header>
  <div class="prose">
    <p>Most text-to-CAD comparisons ask for a coffee mug. These tests ask for the parts engineers actually draw every week, with exact dimensions, and check the result in CAD.</p>
    ${resultsTable}
    <h2 id="tests">The five tests</h2>
    <p>Each prompt is pasted unchanged as the first message. No follow-up corrections.</p>
    <ol class="tests">${b.tests.map(t => `<li><strong>${esc(t.name)}</strong><br>${esc(t.prompt)}</li>`).join('')}</ol>
    <h2 id="scoring">How each part is scored</h2>
    <ul>${crit.map(c => `<li><strong>${esc(c.name)}</strong>: ${esc(c.desc)}</li>`).join('')}</ul>
    <p>${esc(b.scale)}</p>
    <p>Tools in this round: ${b.tools.map(esc).join(', ')}. Luxxo CAD is made by Braytron's publisher; it gets the same prompts and the same scoring, and we publish its results whether they are good or bad.</p>
  </div>
</article>`
  });
}

// ---------- build ----------
function build() {
  const posts = loadPosts();
  const tools = loadTools();
  const bench = loadBenchmark();
  const tracker = loadTracker();
  SHOW_BENCHMARK = bench.results.length > 0;
  if (errors.length) {
    console.error('Build failed:\n- ' + errors.join('\n- '));
    process.exit(1);
  }
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const latest = posts[0];
  const leader = tracker.candidates[0];
  const home = `
<section class="hero">
  <h1>Which AI will replace Creo and AutoCAD first?</h1>
  <p class="lede">We test every serious contender against the six things a real CAD replacement has to do, and update the scores every week.</p>
</section>
<section class="tracker" id="tracker" aria-labelledby="h-tracker">
  <div class="verdict">
    <h2 id="h-tracker" class="section-title">Today: no AI does all six</h2>
    <p>The closest is <strong>${esc(leader.name)}</strong> with ${leader.points} of ${tracker.max} points. The pieces exist, but in different tools: parts in one, drawings in another, existing models in a third. The first tool that combines them reliably wins. Updated ${fmtDate(tracker.updated)}.</p>
  </div>
  ${trackerTable(tracker)}
  <p class="legend">Scoring: Yes = 2 points, Partly = 1, everything else 0. Every Yes and Partly links to its source. Consistency is only scored from our own <a href="/about/#tracker">hands-on tests</a>.</p>
  <dl class="caps">${tracker.capabilities.map(c => `<div><dt>${esc(c.name)}</dt><dd>${esc(c.why)}</dd></div>`).join('')}</dl>
</section>
<section class="incumbents" aria-labelledby="h-inc">
  <h2 id="h-inc" class="section-title">What Creo and AutoCAD are doing about it</h2>
  <div class="inc-grid">${tracker.incumbents.map(i => `<div><h3>${esc(i.name)}</h3><p>${esc(i.text)} <a href="${esc(i.source)}" rel="noopener">Source</a></p></div>`).join('')}</div>
</section>
${latest ? `
<section class="lead" aria-labelledby="h-latest">
  <h2 id="h-latest" class="section-title">Latest</h2>
  <article>
    <time datetime="${latest.date}">${fmtDate(latest.date)}</time>
    <h3><a href="${latest.url}">${esc(latest.title)}</a></h3>
    <p>${esc(latest.description)}</p>
  </article>
  ${posts.length > 1 ? postList(posts.slice(1, 5)) : ''}
  <p class="more"><a href="/news/">All news</a></p>
</section>` : ''}
<section class="shortlist" id="shortlist" aria-labelledby="h-shortlist">
  <div class="shortlist-head">
    <h2 id="h-shortlist" class="section-title">Every tool we watch</h2>
    <p>The wider field of ${tools.tools.length} AI tools for 3D, scanning, CAM and simulation. Updated ${fmtDate(tools.updated)}. Readiness: <strong>Early</strong> means promising but rough, <strong>Usable</strong> means it saves time with checking, <strong>Proven</strong> means teams rely on it in production.</p>
  </div>
  ${shortlist(tools)}
</section>`;

  write('index.html', layout({
    title: '', description: SITE.description, canonical: '/', body: home, current: 'home',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, description: SITE.description, publisher: { '@type': 'Organization', name: SITE.publisher, url: SITE.publisherUrl } },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'AI contenders to replace Creo and AutoCAD', itemListElement: tracker.candidates.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: t.url })) }
    ]
  }));

  write('news/index.html', layout({
    title: 'News', description: 'News and analysis on AI tools for 3D modelling, CAD, scanning, CAM and simulation.', canonical: '/news/', current: 'news',
    body: `<section class="archive"><h1>News</h1>${postList(posts)}</section>`
  }));

  for (const p of posts) {
    const idx = posts.indexOf(p);
    const newer = posts[idx - 1], older = posts[idx + 1];
    write(`news/${p.slug}/index.html`, layout({
      title: p.title, description: p.description, canonical: p.url, type: 'article', current: 'news',
      jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date, mainEntityOfPage: SITE.url + p.url, author: { '@type': 'Organization', name: SITE.name, url: SITE.url }, publisher: { '@type': 'Organization', name: SITE.publisher, url: SITE.publisherUrl }, keywords: p.tags.join(', ') },
      body: `
<article class="post">
  <header>
    <time datetime="${p.date}">${fmtDate(p.date)}</time>
    <h1>${esc(p.title)}</h1>
    <p class="lede">${esc(p.description)}</p>
  </header>
  <div class="prose">${p.html}</div>
  ${p.tags.length ? `<p class="tags">Topics: ${p.tags.map(esc).join(', ')}</p>` : ''}
  <nav class="pager" aria-label="More news">
    ${older ? `<a href="${older.url}">Older: ${esc(older.title)}</a>` : '<span></span>'}
    ${newer ? `<a href="${newer.url}">Newer: ${esc(newer.title)}</a>` : ''}
  </nav>
</article>`
    }));
  }

  write('about/index.html', layout({
    title: 'About', description: 'How Braytron scores AI tools on their way to replacing Creo and AutoCAD.', canonical: '/about/', current: 'about',
    body: `
<article class="post">
  <header><h1>About Braytron</h1><p class="lede">One question, tracked every week: which AI tool will be the first to reliably replace Creo or AutoCAD for real engineering work?</p></header>
  <div class="prose">
    <p>AI can already sketch a bracket from a sentence. That is not the same as replacing the CAD system an engineering department runs on. Braytron checks every serious contender against the six things a replacement has to do, links every claim to its source, and tests the tools on real parts.</p>
    <h2 id="tracker">How the tracker scores</h2>
    <ul>
      <li><strong>Yes (2 points)</strong>: the capability is shipped and documented by the vendor or shown in an independent test.</li>
      <li><strong>Partly (1 point)</strong>: it exists but with clear limits, or only for some users.</li>
      <li><strong>Planned, Not verified, No (0 points)</strong>: announced but not shipped, no evidence found yet, or not offered.</li>
      <li><strong>Consistency</strong> is scored only from our own benchmark: five ordinary engineering parts with exact dimensions, the same prompt in every tool.</li>
    </ul>
    <h2 id="ratings">How we rate the wider tool list</h2>
    <ul>
      <li><strong>Early</strong>: research projects, betas and new launches. Worth watching, not worth depending on.</li>
      <li><strong>Usable</strong>: saves real time, but the output needs an engineer to check it.</li>
      <li><strong>Proven</strong>: used in production by many teams, with a track record.</li>
    </ul>
    <h2 id="process">How it is updated</h2>
    <p>Every week new launches and updates are researched from public sources, with the help of AI, and the tracker is updated when something moves. Each claim links to where it came from, so you can check it yourself. The hands-on benchmark tests are run by a mechanical engineer with 17 years of design experience.</p>
    <h2 id="publisher">Who is behind it</h2>
    <p>Braytron is published by <a href="${SITE.publisherUrl}">${SITE.publisher}</a> in Bratislava, Slovakia. We also make <a href="https://luxxo.sk/ai-cad/">Luxxo CAD</a>, which appears in the tracker and is always marked as ours and scored by the same rules. Corrections and tool suggestions: <a href="mailto:info@luxxo.sk">info@luxxo.sk</a>.</p>
  </div>
</article>`
  }));

  write('benchmark/index.html', benchmarkPage(bench));

  write('404.html', layout({ title: 'Page not found', description: 'This page does not exist.', canonical: '/404.html', body: `<section class="archive"><h1>Page not found</h1><p>The page may have moved. Go to the <a href="/">shortlist</a> or browse the <a href="/news/">news</a>.</p></section>` }));

  // RSS
  const rssItems = posts.slice(0, 30).map(p => `<item><title>${esc(p.title)}</title><link>${SITE.url}${p.url}</link><guid>${SITE.url}${p.url}</guid><pubDate>${new Date(p.date + 'T08:00:00Z').toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('');
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE.name}: ${SITE.tagline}</title><link>${SITE.url}</link><description>${esc(SITE.description)}</description><language>en</language>${rssItems}</channel></rss>`);

  // Sitemap
  const urls = [['/', posts[0] ? posts[0].date : tools.updated], ['/news/', posts[0] ? posts[0].date : tools.updated], ['/about/', tools.updated], ...posts.map(p => [p.url, p.date])];
  if (SHOW_BENCHMARK) urls.push(['/benchmark/', bench.results.map(r => r.date || tools.updated).sort().pop()]);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([u, d]) => `<url><loc>${SITE.url}${u}</loc><lastmod>${d}</lastmod></url>`).join('')}</urlset>`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);

  // Static files
  fs.cpSync(path.join(ROOT, 'static'), DIST, { recursive: true });

  console.log(`Built ${posts.length} posts, ${tools.tools.length} tools into dist/`);
}

build();
