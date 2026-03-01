# Roblox Studio Gemini Agent

A Rust and Electron-based AI agent that bridges Google Gemini API and Roblox Studio. It comes with a premium ChatGPT-style desktop UI, allowing you to control Studio using natural language.

## Architecture

```
Electron App (UI) ──HTTP──→ Rust Agent
                               ├──→ Google Gemini API
                               └──→ Roblox Studio Plugin (HTTP long-polling)
```

1. You type a prompt in the Electron app (e.g., "Add a red part to Workspace")
2. The Rust agent streams the prompt to the Gemini API
3. Gemini returns the appropriate tool call (e.g., `run_code`)
4. The agent forwards the command to the Roblox Studio plugin over HTTP
5. The plugin executes the command and sends back the result
6. The agent streams the result to the UI, which renders it elegantly with markdown and syntax highlighting

## Available Tools

| Tool | Description |
|------|-------------|
| `run_code` | Runs Luau code in Roblox Studio and returns printed output |
| `insert_model` | Searches the Roblox Creator Store and inserts a model into workspace |
| `get_console_output` | Retrieves the Studio console output |
| `start_stop_play` | Switches between Play / Stop / Run Server modes |
| `run_script_in_play_mode` | Runs a script in play mode, auto-stops when finished or timed out |
| `get_studio_mode` | Returns the current Studio mode (`start_play`, `run_server`, `stop`) |

---

## Setup

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (includes cargo)
- [Node.js](https://nodejs.org/) (includes npm, required for the UI)
- [Roblox Studio](https://create.roblox.com/docs/en-us/studio/setup) installed and launched at least once
- A [Google Gemini API Key](https://aistudio.google.com/apikey)

### 1. Install Dependencies (if not already installed)

**macOS / Linux:**
```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

**Windows:**
Download and run [rustup-init.exe](https://win.rustup.rs/).

### 2. Clone the Repository

```bash
git clone https://github.com/user/studio-rust-mcp-server-gemini-api.git
cd studio-rust-mcp-server-gemini-api
```

### 3. Build the Project

```bash
cargo build --release
```

The first build will take a few minutes as it downloads and compiles all dependencies.

### 4. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copy the generated key. (You can paste this directly into the UI later).

### 5. Install the Roblox Studio Plugin

```bash
cargo run --release -- --install
```

This copies the `MCPStudioPlugin.rbxm` file into Roblox Studio's Plugins directory.

### 6. Restart Roblox Studio

Close and reopen Studio so the plugin loads. Verify that the **MCP** button appears under the **Plugins** tab.

---

## Usage

### Start the Agent

Simply run the agent from the project root:
```bash
cargo run --release
```

The Rust backend will start and automatically launch the Electron UI. On the first run, it will automatically run `npm install` in the `electron` directory, which might take a few seconds.

### The UI

Once the UI opens:
1. Click the **Settings** gear icon (or wait for the automatic popup).
2. Paste your **Gemini API Key** and click "Save & Connect".
3. Verify the status at the bottom changes to **Connected to Gemini** 🟢.
4. Type your prompt!

You can also pre-configure the key using an environment variable before starting:
```bash
export GEMINI_API_KEY="YOUR_API_KEY_HERE"
cargo run --release
```

### Features
- **Dark / Light Theme**: Click the sun/moon icon in the title bar.
- **Markdown Rendering**: Full support for tables, lists, and formatted text.
- **Syntax Highlighting**: Code snippets are beautifully highlighted with a copy button.
- **Real-time Streaming**: Watch Gemini type its response and execute tools in real time.
- **Collapsible Tool Calls**: See exactly what commands are sent to Roblox Studio.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| UI says `Server not running` | Ensure you started the app via `cargo run` and haven't closed the terminal |
| `API key not set` error in UI | Click the Settings icon and enter your key, or set `GEMINI_API_KEY` |
| Tool call hands with "running..." | Ensure Roblox Studio is open and the MCP plugin is active |
| `Port busy, using proxy mode` | Another agent instance is already running — close it first |
| Plugin not visible in Studio | Run `cargo run --release -- --install` again and restart Studio |
| No `The MCP Studio plugin is ready for prompts.` in console | Click the MCP button in the Plugins tab to enable the connection |

## Project Structure

```
├── src/
│   ├── main.rs                 # Rust entry point (HTTP server + Electron auto-launch)
│   ├── rbx_studio_server.rs    # Gemini REST client, SSE streaming, HTTP handlers
│   ├── install.rs              # Plugin installation script
│   └── error.rs                # Error types
├── electron/
│   ├── main.js                 # Electron main process (BrowserWindow config)
│   ├── renderer.js             # SSE parsing, markdown rendering, UI logic
│   ├── index.html              # ChatGPT-style DOM structure
│   ├── styles.css              # Dark/Light themes and CSS variables
│   └── package.json            # Node.js dependencies (electron, marked, highlight.js)
├── plugin/                     # Roblox Studio Luau Plugin Source
├── Cargo.toml
└── build.rs                    # Bundles the plugin at compile time
```
