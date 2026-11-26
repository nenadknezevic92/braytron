---
title: AI agents that drive a real CAD kernel: what SolidCraft and MCP change for engineers
description: Open-source SolidCraft lets AI agents build parametric parts through MCP. How this route differs from text-to-CAD, and how to test it.
date: 2026-11-26
tags: AI CAD agents, MCP, parametric CAD, open source
---

Most of the race to replace Creo or AutoCAD has been about one idea: train an AI to turn a description into geometry. A second route is now getting crowded. Instead of a special model that generates CAD, you give a general AI agent the controls of a real parametric CAD system and let it click the buttons for you, one feature at a time. This week an open-source program called SolidCraft became the clearest example of that route, and it is worth understanding because it changes what you should test.

## What SolidCraft is

[SolidCraft](https://github.com/tangency-labs/solidcraft) is an open-source parametric CAD application written in Rust, from a team called Tangency Labs. It runs as a desktop app on Windows, macOS and Linux, or in a browser without installing anything. According to its README, it already covers sketches with its own constraint solver, the usual solid features (extrude, revolve, sweep, loft, fillet, shell, holes, threads, patterns) on an editable timeline, parameters with unit-aware expressions, assemblies with joints and motion studies, and sheet metal. It reads and writes STEP, IGES, STL, 3MF, OBJ and glTF.

The part that matters for this site: the same commands that the toolbar runs are exposed to AI agents through a [Model Context Protocol (MCP) server](https://github.com/tangency-labs/solidcraft/blob/main/docs/mcp.md). The project describes it plainly: an agent models the way a person does, running the same engine commands, never opening a dialog. You can run it headless or connect it to the open app and watch the agent build the part. There is also an [agent chat panel](https://github.com/tangency-labs/solidcraft/blob/main/docs/agent-chat.md) where you connect a coding agent you already use, or a model on your own computer through Ollama or LM Studio. SolidCraft does not sell or proxy a model; you bring your own.

It is moving fast. A [LavX News write-up](https://news.lavx.hu/article/tangency-labs-solidcraft-parametric-3d-design-across-desktop-and-web-2026-11-23) counted about 17,800 GitHub stars on 23 November, roughly 1,300 of them in a single week, and noted that version 0.47.0, published the same day, is a prerelease. The repository was only created in October.

## Be honest about the limits

The README calls SolidCraft "early but usable for simple parts". Its own check found that 75 of 76 public reference parts match the expected volume, area, centre of mass and bounding box, which says the geometry kernel computes correctly. It says nothing about whether an AI agent produces the part you asked for.

Production drawings are not there yet. The [project roadmap](https://github.com/tangency-labs/solidcraft/blob/main/ROADMAP.md) lists drawings as in progress, with 3 of 21 pieces built and the drawing workspace not yet merged into the app; today you can export the current view as DXF. There is no CAM, surfacing is partly done, and Windows builds are unsigned, so SmartScreen will warn you on install.

## One program, part of a wider pattern

SolidCraft is not alone. The same idea, an agent driving a proper kernel through MCP, has appeared several times this autumn:

- [ClassCAD.ai](https://develop3d.com/ai/classcad-ai-cad-mcp/), from Swiss firm AWV Informatik, packages a headless NURBS modeller as an MCP server for Claude or Codex, with feature-based and direct modelling APIs and STEP export. It is free for non-commercial use, with commercial licences from 100 CHF.
- Anthropic released [connectors for Autodesk Fusion and Blender](https://develop3d.com/ai/claude-for-cad-blender-autodesk-fusion/) earlier in the year, with the Fusion one aimed at text to CAD inside a full parametric system.
- At Autodesk University, Autodesk said it runs [its own MCP servers for Revit and Fusion](https://develop3d.com/ai/autodesks-most-ambitious-ai-play-yet/), while its standalone, agent-first Assistant is still in development and expected next year.

The opinion piece ["A turning point for CAD?"](https://develop3d.com/opinion/comment/a-turning-point-for-cad/) on DEVELOP3D captures the mood: engineers increasingly build their own tools, but the author does not expect a sudden revolution.

## Why this route matters for the tracker

Compare it with dedicated text-to-CAD tools such as [Zoo](/contenders/zoo/). Those train or tune a model to write CAD directly, and the vendor controls the whole chain. The agent-plus-kernel route splits the job: a general model does the reasoning, and a deterministic CAD kernel does the geometry. That has two practical consequences.

First, the result is a normal feature tree, with real sketches, constraints and mates, because the agent only uses the commands a human would. On our tracker, an editable tree and constrained assemblies are two of the hardest capabilities to get from an AI. Here they come from the CAD program, not the AI.

Second, the weak point moves. The kernel is reliable; the agent's planning is not guaranteed. Whether an agent can follow a dimensioned brief is exactly the question research teams are starting to measure. Spectral Labs, for example, [claims its agent passed the SOLIDWORKS Professional exam](https://develop3d.com/cad/spectral-labs-turing-test-ai-cad/), with internal test answers counted correct only within 0.1% of the target value, though the same report notes the agent has not yet reached a perfect score, and the claim has not been independently checked.

That is why we have not added SolidCraft to the tracker. It is a CAD program that AI agents can operate, and nobody has yet published an independent test of how well an agent models with it. When that evidence exists, it will be scored by the same rules as every other contender, and our own [benchmark](/benchmark/) is built to measure the consistency question directly.

## What this means in practice

- **The test is the agent, not the kernel.** When you try any MCP-driven CAD, give the agent a part you know well with exact dimensions, then measure the result. A correct-looking model with one wrong hole spacing is the typical failure.
- **Check the tree, not just the shape.** Change a key dimension after the agent finishes. If the model rebuilds cleanly, the agent built it properly; if it breaks, it took shortcuts.
- **Try it safely.** SolidCraft's browser version needs no install, and its agent chat runs on your own account or a local model, so you can test without sending files to a new vendor.
- **Don't plan around drawings yet.** For 2D production sheets, a 3D-to-drawing tool such as [DraftAid](/contenders/draftaid/) or [Fusion's drawing automation](/contenders/autodesk-fusion-ai/) is still the practical path. See [our AutoCAD page](/ai-alternative-to-autocad/) for that workflow.
- **Watch this route.** If agents get reliable at following briefs, the winner for [replacing Creo](/ai-alternative-to-creo/) may be a good agent on top of an existing CAD system rather than a new AI-only tool.
