# Terminal Selection Architecture

> **Scope:** Describes “open this task in an external system terminal” preferences. The main in-app terminal is **node-pty** on the machine running **node-server** (WebSocket `terminal.*`). This document is not about SSH remote tasks (`node-server/handlers/ssh.js`).

## System Architecture

The terminal selection feature consists of several layers:

### 1. Frontend Layer (Vue/TypeScript)
- **Settings Dialog**: UI for terminal selection
- **Settings Store**: Persists user preference (via backend **storage** adapter)
- **Task Manager**: Uses preference when opening terminals
- **Adapter Layer**: Abstracts platform differences (`server` / `mock`)

### 2. Backend Layer (Node server over WebSocket)
- **Terminal detection**: `system.getAvailableTerminals` → `node-server/handlers/system.js` (scans the **host where node-server runs**)
- **Launch external terminal**: `system.openInSpecificTerminal` / `openInSystemTerminal` — implemented on that host; from a **browser-only** client, the server adapter may no-op or only work when the browser user is on the same machine as the server

### 3. Operating System Layer
- Actual terminal applications (Terminal.app, PowerShell, etc.)
- Process management and execution

## Key Components

### Backend Components

#### get_available_terminals (WebSocket `system.getAvailableTerminals`)
Detects installed terminals on the system:
- **macOS**: Checks /Applications and /System for common terminals
- **Windows**: Checks Program Files and PATH for terminals
- **Linux**: Uses 'which' to find terminals in PATH

Returns a list of terminal records with:
- id, name, path, available status, default flag

#### open_in_specific_terminal (WebSocket `system.openInSpecificTerminal`)
Launches a command in a specific terminal:
- Takes terminal ID, command, and optional working directory
- Uses platform-specific methods to launch
- Properly escapes commands and paths

### Frontend Components

#### Settings Store
- Stores preferredTerminal setting
- Persists via the active backend **storage** adapter (e.g. server `~/.rebebuca/store.json`)
- Accessed by task execution logic

#### Settings Dialog
- Loads available terminals on mount
- Displays dropdown with terminal options
- Auto-saves selection changes

#### Task Manager
- Checks for preferred terminal setting
- Uses specific terminal if set
- Falls back to system default otherwise

## Data Flow

### Terminal Discovery
1. User opens Settings
2. Settings Dialog calls getAvailableTerminals()
3. Backend scans for installed terminals
4. List displayed in dropdown

### Terminal Selection
1. User selects terminal from dropdown
2. Settings Store updates preferredTerminal
3. Change persisted to disk

### Command Execution
1. User runs task in system terminal
2. Task Manager checks preferred terminal setting
3. If set, uses openInSpecificTerminal()
4. Otherwise uses openInSystemTerminal()
5. Terminal launches with command

## Platform Specifics

### macOS
- Uses AppleScript for Terminal.app and iTerm2
- Uses 'open' command for other terminals
- Detects: Terminal, iTerm2, Warp, Alacritty, Kitty

### Windows
- Direct execution for cmd and PowerShell
- Uses wt.exe for Windows Terminal
- Detects: Command Prompt, PowerShell, PowerShell 7+, Windows Terminal, Git Bash

### Linux
- Uses 'which' to check availability
- Terminal-specific arguments for each
- Detects: GNOME Terminal, Konsole, Xfce Terminal, and many more

## Security

- All commands properly escaped
- Working directories validated
- No direct shell interpolation
- Terminals run as separate processes
