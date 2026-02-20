<p align="center">
  <img src="https://img.shields.io/npm/v/nim-check?color=76b900&label=npm&logo=npm" alt="npm version">
  <img src="https://img.shields.io/node/v/nim-check?color=76b900&logo=node.js" alt="node version">
  <img src="https://img.shields.io/npm/l/nim-check?color=76b900" alt="license">
  <img src="https://img.shields.io/badge/models-44-76b900?logo=nvidia" alt="models count">
</p>

<h1 align="center">⚡ nim-check</h1>

<p align="center">
  <strong>Find the fastest NVIDIA NIM models in seconds</strong><br>
  <sub>Ping 44 free LLM models in parallel — pick the best one for OpenCode, Cursor, or any AI tool</sub>
</p>

<p align="center">
  <img src="demo.gif" alt="nim-check demo" width="100%">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-models">Models</a> •
  <a href="#-how-it-works">How it works</a>
</p>

---

## ✨ Features

> **Why nim-check?** NVIDIA offers 40+ free LLM models via NIM API — but which ones are actually available right now? Which one is fastest? Run `nim-check` and find out in seconds. Then plug the fastest model into OpenCode, Cursor, or any AI coding assistant and code for free.

- **🚀 Parallel pings** — All 44 models tested simultaneously via native `fetch`
- **📊 Real-time animation** — Watch latency appear live in alternate screen buffer
- **🏆 Smart ranking** — Top 3 fastest models highlighted with medals 🥇🥈🥉
- **⏱ 4x reliability** — Each UP model gets 4 pings for accurate average latency
- **🎨 Clean output** — Zero scrollback pollution, only final table remains
- **📶 Status indicators** — UP ✅ · Timeout ⏱ · Down ❌

---

## 📦 Installation

```bash
# npm (global install — recommended)
npm install -g nim-check

# pnpm
pnpm add -g nim-check

# bun
bun add -g nim-check

# Or use directly with npx/pnpx/bunx
npx nim-check YOUR_API_KEY
pnpx nim-check YOUR_API_KEY
bunx nim-check YOUR_API_KEY
```

**Requirements:** Node.js 18+

---

## 🚀 Usage

```bash
# Just run it — will prompt for API key if not set
nim-check
```

Setup wizard:

```
  🔑 Setup your NVIDIA API key
  📝 Get a free key at: https://build.nvidia.com
  💾 Key will be saved to ~/.nim-check

  Enter your API key: nvapi-xxxx-xxxx

  ✓ API key saved to ~/.nim-check
```

### Other ways to provide the key

```bash
# Pass directly
nim-check nvapi-xxxx-your-key-here

# Use environment variable
NVIDIA_API_KEY=nvapi-xxx nim-check

# Or add to your shell profile
export NVIDIA_API_KEY=nvapi-xxxx-your-key-here
nim-check
```

### Get your free API key

1. **Create NVIDIA Account** — Sign up at [build.nvidia.com](https://build.nvidia.com) with your email
2. **Verify** — Confirm email, set privacy options, create NGC account, verify phone
3. **Generate Key** — Go to Profile → API Keys → Generate API Key
4. **Name it** — e.g., "nim-check" or "OpenCode-NIM"
5. **Set expiration** — Choose "Never" for convenience
6. **Copy securely** — Key is shown only once!

> 💡 **Free credits** — NVIDIA offers free credits for NIM models via their API Catalog for developers.

---

## 🤖 Models

**44 models** across 4 tiers, sorted by capability:

| Tier | Count | Models |
|------|-------|--------|
| **S** | 11 | Kimi K2.5, GLM 5, Qwen3 Coder 480B, Qwen3.5 400B VLM, Nemotron Nano 30B, DeepSeek V3.2, Nemotron Ultra 253B, Mistral Large 675B, Qwen3 235B, MiniMax M2.1, Devstral 2 |
| **A** | 13 | GLM 4.7, Kimi K2 Thinking/Instruct, DeepSeek V3.1/Terminus, R1 Distill 14B, QwQ 32B, Qwen3 80B Thinking/Instruct, Qwen2.5 Coder 32B, MiniMax M2, Mistral Medium 3, Magistral Small |
| **B** | 11 | Llama 4 Maverick/Scout, Llama 3.1 405B, Llama 3.3 70B, Nemotron Super 49B, R1 Distill 32B/8B, Colosseum 355B, GPT OSS 120B/20B, Stockmark 100B |
| **C** | 9 | R1 Distill 7B, Seed OSS 36B, Step 3.5 Flash, Mixtral 8x22B, Ministral 14B, Granite 34B Code, Gemma 2 9B, Phi 3.5 Mini, Phi 4 Mini |

### Why these models?

- **S-tier:** Frontier models with best performance/capability
- **A-tier:** Strong alternatives, often faster or specialized
- **B-tier:** Solid performers, good for specific tasks
- **C-tier:** Smaller models, edge-friendly, or older generations

---

## 🔌 Use with OpenCode

Want to use NVIDIA NIM models in [OpenCode](https://github.com/opencode-ai/opencode)? Here's how:

### 1. Find your model

Run `nim-check` to see which models are available and fast. Pick one that suits you (e.g., `meta/llama-3.1-70b-instruct`, `deepseek-ai/deepseek-v3.2`, `moonshotai/kimi-k2-instruct`).

### 2. Configure OpenCode

Run OpenCode and type `/connect`. Scroll to **"Other"** (custom OpenAI-compatible providers), enter ID `nim`, then paste your NVIDIA API key.

### 3. Edit config

Create or edit `~/.config/opencode/opencode.json`:

```json
{
  "providers": {
    "nim": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NVIDIA NIM",
      "options": {
        "baseURL": "https://integrate.api.nvidia.com/v1",
        "apiKey": "env:NVIDIA_NIM_API_KEY"
      },
      "models": {
        "kimi": {
          "id": "moonshotai/kimi-k2.5"
        },
        "deepseek": {
          "id": "deepseek-ai/deepseek-v3.2"
        },
        "llama": {
          "id": "meta/llama-3.3-70b-instruct"
        }
      }
    }
  }
}
```

### 4. Set environment variable

```bash
export NVIDIA_NIM_API_KEY=nvapi-xxxx-your-key-here
# Add to ~/.bashrc or ~/.zshrc for persistence
```

### 5. Use it

Run `/models` in OpenCode and select **NVIDIA NIM > kimi** (or your chosen model). Done!

> ⚠️ **Note:** Free models have usage limits based on NVIDIA's tier — check [build.nvidia.com](https://build.nvidia.com) for quotas.

---

## ⚙️ How it works

```
┌─────────────────────────────────────────────────────────────┐
│  1. Enter alternate screen buffer (like vim/htop/less)      │
│  2. Ping ALL models in parallel                             │
│  3. Re-ping UP models 3 more times for latency reliability  │
│  4. Exit alternate screen                                   │
│  5. Print final sorted table to stdout (stays in history)   │
└─────────────────────────────────────────────────────────────┘
```

**Result:** Clean terminal history with just the final table — no animation garbage.

---

## 📋 API Reference

| Parameter | Description |
|-----------|-------------|
| `NVIDIA_API_KEY` | Environment variable for API key |
| `<api-key>` | First positional argument |

---

## 🔧 Development

```bash
git clone https://github.com/anomaly/nim-check
cd nim-check
npm install
npm start -- YOUR_API_KEY
```

---

## 📄 License

MIT © [vava](https://github.com/anomaly)

---

<p align="center">
  <sub>Built with ☕ and 🌹 by <a href="https://github.com/vava-nessa">vava</a></sub>
</p>
