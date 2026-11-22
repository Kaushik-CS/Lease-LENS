import { useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './App.css'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// These transparent phrase rules are screening aids, not legal conclusions.
const RULES = [
  { id:'deposit', title:'Deposit forfeiture or retention', level:'HIGH', points:22, patterns:[/\b(?:forfeit|forfeiture|confiscat\w*)\b.{0,130}\b(?:deposit|security deposit|advance)\b/i,/\b(?:deposit|security deposit|advance)\b.{0,130}\b(?:forfeit|non[- ]?refundable|nonrefundable|retain(?:ed)?|keep)\b/i,/\bentire deposit\b.{0,100}\b(?:deduct|retain|forfeit|keep)\w*/i], why:'This wording may allow some or all of the security deposit to be kept. Check which specific losses can be deducted, whether evidence is required, and when the balance must be returned.', ask:'Can deductions be limited to documented unpaid amounts or damage beyond normal wear and tear, with an itemised statement and a clear refund deadline?' },
  { id:'landlord-termination', title:'One-sided termination rights', level:'HIGH', points:20, patterns:[/\b(?:landlord|owner|lessor)\b.{0,150}\b(?:may|can|reserves? the right to)\b.{0,70}\b(?:terminate|end|cancel|evict)\b/i,/\b(?:terminate|end|cancel)\b.{0,120}\b(?:at (?:the )?sole discretion|without assigning any reason|for any breach)\b/i,/\b(?:landlord|owner)\b.{0,100}\bterminate\b.{0,120}\btenant\b/i], why:'This may give the landlord or owner a broad right to end the agreement. Check whether the grounds are specific, whether notice is required, and whether the tenant has a chance to remedy a breach.', ask:'Could termination be limited to clearly defined material breaches, with written notice and a reasonable opportunity to remedy where appropriate, and balanced rights for both parties?' },
  { id:'short-notice', title:'Very short notice period', level:'HIGH', points:15, patterns:[/\b(?:[1-7]|one|two|three|four|five|six|seven)\s*(?:calendar\s*)?days?['’]?\s*(?:written\s*)?notice\b/i,/\b(?:24|forty[- ]eight)\s*hours?['’]?\s*notice\b/i,/\bnotice\s+of\s+(?:[1-7]|one|two|three|four|five|six|seven)\s+days?\b/i], why:'A very short notice period can leave little time to respond, fix an issue or relocate. Check what event triggers it and whether the same period applies to both parties.', ask:'Could the agreement state a reasonable notice period and distinguish urgent safety situations from ordinary contractual breaches?' },
  { id:'rent-change', title:'Unclear rent increase mechanism', level:'REVIEW', points:10, patterns:[/\brent\b.{0,110}\b(?:increas\w*|revis\w*|rais\w*)\b/i,/\b(?:increase|revise|raise)\b.{0,110}\bmonthly rent\b/i,/\brent\b.{0,90}\b(?:sole discretion|at any time|as decided by)\b/i], why:'The agreement may allow rent changes without a clear limit or process. Check the amount or formula, review date and advance written notice.', ask:'Could it specify when rent can change, how the change is calculated and how much advance notice is required?' },
  { id:'access', title:'Broad landlord access', level:'REVIEW', points:9, patterns:[/\b(?:enter|access)\b.{0,110}\b(?:at any time|without (?:any )?prior notice|unrestricted)\b/i,/\b(?:landlord|owner)\b.{0,110}\benter the premises\b/i,/\bright of entry\b.{0,90}\b(?:any time|without notice)\b/i], why:'Broad entry wording may affect privacy and quiet enjoyment. Check permitted purposes, reasonable hours and advance notice, except in genuine emergencies.', ask:'Could entry be limited to defined reasons, reasonable hours and advance notice, with a narrow emergency exception?' },
  { id:'repairs', title:'Broad repair responsibility', level:'REVIEW', points:10, patterns:[/\btenant\b.{0,110}\b(?:all repairs|all maintenance|every repair)\b/i,/\b(?:all repairs|all maintenance)\b.{0,110}\btenant(?:'s)?\b/i,/\brepairs?\b.{0,90}\b(?:sole responsibility|at tenant'?s cost)\b/i], why:'This may transfer a wide range of repair costs to the tenant. Check whether it distinguishes tenant-caused damage and routine upkeep from structural or major repairs.', ask:'Could the agreement separate tenant-caused damage and routine upkeep from structural and major repairs, and assign each clearly?' },
  { id:'fees', title:'Open-ended fees or penalties', level:'REVIEW', points:9, patterns:[/\b(?:penalt\w*|charge\w*|fee\w*)\b.{0,110}\b(?:sole discretion|as decided by|without any limit|any amount)\b/i,/\b(?:any amount|additional charges)\b.{0,110}\b(?:landlord|owner)\b/i,/\bcharges?\s+(?:may be|will be)\s+decided\s+by\s+(?:the\s+)?(?:landlord|owner)\b/i], why:'Charges without a clear amount or calculation method make potential costs uncertain. Check the trigger, amount and any cap.', ask:'Could each permitted charge, trigger, calculation method and maximum amount be listed?' },
  { id:'early-exit', title:'Early-exit restriction', level:'REVIEW', points:10, patterns:[/\bearly termination\b.{0,140}\b(?:charge|penalt\w*|rent|forfeit)\b/i,/\block[- ]?in period\b/i,/\b(?:entire|remaining)\s+(?:term|period)\b.{0,100}\brent\b/i,/\bleave\b.{0,110}\b(?:deposit|forfeit|remaining rent)\b/i,/\bvacat\w*\b.{0,100}\b(?:forfeit|deposit|penalty)\b/i], why:'This may make leaving before the end date expensive. Check the lock-in duration, notice requirement, permitted exit conditions and maximum liability.', ask:'Could the agreement define a clear early-exit process, reasonable notice, any capped charge and circumstances where it does not apply?' },
  { id:'liability', title:'Broad liability disclaimer', level:'HIGH', points:18, patterns:[/\b(?:landlord|owner)\b.{0,140}\bnot liable for (?:any|all)\b/i,/\b(?:waive|waives|waiver)\b.{0,100}\b(?:all claims|any claim|all liability)\b/i,/\bunder any circumstances\b/i,/\bnot responsible for any\b/i,/\bno liability whatsoever\b/i], why:'A sweeping disclaimer may attempt to exclude responsibility across many situations. Its effect depends on the complete wording and applicable local law; do not assume it is enforceable.', ask:'Could responsibility be allocated narrowly and clearly, avoiding blanket language that purports to exclude every type of liability?' },
  { id:'unilateral', title:'Unilateral changes to agreement', level:'REVIEW', points:10, patterns:[/\b(?:landlord|owner|lessor)\b.{0,110}\b(?:may|can)\b.{0,70}\b(?:change|amend|modify|alter)\b/i,/\bchange the terms\b.{0,110}\bwithout (?:the )?tenant'?s consent\b/i,/\bterms?\s+(?:may be|can be)\s+changed\s+by\s+(?:the\s+)?(?:landlord|owner)\b/i], why:'This may let one party change important terms without the other party agreeing. Check whether amendments require written consent from both sides.', ask:'Could material amendments be required to be written and accepted by both parties?' },
  { id:'utilities', title:'Unclear utility or maintenance costs', level:'REVIEW', points:6, patterns:[/\b(?:utilities|maintenance|common area|service) charges?\b.{0,110}\b(?:as decided|at discretion|additional|any amount)\b/i,/\b(?:electricity|water|gas)\b.{0,100}\b(?:as decided|at discretion|any amount)\b/i], why:'The agreement may not clearly define recurring extra costs. Check what is included, how bills are measured and whether supporting statements are provided.', ask:'Could included services, billing responsibility, calculation method and supporting bills be specified?' },
  { id:'renewal', title:'Unclear renewal or extension terms', level:'REVIEW', points:7, patterns:[/\brenew(?:al|ed)?\b.{0,130}\b(?:sole discretion|as decided|subject to landlord approval)\b/i,/\bautomatically renew\b/i,/\bextension\b.{0,100}\b(?:rent|charges?)\b/i], why:'Renewal wording may leave timing, rent or approval conditions unclear. Check the renewal window, required notice and whether new terms can be imposed.', ask:'Could the agreement state the renewal deadline, process, rent terms and whether both parties must agree in writing?' },
  { id:'lock-in', title:'Lock-in period or minimum stay', level:'REVIEW', points:8, patterns:[/\block[- ]?in\s+(?:period|of)\s+(?:\d+|one|two|three|six|twelve)\s+months?\b/i,/\bminimum stay\b/i,/\btenant shall not vacate\b/i], why:'A lock-in or minimum-stay clause can limit flexibility and may trigger costs if the tenant leaves early. Check the duration and consequences.', ask:'Could the duration, exceptions and maximum early-exit liability be stated clearly?' },
  { id:'dispute', title:'Unclear dispute-resolution process', level:'REVIEW', points:5, patterns:[/\bdisputes?\b.{0,120}\b(?:sole discretion|final decision|as decided by landlord)\b/i,/\bjurisdiction\b.{0,100}\b(?:to be decided|landlord'?s choice)\b/i], why:'The agreement may not clearly explain how disagreements are handled or where claims can be brought. Check the stated process and location.', ask:'Could the agreement identify a neutral, clear dispute-resolution process and the applicable court jurisdiction?' },
]

function cleanText(value) {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
}

async function readPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const pages = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo)
    const content = await page.getTextContent()
    pages.push(content.items.map(item => item.str).join(' '))
  }
  return { text: cleanText(pages.join('\n\n')), pages: pdf.numPages }
}

function makeEvidence(text, patterns) {
  const excerpts = []
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    const match = pattern.exec(text)
    if (!match) continue
    const start = Math.max(0, match.index - 145)
    const end = Math.min(text.length, match.index + match[0].length + 190)
    let excerpt = text.slice(start, end).trim()
    if (start > 0) excerpt = `…${excerpt}`
    if (end < text.length) excerpt = `${excerpt}…`
    if (!excerpts.includes(excerpt)) excerpts.push(excerpt)
    if (excerpts.length >= 3) break
  }
  return excerpts
}

function scanAgreement(text) {
  const matches = RULES.flatMap(rule => {
    const excerpts = makeEvidence(text, rule.patterns)
    return excerpts.length ? [{ ...rule, excerpts }] : []
  })
  const rawPoints = matches.reduce((sum, item) => sum + item.points, 0)
  const score = Math.min(100, rawPoints)
  const highCount = matches.filter(item => item.level === 'HIGH').length
  const rating = highCount >= 2 || score >= 55 ? 'Elevated review' : highCount === 1 || score >= 25 ? 'Closer review' : matches.length ? 'Some signals' : 'No matches found'
  return { matches, score, rating, highCount }
}

function downloadReport(result, filename) {
  const lines = [
    'LEASE LENS — RENTAL AGREEMENT SCREENING REPORT',
    `File: ${filename}`,
    `Pages: ${result.pages}`,
    `Characters extracted: ${result.text.length}`,
    `Screening score: ${result.score}/100 (rule-based prioritisation only)`,
    `Initial assessment: ${result.rating}`,
    `Findings: ${result.matches.length}`,
    '',
    'IMPORTANT: This is an experimental keyword-based screening aid, not legal advice, an AI assessment, or a determination of enforceability.',
    '',
  ]
  result.matches.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.title} [${item.level}]`)
    lines.push(`Why it may matter: ${item.why}`)
    lines.push('Evidence:')
    item.excerpts.forEach(excerpt => lines.push(`  - ${excerpt}`))
    lines.push(`Question to discuss: ${item.ask}`, '')
  })
  lines.push('EXTRACTED TEXT', result.text)
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename.replace(/\.pdf$/i, '')}-lease-lens-report.txt`
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [filter, setFilter] = useState('ALL')
  const [introVisible, setIntroVisible] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroVisible(false), 2600)
    const move = event => {
      document.documentElement.style.setProperty('--pointer-x', `${event.clientX}px`)
      document.documentElement.style.setProperty('--pointer-y', `${event.clientY}px`)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.clearTimeout(timer); window.removeEventListener('pointermove', move) }
  }, [])

  const highCount = useMemo(() => result?.matches.filter(item => item.level === 'HIGH').length ?? 0, [result])
  const visibleFindings = useMemo(() => result?.matches.filter(item => filter === 'ALL' || item.level === filter) ?? [], [result, filter])

  function chooseFile(nextFile) {
    setError('')
    setResult(null)
    setExpanded({})
    setFilter('ALL')
    if (!nextFile) { setFile(null); return }
    if (nextFile.type !== 'application/pdf' && !nextFile.name.toLowerCase().endsWith('.pdf')) {
      setFile(null); setError('Please choose a PDF file.'); return
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setFile(null); setError('This file is larger than 20 MB. Please choose a smaller PDF.'); return
    }
    setFile(nextFile)
  }

  async function analyze() {
    if (!file || busy) return
    setBusy(true); setError(''); setResult(null); setExpanded({})
    try {
      const parsed = await readPdf(file)
      if (parsed.text.length < 30) throw new Error('No selectable text was found. This may be a scanned/image-only PDF. OCR is not included in this version.')
      const scan = scanAgreement(parsed.text)
      setResult({ ...parsed, ...scan, analysedAt: new Date() })
      window.setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (err) {
      setError(err?.message || 'We could not read this PDF. Please try another text-based PDF.')
    } finally { setBusy(false) }
  }

  function reset() {
    setFile(null); setResult(null); setError(''); setExpanded({}); setFilter('ALL')
    if (inputRef.current) inputRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className={`shell ${introVisible ? 'intro-running' : 'intro-finished'}`}>
    {introVisible && <div className="splash-screen" aria-label="Lease Lens loading"><div className="splash-orbit orbit-one"/><div className="splash-orbit orbit-two"/><div className="splash-center"><span className="splash-mark">L</span><span className="splash-wordmark">LEASE<span>LENS</span></span><small>AGREEMENT INTELLIGENCE</small></div><div className="splash-progress"><i/></div><span className="splash-caption">A CLEARER FIRST READ · 2026</span></div>}
    <div className="ambient-glow" aria-hidden="true"/>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Lease Lens home"><span className="brand-mark">L</span><span>LEASE<span className="brand-light">LENS</span></span></a>
      <div className="top-meta"><span className="live-dot" /> PRIVATE, LOCAL SCREENING <span className="top-divider">/</span> NO API KEY <a href="#process">HOW IT WORKS ↘</a></div>
    </header>

    <main id="top">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">A CLEARER LOOK BEFORE YOU SIGN</p>
          <h1>Read between<br />the <em>lease lines.</em></h1>
          <p className="hero-sub">A practical first-pass review of rental agreement wording. Find clauses worth a second look, understand why they matter, and prepare better questions.</p>
          <div className="trust-row"><span>01 / Upload</span><i /> <span>02 / Review</span><i /> <span>03 / Discuss</span></div>
          <div className="hero-footnote"><span className="footnote-seal">✳</span><span>DESIGNED FOR CLARITY<br/><b>BUILT AROUND EVIDENCE</b></span><span className="hero-coordinate">13°01′N<br/>80°12′E</span></div>
        </div>
        <div className={`upload-card ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]) }}>
          <div className="upload-symbol"><span>↑</span></div>
          <p className="upload-kicker">START YOUR REVIEW</p>
          <h2>Upload your agreement</h2>
          <p className="upload-desc">Drop a PDF here, or browse your device.</p>
          <button className="outline-btn" onClick={() => inputRef.current?.click()}>Choose PDF <span>↗</span></button>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={event => chooseFile(event.target.files?.[0])} hidden />
          <p className="file-limit">PDF only · Maximum 20 MB · Text-based PDFs</p>
          {file && <div className="selected-file"><span className="pdf-icon">PDF</span><div className="selected-copy"><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to review</small></div><button className="remove-file" onClick={() => chooseFile(null)} aria-label="Remove selected file">×</button></div>}
          {error && <div className="error-box" role="alert">{error}</div>}
          <button className="primary-btn analyze-btn" onClick={analyze} disabled={!file || busy}>{busy ? <><span className="spinner" /> Reading your agreement…</> : <>Analyse agreement <span>→</span></>}</button>
          <p className="privacy-note"><span>⌑</span> Your PDF is processed in this browser. It is not uploaded to a server.</p>
        </div>
      </section>

      {result && <section className="report-section" id="report">
        <div className="section-heading"><div><p className="eyebrow">YOUR SCREENING REPORT</p><h2>Review findings<span className="gold-period">.</span></h2><p className="muted">{file?.name} · {result.pages} pages · {result.text.length.toLocaleString()} characters extracted</p></div><div className="report-actions"><button className="secondary-btn" onClick={() => downloadReport(result, file?.name || 'agreement')}>↓ Export report</button><button className="text-btn" onClick={reset}>New review ↗</button></div></div>
        <div className="metrics-grid">
          <div className="metric-card score-card"><span className="metric-label">SCREENING SCORE</span><div className="metric-number">{result.score}<small>/100</small></div><span className="metric-foot">Rule-based priority indicator</span></div>
          <div className="metric-card"><span className="metric-label">INITIAL ASSESSMENT</span><div className="metric-status">{result.rating}</div><span className="metric-foot">Requires human review</span></div>
          <div className="metric-card"><span className="metric-label">FINDINGS</span><div className="metric-number">{result.matches.length}</div><span className="metric-foot">Distinct screening categories</span></div>
          <div className="metric-card"><span className="metric-label">HIGH PRIORITY</span><div className="metric-number high-number">{highCount}</div><span className="metric-foot">Items to review first</span></div>
        </div>
        <div className="report-note"><span className="note-icon">i</span><div><strong>{result.matches.length ? 'Potential wording to review' : 'No matching patterns found'}</strong><p>{result.matches.length ? 'These are keyword-based signals, not legal conclusions. Review the complete clause and surrounding context before making a decision.' : 'No phrases matched the current rules. This does not mean the agreement is safe or risk-free.'}</p></div></div>
        <div className="findings-toolbar"><div><h3>Flagged clauses <span>{result.matches.length}</span></h3><p>Open a finding to inspect evidence and questions to discuss.</p></div><div className="filter-tabs" aria-label="Filter findings">{['ALL','HIGH','REVIEW'].map(value => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'ALL' ? 'All' : value === 'HIGH' ? 'High' : 'Review'}</button>)}</div></div>
        {visibleFindings.length ? <div className="findings-list">{visibleFindings.map((item, index) => <article className="finding-card" key={item.id}>
          <button className="finding-head" aria-expanded={!!expanded[item.id]} onClick={() => setExpanded(current => ({ ...current, [item.id]: !current[item.id] }))}><span className={`severity ${item.level.toLowerCase()}`}>{item.level === 'HIGH' ? 'HIGH PRIORITY' : 'REVIEW'}</span><strong>{item.title}</strong><span className="finding-index">{String(index + 1).padStart(2,'0')}</span><span className="chevron">{expanded[item.id] ? '−' : '+'}</span></button>
          {expanded[item.id] && <div className="finding-content"><div className="finding-explain"><span className="mini-label">WHY IT MAY MATTER</span><p>{item.why}</p></div><div className="evidence-block"><span className="mini-label">MATCHING AGREEMENT TEXT</span>{item.excerpts.map((excerpt, i) => <blockquote key={i}>“{excerpt}”</blockquote>)}</div><div className="discussion-block"><span className="mini-label">QUESTION TO DISCUSS</span><p>{item.ask}</p></div></div>}
        </article>)}</div> : <div className="empty-filter">No findings in this filter.</div>}
        <details className="text-details"><summary>View extracted agreement text <span>+</span></summary><pre>{result.text}</pre></details>
        <div className="report-footer"><span>SCREENED LOCALLY IN YOUR BROWSER</span><span>{result.analysedAt.toLocaleString()}</span></div>
      </section>}

      <section className="how-section" id="process"><div className="how-title"><p className="eyebrow">A MORE INFORMED FIRST LOOK</p><h2>Evidence first.<br /><em>Clarity always.</em></h2></div><div className="how-grid"><article><span>01</span><h3>Extract</h3><p>Read selectable text from a rental agreement PDF directly in your browser.</p></article><article><span>02</span><h3>Screen</h3><p>Compare wording against transparent rules across common rental clause categories.</p></article><article><span>03</span><h3>Understand</h3><p>Review matched evidence, plain-English context and questions to raise before signing.</p></article></div></section>

      <aside className="disclaimer"><div className="disclaimer-mark">!</div><div><strong>Important — understand the limits</strong><p>Lease Lens is an experimental, rule-based screening tool. It does not use an AI model, provide legal advice, determine whether a clause is enforceable, or guarantee that an agreement is safe. It may miss important wording or flag harmless text. Scanned PDFs are not supported in this version. Have the complete agreement reviewed by a qualified professional familiar with local law before signing.</p></div></aside>
    </main>
    <footer className="footer"><a className="brand" href="#top"><span className="brand-mark">L</span><span>LEASE<span className="brand-light">LENS</span></span></a><span>BUILT FOR A CLEARER FIRST READ · 2026</span><a href="#top">BACK TO TOP ↑</a></footer>
  </div>
}

export default App
