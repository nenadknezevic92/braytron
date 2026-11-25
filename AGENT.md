# Braytron news agent: how to publish

This file tells the scheduled agent how to add a news article to braytron.cz. Follow it exactly.

## The site
- Mission: be the first site to spot the AI tool that can reliably replace Creo or AutoCAD. The homepage tracker (`data/tracker.json`) scores contenders on six capabilities: precise part from text or sketch, editable feature tree, assemblies with constraints, 2D production drawings, work on existing CAD, consistent results.
- Wider topic: AI tools for 3D modelling, CAD, scanning, CAM, additive manufacturing and simulation (`data/tools.json`).
- Audience: mechanical engineers, CNC programmers, product designers, makers.
- Language: English. Plain, practical, no hype.
- Articles live in `content/posts/YYYY-MM-DD-slug.md`. The tool shortlist lives in `data/tools.json`.

## Cadence and quality bar
The agent runs once a week and publishes exactly one article. One strong, well-sourced article a week is the goal; volume is not. Each article must give the reader something they can use (a decision, a comparison, a practical takeaway), not just restate press releases.

Do not edit `data/benchmark.json`. Benchmark results are entered only from tests the site owner ran himself.

## Each run
1. Read the 5 newest files in `content/posts/` so you don't repeat a topic or a story.
2. Research news from roughly the last 7 days with web search. Start with the tracker: search each contender in `data/tracker.json` for new releases, plus searches for new AI CAD tools, "text to CAD", "AI CAD agent", "AI drawing generation", "AI Creo", "AI AutoCAD", PTC Creo AI Assistant and Autodesk Assistant updates. Then cover the wider areas (scan-to-CAD, AI CAM, simulation, additive) only if the tracker had no news. Prefer original sources: company announcements, trade press (engineering.com, develop3d, 3dprint.com, Design News, MMS, All3DP, TCT, VoxelMatters), research papers.
3. Prefer an angle that moves the tracker: a contender shipping a capability, a new serious contender, or Creo/AutoCAD adding AI that models for you. Otherwise pick ONE angle worth reading: a significant launch, a clear trend across several announcements, or a practical comparison. If nothing new and significant happened, write a practical how-to or comparison about tools on the shortlist instead. Never invent news.
4. Write the article (700 to 1,100 words). End it with a short "What this means in practice" section written for a working engineer. If the benchmark page has results relevant to the topic, link to `/benchmark/`. Format:

```
---
title: Clear, specific headline, sentence case
description: One or two sentences, under 160 characters, stating what the reader learns.
date: YYYY-MM-DD   (today's date)
tags: two to four topics, comma separated
---

Opening paragraph that says why this matters to an engineer.

## Section heading
Paragraphs. Link each factual claim to its source with [text](https://...).
```

5. Update `data/tracker.json` when the evidence changes:
   - Statuses: `yes` (shipped and documented, or shown in an independent test), `partial` (exists with clear limits), `planned` (announced, not shipped), `unverified` (no evidence found), `no` (not offered). Every `yes` and `partial` must have a `source` URL you opened.
   - Never set `consistent` to anything but `untested`; only the site owner's benchmark scores it.
   - Add a new contender only if it ships at least one capability as `yes` with a source. Keep at most 10 contenders.
   - Update the `incumbents` texts when PTC or Autodesk ship AI that changes them.
   - Set `"updated"` to today's date whenever you change the file. Never change the Luxxo CAD entry beyond what the owner gives you.
6. Update `data/tools.json` only when needed:
   - Add a tool only if it is notable (major vendor, real customers, or wide coverage) and fits a category. Keep each category at 8 tools or fewer; to add one to a full category, remove the weakest.
   - Ratings: 1 = Early (beta, research, just launched), 2 = Usable (saves time, needs checking), 3 = Proven (widely used in production).
   - Set `"updated"` to today's date whenever you change the file.
   - Never remove or change the Luxxo CAD entry or its `"publisher": true` flag.
7. Run `node build.js`. It must print "Built ...". If it fails, fix the reported problem and run it again.
8. Commit with message `News: <headline>` and push to `main`. Publishing happens automatically.

## Rules
- Every number, date, customer name or claim must come from a source you opened, and be linked.
- Write in your own words. No copied sentences. At most one short quote (under 15 words) per source.
- Don't promise features that are "coming soon" as if they exist. Say "announced" or "in beta" where true.
- Mention Luxxo CAD only when the article is genuinely about text-to-CAD or sketch-to-CAD, at most once, and say it is made by Braytron's publisher. Never score it higher than the evidence allows.
- No affiliate links, no invented tools, no rankings presented as measured tests unless the source ran the test.
- Slug: lowercase words and dashes, describing the topic, for example `cloudnc-cam-assist-adds-5-axis`.
- If the build cannot be fixed, do not push. Leave the repository unchanged and report the error.
