---
name: HelpWHV
description: Caminhos da Austrália for the job search and batch application workspace.
colors:
  petrol: "#0a4747"
  rust: "#b63b18"
  ground: "#eaf3f0"
  ink: "#122c33"
  white: "#ffffff"
  selected-mint: "#e8f4ed"
  summary-mint: "#edf5f1"
  focus-gold: "#f4ad22"
typography:
  display:
    fontFamily: "Khand, sans-serif"
    fontSize: "73px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  brand:
    fontFamily: "Khand, sans-serif"
    fontSize: "53px"
    fontWeight: 700
    lineHeight: 0.9
  section:
    fontFamily: "Khand, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "Khand, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.05
  action:
    fontFamily: "Khand, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1
  lead:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "20px"
    lineHeight: 1.4
  subheading:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "18px"
    lineHeight: 1.35
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    lineHeight: 1.4
  detail:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.45
  metadata:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "13px"
    lineHeight: 1.35
  badge:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.25
rounded:
  action: "8px"
  choice: "10px"
  inset: "12px"
  panel: "14px"
  pill: "999px"
components:
  button-search:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    height: "55px"
  button-search-hover:
    backgroundColor: "#952e14"
  button-row:
    backgroundColor: "transparent"
    textColor: "#aa3015"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    height: "45px"
  button-bulk:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    height: "66px"
  field-search:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "9px"
    height: "61px"
  job-row-selected:
    backgroundColor: "{colors.selected-mint}"
  selection-summary:
    backgroundColor: "{colors.summary-mint}"
    rounded: "12px"
  mode-choice-selected:
    backgroundColor: "#e9f3ed"
    rounded: "{rounded.choice}"
---

# Design System: HelpWHV

## Overview

**Creative North Star: "Caminhos da Austrália"**

A teal and mineral mint workspace borrows the clarity of a route map and roadside wayfinding without turning the task into scenery. Rust marks a deliberate application action. Khand compresses headings and commands so vacancies, selection, and agent state remain easy to scan.

The interface is an operating surface: white work areas sit on a pale mint ground, selected records receive a quiet mint fill, and the next action remains visible in the selection tray. A single dashed route trace and the road sign give the current Australian job view its place. They do not become a repeated ornament in each card.

**Key Characteristics:**
- Petrol navigation over a mineral mint ground.
- Rust on application and search actions.
- Condensed Khand headings over compact Segoe UI details.
- One route trace above a dense, operable vacancy list.

## Colors

The palette separates navigation, action, and selection. The pale mint ground stays calm while work surfaces remain plain.

### Primary
- **Petrol** (`#0a4747`): navigation, the mobile batch dock, and text selection; it anchors the route theme.

### Secondary
- **Rust** (`#b63b18`): search and application buttons, selected checkboxes, radio controls, and text caret; it identifies an intentional action.

### Neutral
- **Mineral Ground** (`#eaf3f0`): page canvas behind the work surfaces.
- **Ink** (`#122c33`): default text and control foreground.
- **Work White** (`#ffffff`): filters, vacancy rows, and the selection tray.
- **Selected Mint** (`#e8f4ed`): selected desktop vacancy rows; the mobile variant uses a nearby mint tint.
- **Summary Mint** (`#edf5f1`): the selected-vacancy summary inset.
- **Focus Gold** (`#f4ad22`): visible keyboard focus outline, including the search and filter field wrappers when their controls receive focus.

**The Rust Means Action Rule.** Reserve rust for commands and user selections; keep ordinary metadata in ink.

## Typography

**Display Font:** Khand (local bold face, sans-serif fallback).
**Body Font:** Segoe UI (Arial, sans-serif fallback).

**Character:** Khand gives headings and commands a compact wayfinding voice. Segoe UI carries job facts, labels, and explanatory copy at reading sizes.

### Hierarchy
- **Display** (700, 73px, 0.95 line-height): the desktop page heading; it scales down on narrow screens.
- **Title** (700, 27px, 0.95 line-height): vacancy titles in a row.
- **Action** (700, 23px, 1 line-height): the search command; other action buttons use the same face at nearby sizes.
- **Body** (16px base): form values, explanatory text, and mode details.
- **Metadata** (13px, 1.15 line-height): location, pay, work type, and posting date in dense rows.

**The Two Voices Rule.** Use Khand for orientation and commands, and Segoe UI for facts people must compare.

## Layout

The desktop workspace is capped at 1487px. A wide vacancy column sits beside a 421px selection tray with a 13px gap; the tray stays in view while the list scrolls. Search controls form one compact row above the results, and vacancy rows group checkboxes, facts, and a per-vacancy command.

At 1200px the tray narrows and filters move to two columns. At 900px the tray moves below the list. At 600px the top bar wraps, vacancy rows become individual cards, search fields stack, and a fixed bottom batch dock links to the tray. At 360px the filters and sorting controls stack further. These breakpoints express the current implementation, not a requirement to reproduce the desktop composition with absolute positioning.

**The List First Rule.** Preserve room for comparing vacancies; keep bulk scope and the next action legible beside or below that list.

## Elevation & Depth

Depth comes mainly from white and mint surface changes. The tray, filter area, and vacancy list have no resting drop shadow. The mobile batch dock and transient notice use soft shadows to remain distinct over scrolling content. The road sign has an inset line and firm edge.

**The Tonal Surface Rule.** Use a background change for selection before adding elevation.

## Shapes

Controls use gently rounded corners (8px for action buttons, 9px for fields). Choices and mobile vacancy cards use a 10px curve, while large work panels use 14px. Selected checkboxes are small rounded squares; the automatic switch and agent state are capsules. The dashed route is a single open line, not a frame around content.

## Components

### Navigation

Petrol carries the white Khand navigation labels. The current view has a pale translucent fill and light outline; hover adds another translucent fill. On mobile, the navigation moves to its own row beneath the brand and agent controls.

### Buttons

The search and bulk commands are solid rust with white Khand labels and 8px corners; hover deepens the rust. Per-vacancy actions use a rust outline and rust label on a clear surface, then a pale rust hover fill. The row action expands inline choices for a preview of immediate or automatic application. The bulk command disables when no selected vacancy is available or the agent is paused.

### Inputs / Fields

Search and filter fields use white fill, a thin cool gray outline, and 9px corners. Their icon and text stay together in a compact horizontal control. A gold ring surrounds the whole field when its control receives focus.

### Cards / Containers

Vacancy rows are a continuous white list on desktop, separated by hairlines. Selection changes the row to mint. On mobile each row becomes its own white card with a 10px corner. The selection tray is a separate white panel; its summary is a mint inset.

### Choices and Status

Batch mode options are full-width touch targets; the chosen option receives a mint background and the native radio carries rust. The automatic switch uses a green on state. The agent's preview state combines a mint dot with text, while illustrative in-progress work has a pale teal status badge labeled as a preview.

## Do's and Don'ts

### Do:
- **Do** keep task facts and controls compact enough to compare several vacancies at once.
- **Do** use mint fill to connect a selected row with the batch summary and mode choice.
- **Do** keep a visible action and scope count for the selected group.

### Don't:
- **Don't** repeat the route trace inside every row or panel; one line establishes the place.
- **Don't** use rust as a general background or metadata color; it should signal action and selection.
- **Don't** make every work surface appear raised; the existing hierarchy is primarily tonal.
