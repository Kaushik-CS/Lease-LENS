# LEASE LENS — Agreement Intelligence

A premium, Rental agreement screening prototype built with React and Vite. The interface uses a champagne-gold visual system, cinematic splash intro, subtle radar/orbit detailing and a cursor-following ambient glow. It extracts selectable text from PDF files and compares the text against transparent phrase-based screening rules.

## Requirements
- Node.js 20.19+ or 22.12+ (required by current Vite releases)
- npm

## Run locally

```bash
npm install
npm run dev
```

On Windows PowerShell, if `npm` is blocked by execution policy, use `npm.cmd install` and `npm.cmd run dev`.

## Production build

```bash
npm run build
npm run preview
```

## Features
- Cinematic animated splash screen and premium champagne-gold interface
- Responsive layout with subtle ambient pointer lighting and motion
- PDF upload by file picker or drag and drop
- 20 MB file-size limit and file validation
- In-browser PDF text extraction using PDF.js
- 14 transparent rule categories for common rental wording signals
- Evidence excerpts, plain-English context and discussion prompts
- Screening score, initial assessment and priority filters
- Exportable plain-text screening report
- Extracted text viewer
- Responsive desktop/mobile layout

## Important limitations
- This is a rule-based screening aid, not an AI model, legal advice or a determination of enforceability.
- It can miss important clauses or flag harmless wording. The score is a prioritisation indicator, not a probability or legal risk rating.
- Text-based PDFs are supported. Scanned/image-only PDFs need OCR, which is not included.
- PDF processing is performed in the browser; no backend or external AI API is used.
- The Google Fonts import is optional presentation styling; the app remains usable with system fallback fonts if offline.

Have the complete agreement reviewed by a qualified professional familiar with the relevant local law before signing.
