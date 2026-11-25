// braytron.cz static site builder. No dependencies: run with `node build.js`.
// Reads content/posts/*.md and data/tools.json, writes the site into dist/.
'use strict';
const fs = require('fs');
const path = require('path');

const SITE = {
  url: 'https://braytron.cz',
  name: 'Braytron',
  tagline: 'AI tools for 3D and manufacturing',
  description: 'A curated, regularly updated guide to the AI tools that matter for 3D modelling, CAD, scanning, CAM and engineering simulation.',
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

// ---------- templates ----------
function layout({ title, description, canonical, body, jsonld, type = 'website', current = '' }) {
  const fullTitle = title ? `${title} | ${SITE.name}` : `${SITE.name}: ${SITE.tagline}`;
  const nav = [['/', 'Shortlist', 'home'], ['/news/', 'News', 'news'], ['/about/', 'About', 'about']]
    .map(([href, label, key]) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="${SITE.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
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
  <p>Braytron is an independent guide to AI tools for 3D and manufacturing, updated several times a week.</p>
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

// ---------- build ----------
function build() {
  const posts = loadPosts();
  const tools = loadTools();
  if (errors.length) {
    console.error('Build failed:\n- ' + errors.join('\n- '));
    process.exit(1);
  }
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const latest = posts[0];
  const home = `
<section class="hero">
  <h1>AI tools that help you make real parts.</h1>
  <p class="lede">${tools.tools.length} tools for 3D modelling, CAD, scanning, CAM and simulation, rated by how ready they are for engineering work. Checked and updated several times a week.</p>
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
    <h2 id="h-shortlist" class="section-title">The shortlist</h2>
    <p>Updated ${fmtDate(tools.updated)}. Readiness: <strong>Early</strong> means promising but rough, <strong>Usable</strong> means it saves time with checking, <strong>Proven</strong> means teams rely on it in production.</p>
  </div>
  ${shortlist(tools)}
</section>`;

  write('index.html', layout({
    title: '', description: SITE.description, canonical: '/', body: home, current: 'home',
    jsonld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, description: SITE.description, publisher: { '@type': 'Organization', name: SITE.publisher, url: SITE.publisherUrl } },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'AI tools for 3D and manufacturing', itemListElement: tools.tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: t.url })) }
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
    title: 'About', description: 'How Braytron selects and rates AI tools for 3D and manufacturing.', canonical: '/about/', current: 'about',
    body: `
<article class="post">
  <header><h1>About Braytron</h1><p class="lede">A short, opinionated guide for engineers who want to know which AI tools are worth their time.</p></header>
  <div class="prose">
    <p>The AI tool market for 3D and manufacturing moves every week, and most lists mix toys with production software. Braytron keeps a short list instead: the tools that matter in each area, with a plain rating of how ready they are.</p>
    <h2 id="ratings">How we rate tools</h2>
    <ul>
      <li><strong>Early</strong>: research projects, betas and new launches. Worth watching, not worth depending on.</li>
      <li><strong>Usable</strong>: saves real time, but the output needs an engineer to check it.</li>
      <li><strong>Proven</strong>: used in production by many teams, with a track record.</li>
    </ul>
    <h2 id="process">How it is updated</h2>
    <p>New articles are researched and drafted with the help of AI, from public sources that are linked in every article. Each claim links to where it came from, so you can check it yourself.</p>
    <h2 id="publisher">Who is behind it</h2>
    <p>Braytron is published by <a href="${SITE.publisherUrl}">${SITE.publisher}</a> in Bratislava, Slovakia. We also make <a href="https://luxxo.sk/ai-cad/">Luxxo CAD</a>, which appears on the shortlist and is always marked as ours. Corrections and tool suggestions: <a href="mailto:info@luxxo.sk">info@luxxo.sk</a>.</p>
  </div>
</article>`
  }));

  write('404.html', layout({ title: 'Page not found', description: 'This page does not exist.', canonical: '/404.html', body: `<section class="archive"><h1>Page not found</h1><p>The page may have moved. Go to the <a href="/">shortlist</a> or browse the <a href="/news/">news</a>.</p></section>` }));

  // RSS
  const rssItems = posts.slice(0, 30).map(p => `<item><title>${esc(p.title)}</title><link>${SITE.url}${p.url}</link><guid>${SITE.url}${p.url}</guid><pubDate>${new Date(p.date + 'T08:00:00Z').toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('');
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE.name}: ${SITE.tagline}</title><link>${SITE.url}</link><description>${esc(SITE.description)}</description><language>en</language>${rssItems}</channel></rss>`);

  // Sitemap
  const urls = [['/', posts[0] ? posts[0].date : tools.updated], ['/news/', posts[0] ? posts[0].date : tools.updated], ['/about/', tools.updated], ...posts.map(p => [p.url, p.date])];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([u, d]) => `<url><loc>${SITE.url}${u}</loc><lastmod>${d}</lastmod></url>`).join('')}</urlset>`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);

  // Static files
  for (const f of fs.readdirSync(path.join(ROOT, 'static'))) fs.copyFileSync(path.join(ROOT, 'static', f), path.join(DIST, f));

  console.log(`Built ${posts.length} posts, ${tools.tools.length} tools into dist/`);
}

build();
