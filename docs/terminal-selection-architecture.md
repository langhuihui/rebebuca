# Terminal Selection Architecture

## System Architecture

The terminal selection feature consists of several layers:

### 1. Frontend Layer (Vue/TypeScript)
- **Settings Dialog**: UI for terminal selection
- **Settings Store**: Persists user preference
- **Task Manager**: Uses preference when opening terminals
- **Adapter Layer**: Abstracts platform differences

### 2. Backend Layer (Rust/Tauri)
- **Terminal Detection**: Scans system for installed terminals
- **Terminal Launcher**: Opens commands in selected terminal
- **Platform Handlers**: macOS, Windows, Linux specific logic

### 3. Operating System Layer
- Actual terminal applications (Terminal.app, PowerShell, etc.)
- Process management and execution

## Key Components

### Backend Components

#### get_available_terminals() Command
Detects installed terminals on the system:
- **macOS**: Checks /Applications and /System for common terminals
- **Windows**: Checks Program Files and PATH for terminals
- **Linux**: Uses 'which' to find terminals in PATH

Returns a list of TerminalInfo structs with:
- id, name, path, available status, default flag

#### open_in_specific_terminal() Command
Launches a command in a specific terminal:
- Takes terminal ID, command, and optional working directory
- Uses platform-specific methods to launch
- Properly escapes commands and paths

### Frontend Components

#### Settings Store
- Stores preferredTerminal setting
- Persists to disk using tauri-plugin-store
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
