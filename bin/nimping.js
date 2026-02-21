#!/usr/bin/env node
/**
 * @file nimping.js
 * @description Live terminal availability checker for NVIDIA NIM LLM models.
 *
 * @details
 *   This CLI tool discovers and benchmarks NVIDIA NIM language models optimized for coding.
 *   It runs in an alternate screen buffer, pings all models in parallel, re-pings successful ones
 *   multiple times for reliable latency measurements, and prints a clean final table.
 *   Features include animated spinner, colored latency cells, top-3 highlighting, and persistent API key storage.
 *
 *   Key functions:
 *   - `loadApiKey` / `saveApiKey`: Manage persisted API key in ~/.nimping
 *   - `ping`: Perform HTTP request to NIM endpoint with timeout handling
 *   - `renderTable`: Generate ASCII table with colored latency indicators and status emojis
 *   - `main`: Orchestrates CLI flow, wizard, ping loops, animation, and output
 *
 *   The tool uses Node's `fetch` (requires Node 18+), `chalk` for styling,
 *   and `readline` for interactive key setup.
 *   Animation frames are defined in `FRAMES` and rendered at `FPS` frames per second.
 *   Output columns include model tier, name, ping latencies, average latency, and status.
 */

import chalk from 'chalk'
import { createRequire } from 'module'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const require = createRequire(import.meta.url)
const readline = require('readline')

// ─── Config path ──────────────────────────────────────────────────────────────
const CONFIG_PATH = join(homedir(), '.nimping')

function loadApiKey() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return readFileSync(CONFIG_PATH, 'utf8').trim()
    }
  } catch {}
  return null
}

function saveApiKey(key) {
  try {
    writeFileSync(CONFIG_PATH, key, { mode: 0o600 })
  } catch {}
}

// ─── First-run wizard ─────────────────────────────────────────────────────────
async function promptApiKey() {
  console.log()
  console.log(chalk.dim('  🔑 Setup your NVIDIA API key'))
  console.log(chalk.dim('  📝 Get a free key at: ') + chalk.cyanBright('https://build.nvidia.com'))
  console.log(chalk.dim('  💾 Key will be saved to ~/.nimping'))
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(chalk.bold('  Enter your API key: '), (answer) => {
      rl.close()
      const key = answer.trim()
      if (key) {
        saveApiKey(key)
        console.log()
        console.log(chalk.green('  ✅ API key saved to ~/.nimping'))
        console.log()
      }
      resolve(key || null)
    })
  })
}

// ─── Alternate screen control ─────────────────────────────────────────────────
// 📖 \x1b[?1049h = enter alt screen  \x1b[?1049l = leave alt screen
// 📖 \x1b[?25l   = hide cursor       \x1b[?25h   = show cursor
// 📖 \x1b[H      = cursor to top     \x1b[2J     = clear screen
const ALT_ENTER  = '\x1b[?1049h\x1b[?25l'
const ALT_LEAVE  = '\x1b[?1049l\x1b[?25h'
const ALT_CLEAR  = '\x1b[H\x1b[2J'

// ─── Model registry ───────────────────────────────────────────────────────────
// 📖 [model_id, display_label, tier] — sorted best to worst within each tier
const MODELS = [
  // ── S-tier (11 models) ─────────────────────────────────────────────────────
  ['moonshotai/kimi-k2.5',                         'Kimi K2.5',           'S'],
  ['z-ai/glm5',                                    'GLM 5',               'S'],
  ['qwen/qwen3-coder-480b-a35b-instruct',          'Qwen3 Coder 480B',    'S'],
  ['qwen/qwen3.5-397b-a17b',                       'Qwen3.5 400B VLM',    'S'],
  ['nvidia/nemotron-3-nano-30b-a3b',               'Nemotron Nano 30B',   'S'],
  ['deepseek-ai/deepseek-v3.2',                    'DeepSeek V3.2',       'S'],
  ['nvidia/llama-3.1-nemotron-ultra-253b-v1',      'Nemotron Ultra 253B', 'S'],
  ['mistralai/mistral-large-3-675b-instruct-2512', 'Mistral Large 675B',  'S'],
  ['qwen/qwen3-235b-a22b',                         'Qwen3 235B',          'S'],
  ['minimaxai/minimax-m2.1',                       'MiniMax M2.1',        'S'],
  ['mistralai/devstral-2-123b-instruct-2512',      'Devstral 2 123B',     'S'],
  // ── A-tier (13 models) ─────────────────────────────────────────────────────
  ['z-ai/glm4.7',                                  'GLM 4.7',             'A'],
  ['moonshotai/kimi-k2-thinking',                  'Kimi K2 Thinking',    'A'],
  ['moonshotai/kimi-k2-instruct',                  'Kimi K2 Instruct',    'A'],
  ['deepseek-ai/deepseek-v3.1',                    'DeepSeek V3.1',       'A'],
  ['deepseek-ai/deepseek-v3.1-terminus',           'DeepSeek V3.1 Term',  'A'],
  ['deepseek-ai/deepseek-r1-distill-qwen-14b',     'R1 Distill 14B',      'A'],
  ['qwen/qwq-32b',                                 'QwQ 32B',             'A'],
  ['qwen/qwen3-next-80b-a3b-thinking',             'Qwen3 80B Thinking',  'A'],
  ['qwen/qwen3-next-80b-a3b-instruct',             'Qwen3 80B Instruct',  'A'],
  ['qwen/qwen2.5-coder-32b-instruct',              'Qwen2.5 Coder 32B',   'A'],
  ['minimaxai/minimax-m2',                         'MiniMax M2',          'A'],
  ['mistralai/mistral-medium-3-instruct',          'Mistral Medium 3',    'A'],
  ['mistralai/magistral-small-2506',               'Magistral Small',     'A'],
  // ── B-tier (11 models) ─────────────────────────────────────────────────────
  ['meta/llama-4-maverick-17b-128e-instruct',      'Llama 4 Maverick',    'B'],
  ['meta/llama-4-scout-17b-16e-instruct',          'Llama 4 Scout',       'B'],
  ['meta/llama-3.1-405b-instruct',                 'Llama 3.1 405B',      'B'],
  ['meta/llama-3.3-70b-instruct',                  'Llama 3.3 70B',       'B'],
  ['nvidia/llama-3.3-nemotron-super-49b-v1.5',     'Nemotron Super 49B',  'B'],
  ['deepseek-ai/deepseek-r1-distill-qwen-32b',     'R1 Distill 32B',      'B'],
  ['deepseek-ai/deepseek-r1-distill-llama-8b',     'R1 Distill 8B',       'B'],
  ['igenius/colosseum_355b_instruct_16k',          'Colosseum 355B',      'B'],
  ['openai/gpt-oss-120b',                          'GPT OSS 120B',        'B'],
  ['openai/gpt-oss-20b',                           'GPT OSS 20B',         'B'],
  ['stockmark/stockmark-2-100b-instruct',          'Stockmark 100B',      'B'],
  // ── C-tier (9 models) ──────────────────────────────────────────────────────
  ['deepseek-ai/deepseek-r1-distill-qwen-7b',      'R1 Distill 7B',       'C'],
  ['bytedance/seed-oss-36b-instruct',              'Seed OSS 36B',        'C'],
  ['stepfun-ai/step-3.5-flash',                    'Step 3.5 Flash',      'C'],
  ['mistralai/mixtral-8x22b-instruct-v0.1',        'Mixtral 8x22B',       'C'],
  ['mistralai/ministral-14b-instruct-2512',        'Ministral 14B',       'C'],
  ['ibm/granite-34b-code-instruct',                'Granite 34B Code',    'C'],
  ['google/gemma-2-9b-it',                         'Gemma 2 9B',          'C'],
  ['microsoft/phi-3.5-mini-instruct',              'Phi 3.5 Mini',        'C'],
  ['microsoft/phi-4-mini-instruct',                'Phi 4 Mini',          'C'],
]

const NIM_URL      = 'https://integrate.api.nvidia.com/v1/chat/completions'
const PING_TIMEOUT  = 20_000   // 📖 20s per attempt before abort
const MAX_ATTEMPTS  = 4        // 📖 up to 4 tries before declaring final T/O
const NUM_PINGS    = 4
const FPS          = 12
const COL_MODEL    = 22
// 📖 COL_MS = dashes in hline per ping column = visual width including 2 padding spaces
// 📖 Max value: 12001ms = 7 chars. padStart(COL_MS-2) fits content, +2 spaces = COL_MS dashes
// 📖 COL_MS 11 → content padded to 9 → handles up to "12001ms" (7 chars) with room
const COL_MS       = 11

// ─── Styling ──────────────────────────────────────────────────────────────────
const TIER_COLOR = {
  S: chalk.bold.yellowBright,
  A: chalk.bold.cyanBright,
  B: chalk.bold.greenBright,
  C: chalk.dim,
}

// 📖 COL_MS - 2 = visual content width (the 2 padding spaces are handled by │ x │ template)
const CELL_W = COL_MS - 2  // 9 chars of content per ms cell

const msCell = (ms) => {
  if (ms === null) return chalk.dim('—'.padStart(CELL_W))
  const str = String(ms).padStart(CELL_W)
  if (ms < 500)  return chalk.greenBright(str)
  if (ms < 1500) return chalk.yellow(str)
  return chalk.red(str)
}

const FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']
// 📖 Spinner cell: braille (1-wide) + padding to fill CELL_W visual chars
const spinCell = (f, o = 0) => chalk.dim.yellow(FRAMES[(f + o) % FRAMES.length].padEnd(CELL_W))

// ─── Table renderer ───────────────────────────────────────────────────────────

function renderTable(results, pendingPings, frame, tierFilter = null) {
  const up      = results.filter(r => r.status === 'up').length
  const down    = results.filter(r => r.status === 'down').length
  const timeout = results.filter(r => r.status === 'timeout').length
  const pending = results.filter(r => r.status === 'pending').length

  const phase = pending > 0
    ? chalk.dim(`discovering — ${pending} remaining…`)
    : pendingPings > 0
      ? chalk.dim(`measuring latency — ${pendingPings} pings in flight…`)
      : chalk.dim('complete ✓')

  // 📖 Keep original order from MODELS array (sorted by idx)
  const sorted = results

  // 📖 Compute top-3 avg rankings — only for UP models with all 4 pings complete
  // 📖 Used to apply background highlight on the Avg cell of the 3 fastest models
  const finishedUp = results.filter(r => r.status === 'up' && r.ping1 && r.ping2 && r.ping3 && r.ping4)
  const top3ids = finishedUp
    .map(r => ({ idx: r.idx, avg: Math.round((r.ping1 + r.ping2 + r.ping3 + r.ping4) / 4) }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3)
    .map(r => r.idx)

  const W  = COL_MODEL
  // 📖 col() — right-aligns text in a fixed-width column, no borders, just spaces
  const col = (txt, w) => txt.padStart(w)

  const tierLabel = tierFilter ? chalk.dim(`  [tier: ${tierFilter.join(', ')}]`) : ''

  const lines = [
    '',
    `  ${chalk.bold('⚡ NIM Coding Models')}${tierLabel}   ` +
      chalk.greenBright(`✅ ${up}`) + chalk.dim(' up  ') +
      chalk.yellow(`⏱ ${timeout}`) + chalk.dim(' t/o  ') +
      chalk.red(`❌ ${down}`) + chalk.dim(' down  ') +
      phase,
    '',
    // 📖 Header row — same spacing as data rows, dim text
    `  ${chalk.dim(col('#', 3))}  ${chalk.dim('Tier'.padEnd(4))}  ${chalk.dim('Model'.padEnd(W))}  ` +
      [1,2,3,4].map(n => chalk.dim(`PING${n}`.padStart(CELL_W))).join('  ') +
      `  ${chalk.dim('Avg'.padStart(CELL_W))}  ${chalk.dim('Status')}`,
    // 📖 Thin underline under header using dim dashes
    `  ${chalk.dim('─'.repeat(3))}  ${'─'.repeat(4)}  ${'─'.repeat(W)}  ` +
      Array(NUM_PINGS).fill(chalk.dim('─'.repeat(CELL_W))).join('  ') +
      `  ${chalk.dim('─'.repeat(CELL_W))}  ${chalk.dim('─'.repeat(9))}`,
  ]

  for (const r of sorted) {
    const tierFn = TIER_COLOR[r.tier] ?? chalk.white
    const num    = chalk.dim(String(r.idx).padStart(3))
    const tier   = tierFn(r.tier.padEnd(4))
    
    // 📖 Emoji prefix for name: medals for top 3, poop for slow (>3s avg)
    const rank = top3ids.indexOf(r.idx)
    let namePrefix = ''
    let nameWidth = W
    if (r.status === 'up' && r.ping1 && r.ping2 && r.ping3 && r.ping4) {
      const valid = [r.ping1, r.ping2, r.ping3, r.ping4].filter(p => p !== null)
      const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b) / valid.length) : null
      if (avg !== null && avg > 3000) {
        namePrefix = '💩 '
        nameWidth = W - 2
      } else if (rank !== -1) {
        namePrefix = rank === 0 ? '🥇 ' : rank === 1 ? '🥈 ' : '🥉 '
        nameWidth = W - 2
      }
    }
    const name = (namePrefix + r.label.slice(0, nameWidth)).padEnd(W)
    let p1, p2, p3, p4, avgCell, status

    // 📖 Status column visual width = 11 (COL_MS dashes in hline)
    // 📖 Template: │ + space + CONTENT + space + │  →  content = 9 visual chars
    //
    // 📖 Emoji visual widths (East Asian Width standard):
    //   ✅ U+2705 = 2 cols wide  →  emoji(2) + text(7) = 9 visual ✓
    //   ❌ U+274C = 2 cols wide  →  emoji(2) + text(7) = 9 visual ✓
    //   ⏱ U+23F1 = 1 col  wide  →  emoji(1) + text(8) = 9 visual ✓
    //   ⠋ braille  = 1 col wide →  emoji(1) + text(8) = 9 visual ✓
    const dash9 = chalk.dim('—'.padStart(CELL_W))
    if (r.status === 'pending') {
      p1 = p2 = p3 = p4 = avgCell = dash9
      status = chalk.dim.yellow(`${FRAMES[frame % FRAMES.length]}${'  wait  '}`)  // 1+8 = 9 visual

    } else if (r.status === 'up') {
      const pings = [r.ping1, r.ping2, r.ping3, r.ping4]
      ;[p1, p2, p3, p4] = pings.map((p, i) => p !== null ? msCell(p) : spinCell(frame, i * 3))
      const valid = pings.filter(p => p !== null)
      const avg   = valid.length ? Math.round(valid.reduce((a, b) => a + b) / valid.length) : null
      if (avg !== null) {
        const str = String(avg).padStart(CELL_W)
        const rank = top3ids.indexOf(r.idx)
        // 📖 Avg cell: just the number, colored for top 3
        avgCell = rank === 0  ? chalk.bold.yellowBright(str)
                : rank === 1  ? chalk.bold.gray(str)
                : rank === 2  ? chalk.bold.yellow(str)
                : chalk.bold.cyanBright(str)
      } else {
        avgCell = spinCell(frame)
      }
      status  = chalk.bold.greenBright('✅') + chalk.bold.greenBright('  UP     ')  // 2+7 = 9 visual

    } else if (r.status === 'retrying') {
      p1 = p2 = p3 = p4 = avgCell = dash9
      // 📖 Show which attempt we're on (e.g. "retry 2/4") while still trying
      const attempt = r.attempt ?? 2
      status = chalk.yellow(`${FRAMES[frame % FRAMES.length]}`) + chalk.yellow(` retry ${attempt}/${MAX_ATTEMPTS}`)

    } else if (r.status === 'timeout') {
      p1 = p2 = p3 = p4 = avgCell = dash9
      status = chalk.bold.yellow('⏱') + chalk.bold.yellow('  T/O    ')             // 1+8 = 9 visual

    } else {
      p1 = p2 = p3 = p4 = avgCell = dash9
      const code = (r.httpCode ?? 'ERR').slice(0, 5)
      status = chalk.bold.red('❌') + chalk.bold.red(` ${code.padEnd(6)}`)          // 2+7 = 9 visual
    }

    // 📖 Dark green background for top 3 winners
    const isTop3 = top3ids.includes(r.idx) && r.status === 'up'
    const row = `  ${num}  ${tier}  ${name}  ${p1}  ${p2}  ${p3}  ${p4}  ${avgCell}  ${status}`
    lines.push(isTop3 ? chalk.bgRgb(0, 100, 0)(row) : row)
  }

  lines.push('')
  return lines.join('\n')
}

// ─── HTTP ping ────────────────────────────────────────────────────────────────

async function ping(apiKey, modelId) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT)
  const t0    = performance.now()
  try {
    const resp = await fetch(NIM_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
    })
    return { code: String(resp.status), ms: Math.round(performance.now() - t0) }
  } catch (err) {
    return { code: err.name === 'AbortError' ? '000' : 'ERR', ms: Math.round(performance.now() - t0) }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 📖 Parse --tier flag before resolving the API key
  const args = process.argv.slice(2)
  const tierIdx = args.indexOf('--tier')
  let tierFilter = null
  if (tierIdx !== -1) {
    const val = args[tierIdx + 1]
    if (!val || val.startsWith('--')) {
      console.error(chalk.red('  ✖ --tier requires a value, e.g. --tier S or --tier S,A'))
      process.exit(1)
    }
    tierFilter = val.toUpperCase().split(',').map(t => t.trim())
    const validTiers = new Set(['S', 'A', 'B', 'C'])
    const invalid = tierFilter.filter(t => !validTiers.has(t))
    if (invalid.length) {
      console.error(chalk.red(`  ✖ Unknown tier(s): ${invalid.join(', ')}. Valid tiers: S, A, B, C`))
      process.exit(1)
    }
    args.splice(tierIdx, 2)
  }

  // 📖 Priority: CLI arg (first non-flag) > env var > saved config > wizard
  let apiKey = args.find(a => !a.startsWith('--')) || process.env.NVIDIA_API_KEY || loadApiKey()

  if (!apiKey) {
    apiKey = await promptApiKey()
    if (!apiKey) {
      console.log()
      console.log(chalk.red('  ✖ No API key provided.'))
      console.log(chalk.dim('  Run `nimping` again or set NVIDIA_API_KEY env var.'))
      console.log()
      process.exit(1)
    }
  }

  const activeModels = tierFilter ? MODELS.filter(([,, tier]) => tierFilter.includes(tier)) : MODELS
  if (activeModels.length === 0) {
    console.error(chalk.red(`  ✖ No models found for tier(s): ${tierFilter.join(', ')}`))
    process.exit(1)
  }

  const results = activeModels.map(([modelId, label, tier], i) => ({
    idx: i + 1, modelId, label, tier,
    status: 'pending',
    ping1: null, ping2: null, ping3: null, ping4: null,
    httpCode: null,
  }))

  const state = { results, pendingPings: 0, frame: 0 }

  // 📖 Enter alternate screen — animation runs here, zero scrollback pollution
  process.stdout.write(ALT_ENTER)

  // 📖 Ensure we always leave alt screen cleanly (Ctrl+C, crash, normal exit)
  const exit = (code = 0) => {
    clearInterval(ticker)
    process.stdout.write(ALT_LEAVE)
    process.exit(code)
  }
  process.on('SIGINT',  () => exit(0))
  process.on('SIGTERM', () => exit(0))

  // 📖 Animation loop: clear alt screen + redraw table at FPS
  const ticker = setInterval(() => {
    state.frame++
    process.stdout.write(ALT_CLEAR + renderTable(state.results, state.pendingPings, state.frame, tierFilter))
  }, Math.round(1000 / FPS))

  process.stdout.write(ALT_CLEAR + renderTable(state.results, state.pendingPings, state.frame, tierFilter))

  // ── Ping all models — retry up to MAX_ATTEMPTS times for timeouts ────────────
  await Promise.all(results.map(async (r) => {
    let code, ms

    // 📖 Attempt loop: keep retrying on timeout up to MAX_ATTEMPTS before giving up
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        r.status  = 'retrying'
        r.attempt = attempt
      }
      ;({ code, ms } = await ping(apiKey, r.modelId))
      // 📖 Stop retrying as soon as we get any non-timeout response (200 or HTTP error)
      if (code !== '000') break
    }

    r.ping1 = ms

    if (code === '200') {
      r.status = 'up'
      state.pendingPings += 3
      r._extra = [
        ping(apiKey, r.modelId).then(({ ms }) => { r.ping2 = ms; state.pendingPings-- }),
        ping(apiKey, r.modelId).then(({ ms }) => { r.ping3 = ms; state.pendingPings-- }),
        ping(apiKey, r.modelId).then(({ ms }) => { r.ping4 = ms; state.pendingPings-- }),
      ]
    } else {
      r.status = code === '000' ? 'timeout' : 'down'
      if (code !== '000') r.httpCode = code
    }
  }))

  await Promise.all(results.flatMap(r => r._extra ?? []))

  clearInterval(ticker)

  // 📖 Leave alt screen — user is back in normal terminal
  // 📖 Print final table exactly once into normal stdout (stays in scrollback)
  process.stdout.write(ALT_LEAVE)
  process.stdout.write(renderTable(state.results, 0, state.frame, tierFilter) + '\n')
}

main().catch((err) => {
  process.stdout.write(ALT_LEAVE)
  console.error(err)
  process.exit(1)
})
