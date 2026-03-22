// F1 Calendar Dot Widget
// Required file in Scriptable folder:
// f1_2026.txt

const FILE_NAME = "f1_2026.txt"

// ---------- STYLE ----------
const BG = new Color("#4a4a4a")
const TEXT = new Color("#f2f2f2")
const SUBTEXT = new Color("#d6d6d6")

const DOT_DEFAULT = new Color("#ffffff", 0.18)
const DOT_PAST = new Color("#ffffff", 0.5)

const DOT_FP = new Color("#A6051A", 0.75)
const DOT_SPRINT = new Color("#ff5a52", 0.70)
const DOT_QUALI = new Color("#ffd84d", 0.85)
const DOT_RACE = new Color("#57d163", 1.0)

const DOT_SIZE = 6
const COL_GAP = 8
const ROW_GAP = 8

const TOP_PAD = 14
const SIDE_PAD = 14
const BOTTOM_PAD = 14

// ---------- FILE ----------
const fm = FileManager.iCloud()
const path = fm.joinPath(fm.documentsDirectory(), FILE_NAME)

if (!fm.fileExists(path)) {
  let w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(14, 14, 14, 14)

  let t = w.addText("Missing file")
  t.textColor = TEXT
  t.font = Font.boldSystemFont(13)

  w.addSpacer(4)

  let t2 = w.addText(FILE_NAME)
  t2.textColor = SUBTEXT
  t2.font = Font.systemFont(10)
  t2.lineLimit = 1
  t2.minimumScaleFactor = 0.5

  Script.setWidget(w)
  if (!config.runsInWidget) w.presentSmall()
  Script.complete()
} else {
  await fm.downloadFileFromiCloud(path)
  const raw = fm.readString(path)

  // ---------- PARSE EVENTS ----------
  function parseEvents(text) {
    const lines = text.split("\n")
    const events = []

    for (let line of lines) {
      line = line.trim()
      if (!line) continue

      const parts = line.split(" | ")
      if (parts.length !== 3) continue

      const [datetime, gp, session] = parts
      const d = new Date(datetime.replace(" ", "T"))
      if (isNaN(d.getTime())) continue

      events.push({
        date: d,
        gp: gp.trim(),
        session: session.trim().toLowerCase()
      })
    }

    events.sort((a, b) => a.date - b.date)
    return events
  }

  const events = parseEvents(raw)

  // ---------- HELPERS ----------
  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  function startDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  function isPast(d) {
    return startDay(d) < startDay(new Date())
  }

  function daysUntil(d) {
    return Math.ceil((startDay(d) - startDay(new Date())) / 86400000)
  }

  function mondayIndex(day) {
    return (day + 6) % 7
  }

  function addDays(d, n) {
    let x = new Date(d)
    x.setDate(x.getDate() + n)
    return x
  }

  function shortName(name) {
    const map = {
      "Australian Grand Prix": "Australia",
      "Chinese Grand Prix": "China",
      "Japanese Grand Prix": "Japan",
      "Saudi Arabian Grand Prix": "Saudi Arabia",
      "Miami Grand Prix": "Miami",
      "Emilia-Romagna Grand Prix": "Imola",
      "Monaco Grand Prix": "Monaco",
      "Spanish Grand Prix": "Spain",
      "Spanish Grand Prix (Madrid)": "Madrid",
      "Barcelona-Catalunya Grand Prix": "Barcelona",
      "Canadian Grand Prix": "Canada",
      "Austrian Grand Prix": "Austria",
      "British Grand Prix": "Britain",
      "Belgian Grand Prix": "Belgium",
      "Hungarian Grand Prix": "Hungary",
      "Dutch Grand Prix": "Netherlands",
      "Italian Grand Prix": "Italy",
      "Azerbaijan Grand Prix": "Azerbaijan",
      "Singapore Grand Prix": "Singapore",
      "United States Grand Prix": "USA",
      "Mexico City Grand Prix": "Mexico",
      "Sao Paulo Grand Prix": "Brazil",
      "São Paulo Grand Prix": "Brazil",
      "Las Vegas Grand Prix": "Las Vegas",
      "Qatar Grand Prix": "Qatar",
      "Abu Dhabi Grand Prix": "Abu Dhabi"
    }
    return map[name] || name.replace(" Grand Prix", "").trim()
  }

  // ---------- BUILD GP MAP ----------
  let gpMap = {}
  for (let e of events) {
    if (!gpMap[e.gp]) gpMap[e.gp] = []
    gpMap[e.gp].push(e)
  }

  let groups = Object.values(gpMap)
  for (let g of groups) g.sort((a, b) => a.date - b.date)
  groups.sort((a, b) => a[0].date - b[0].date)

  // ---------- NEXT RACE / FALLBACK ----------
  let nextGP = null
  let targetSession = null
  let referenceDate = new Date()

  for (let g of groups) {
    let sprint = g.find(e => e.session === "sprint")
    let quali = g.find(e => e.session === "qualifying")
    let race = g.find(e => e.session === "race")

    let prefTarget = sprint || quali
    if (prefTarget && prefTarget.date > new Date()) {
      nextGP = g[0].gp
      targetSession = prefTarget
      referenceDate = prefTarget.date
      break
    }

    if (race && race.date > new Date()) {
      nextGP = g[0].gp
      targetSession = race
      referenceDate = race.date
      break
    }
  }

  if (!nextGP && groups.length > 0) {
    let g = groups[groups.length - 1]
    let sprint = g.find(e => e.session === "sprint")
    let quali = g.find(e => e.session === "qualifying")
    let race = g.find(e => e.session === "race")
    nextGP = g[0].gp
    targetSession = sprint || quali || race || g[g.length - 1]
    referenceDate = targetSession.date
  }

  // ---------- COLOR LOGIC ----------
  function getSessionsForDate(d) {
    return events.filter(e => sameDay(e.date, d)).map(e => e.session)
  }

  function drawSplitDot(size, leftColor, rightColor) {
    let ctx = new DrawContext()
    ctx.size = new Size(size, size)
    ctx.opaque = false
    ctx.respectScreenScale = true
    ctx.setFillColor(leftColor)
    ctx.fillEllipse(new Rect(0, 0, size, size))
    let path = new Path()
    path.addEllipse(new Rect(0, 0, size, size))
    ctx.addPath(path)
    ctx.clip()
    ctx.setFillColor(rightColor)
    ctx.fillRect(new Rect(size / 2, 0, size / 2, size))
    return ctx.getImage()
  }

  function drawTodayRingDot(size, fillColor) {
    const inset = 1.5
    let ctx = new DrawContext()
    ctx.size = new Size(size, size)
    ctx.opaque = false
    ctx.respectScreenScale = true
    ctx.setFillColor(new Color("#ffffff", 0.85))
    ctx.fillEllipse(new Rect(0, 0, size, size))
    ctx.setFillColor(fillColor)
    ctx.fillEllipse(new Rect(inset, inset, size - 2 * inset, size - 2 * inset))
    return ctx.getImage()
  }

  function drawSplitTodayRingDot(size, leftColor, rightColor) {
    const inset = 1.5
    const inner = size - 2 * inset
    let ctx = new DrawContext()
    ctx.size = new Size(size, size)
    ctx.opaque = false
    ctx.respectScreenScale = true
    ctx.setFillColor(new Color("#ffffff", 0.85))
    ctx.fillEllipse(new Rect(0, 0, size, size))
    let path = new Path()
    path.addEllipse(new Rect(inset, inset, inner, inner))
    ctx.addPath(path)
    ctx.clip()
    ctx.setFillColor(leftColor)
    ctx.fillRect(new Rect(inset, inset, inner / 2, inner))
    ctx.setFillColor(rightColor)
    ctx.fillRect(new Rect(inset + inner / 2, inset, inner / 2, inner))
    return ctx.getImage()
  }

  function styleCell(cell, d) {
    const allSessions = getSessionsForDate(d)
    const now = new Date()
    const sessions = events.filter(e => sameDay(e.date, d) && e.date > now).map(e => e.session)
    const past = isPast(d) || (allSessions.length > 0 && sessions.length === 0)
    const today = sameDay(d, new Date())

    if (past) {
      cell.backgroundColor = DOT_PAST
      return
    }

    if (sessions.length === 0) {
      if (today) cell.backgroundImage = drawTodayRingDot(DOT_SIZE, BG)
      else cell.backgroundColor = DOT_DEFAULT
      return
    }

    const hasSprint = sessions.includes("sprint")
    const hasSprintQuali = sessions.includes("sprint qualifying")
    const hasQuali = sessions.includes("qualifying") || hasSprintQuali
    const hasRace = sessions.includes("race")
    const hasPractice = sessions.some(s => s.startsWith("practice"))

    // All three on same day — show quali/race split, sprint implied
    if (hasRace && hasQuali && hasSprint) {
      cell.backgroundImage = today
        ? drawSplitTodayRingDot(DOT_SIZE, DOT_QUALI, DOT_RACE)
        : drawSplitDot(DOT_SIZE, DOT_QUALI, DOT_RACE)
      return
    }

    // Race + Quali same day
    if (hasRace && hasQuali) {
      cell.backgroundImage = today
        ? drawSplitTodayRingDot(DOT_SIZE, DOT_QUALI, DOT_RACE)
        : drawSplitDot(DOT_SIZE, DOT_QUALI, DOT_RACE)
      return
    }

    // Race + Sprint same day
    if (hasRace && hasSprint) {
      cell.backgroundImage = today
        ? drawSplitTodayRingDot(DOT_SIZE, DOT_SPRINT, DOT_RACE)
        : drawSplitDot(DOT_SIZE, DOT_SPRINT, DOT_RACE)
      return
    }

    // Race alone
    if (hasRace) {
      if (today) cell.backgroundImage = drawTodayRingDot(DOT_SIZE, DOT_RACE)
      else cell.backgroundColor = DOT_RACE
      return
    }

    // Sprint + Quali same day — red (sprint takes priority)
    if (hasSprint && hasQuali) {
      if (today) cell.backgroundImage = drawTodayRingDot(DOT_SIZE, DOT_SPRINT)
      else cell.backgroundColor = DOT_SPRINT
      return
    }

    // Quali alone — always yellow
    if (hasQuali) {
      if (today) cell.backgroundImage = drawTodayRingDot(DOT_SIZE, DOT_QUALI)
      else cell.backgroundColor = DOT_QUALI
      return
    }

    // Sprint alone — red
    if (hasSprint) {
      if (today) cell.backgroundImage = drawTodayRingDot(DOT_SIZE, DOT_SPRINT)
      else cell.backgroundColor = DOT_SPRINT
      return
    }

    // Practice only
    if (hasPractice) {
      if (today) cell.backgroundImage = drawTodayRingDot(DOT_SIZE, DOT_FP)
      else cell.backgroundColor = DOT_FP
      return
    }

    cell.backgroundColor = DOT_DEFAULT
  }

  // ---------- CALENDAR ----------
  let monthBase = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  let start = addDays(monthBase, -mondayIndex(monthBase.getDay()))

  const GRID_WIDTH = 7 * DOT_SIZE + 6 * COL_GAP

  // ---------- WIDGET ----------
  let w = new ListWidget()
  w.backgroundColor = BG
  w.setPadding(TOP_PAD, SIDE_PAD, BOTTOM_PAD, SIDE_PAD)

  let titleText = nextGP ? shortName(nextGP) : "No race"
  let subText = ""

  if (targetSession) {
    const n = daysUntil(targetSession.date)
    const label = targetSession.session.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")
    if (n < 0) subText = "Season complete"
    else if (n === 0) {
      const totalMins = Math.ceil((targetSession.date - new Date()) / 60000)
      const hrs = Math.floor(totalMins / 60)
      const mins = totalMins % 60
      const timeStr = hrs > 0 ? `${hrs}h ${String(mins).padStart(2, "0")}m` : `${mins}m`
      subText = `${label} in ${timeStr}`
    }
    else if (n === 1) subText = `1 day to ${label}`
    else subText = `${n} days to ${label}`
  }

  w.addSpacer()

  let titleRow = w.addStack()
  titleRow.layoutHorizontally()
  titleRow.addSpacer()

  let titleCol = titleRow.addStack()
  titleCol.layoutVertically()
  titleCol.size = new Size(GRID_WIDTH, 0)

  let title = titleCol.addText(titleText)
  title.textColor = TEXT
  title.font = Font.boldSystemFont(12)
  title.lineLimit = 1
  title.minimumScaleFactor = 0.55

  titleCol.addSpacer(1)

  let sub = titleCol.addText(subText)
  sub.textColor = SUBTEXT
  sub.font = Font.systemFont(9)
  sub.lineLimit = 1
  sub.minimumScaleFactor = 0.55

  titleRow.addSpacer()

  w.addSpacer(8)

  let gridWrap = w.addStack()
  gridWrap.layoutHorizontally()
  gridWrap.addSpacer()

  let grid = gridWrap.addStack()
  grid.layoutVertically()
  grid.size = new Size(GRID_WIDTH, 0)

  let renderedRows = 0
  for (let r = 0; r < 6; r++) {
    let hasDotsInRow = false
    for (let c = 0; c < 7; c++) {
      let d = addDays(start, r * 7 + c)
      if (d.getMonth() === monthBase.getMonth()) { hasDotsInRow = true; break }
    }
    if (!hasDotsInRow) continue

    if (renderedRows > 0) grid.addSpacer(ROW_GAP)
    renderedRows++

    let row = grid.addStack()
    row.layoutHorizontally()

    for (let c = 0; c < 7; c++) {
      let d = addDays(start, r * 7 + c)
      const inMonth = d.getMonth() === monthBase.getMonth()

      if (!inMonth) {
        let placeholder = row.addStack()
        placeholder.size = new Size(DOT_SIZE, DOT_SIZE)
      } else {
        let cell = row.addStack()
        cell.size = new Size(DOT_SIZE, DOT_SIZE)
        cell.cornerRadius = DOT_SIZE / 2
        styleCell(cell, d)
      }

      if (c < 6) row.addSpacer(COL_GAP)
    }
  }

  gridWrap.addSpacer()

  w.addSpacer()

  const now = new Date()
  if (targetSession && daysUntil(targetSession.date) === 0) {
    w.refreshAfterDate = new Date(now.getTime() + 5 * 60 * 1000)
  } else {
    w.refreshAfterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  }

  w.url = "formula1://"

  Script.setWidget(w)
  if (!config.runsInWidget) w.presentSmall()
  Script.complete()
}