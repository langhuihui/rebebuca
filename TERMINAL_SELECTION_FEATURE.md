# Terminal Selection Feature

## Overview

This feature allows users to select which system terminal to use when opening commands externally. Similar to how VSCode allows users to choose their preferred terminal, Rebebuca now automatically detects available system terminals and lets users configure their preference.

## Problem Addressed

The user requested the ability to:
1. Discover what system terminals are available on the system
2. Select which terminal to use when running commands
3. Manage terminal processes through subprocess for better process control
4. Similar functionality to VSCode's terminal selection feature

## Implementation

### Backend Changes

#### 1. New Rust Commands (`src-tauri/src/commands.rs`)

**`get_available_terminals()`**
- Detects available system terminals on each platform
- Returns a list of `TerminalInfo` structs with:
  - `id`: Unique identifier for the terminal
  - `name`: Display name
  - `path`: Path to the terminal executable
  - `available`: Whether the terminal is currently installed
  - `is_default`: Whether this is the default terminal

**Supported Terminals:**
- **macOS**: Terminal.app, iTerm2, Warp, Alacritty, Kitty
- **Windows**: Command Prompt, PowerShell, PowerShell 7+, Windows Terminal, Git Bash
- **Linux**: GNOME Terminal, Konsole, Xfce Terminal, MATE Terminal, LXTerminal, XTerm, Alacritty, Kitty, Tilix, Terminator

**`open_in_specific_terminal(terminal_id, command, cwd)`**
- Opens a command in a specific terminal by ID
- Uses platform-specific methods to launch the terminal with the command
- Supports working directory specification

#### 2. Updated Type Definitions

Added `TerminalInfo` struct in Rust backend:
```rust
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub available: bool,
    pub is_default: bool,
}
```

### Frontend Changes

#### 1. Type Definitions (`src/adapters/types.ts`)

Added `SystemTerminalInfo` interface:
```typescript
export interface SystemTerminalInfo {
  id: string;
  name: string;
  path: string;
  available: boolean;
  is_default: boolean;
}
```

Updated `SystemAdapter` interface with new methods:
```typescript
interface SystemAdapter {
  // ... existing methods
  openInSpecificTerminal(terminalId: string, command: string, cwd?: string): Promise<void>;
  getAvailableTerminals(): Promise<SystemTerminalInfo[]>;
}
```

#### 2. Adapter Implementations

**Tauri Adapter** (`src/adapters/tauri.ts`):
- Implemented `getAvailableTerminals()` to call Rust backend
- Implemented `openInSpecificTerminal()` to open commands in selected terminal

**Mock Adapter** (`src/adapters/mock.ts`):
- Added mock implementations for demo/testing purposes
- Returns platform-appropriate mock terminal lists

#### 3. Settings Store (`src/stores/settings.ts`)

Added `preferredTerminal` field to `AppSettings`:
```typescript
export interface AppSettings {
  // ... existing settings
  preferredTerminal: string | null;  // Terminal ID to use
}
```

#### 4. Settings Dialog (`src/components/settings/SettingsDialog.vue`)

Added terminal selection UI:
- Loads available terminals on mount
- Displays dropdown with available terminals
- Shows default terminal with "(默认)" indicator
- Automatically saves selection to settings

#### 5. Task Manager (`src/stores/taskManager.ts`)

Updated `openInSystemTerminal()` method:
- Checks for preferred terminal in settings
- Uses `openInSpecificTerminal()` if preference is set
- Falls back to `openInSystemTerminal()` for default behavior

#### 6. Internationalization

Added translations in both English and Chinese:
- `settings.preferredTerminal`: Label for the setting
- `settings.preferredTerminalPlaceholder`: Placeholder text
- `settings.preferredTerminalHint`: Help text explaining the feature

### Documentation

Updated the following documentation files:
- `QUICKSTART.md`: Added section on terminal selection
- `README.md`: Added terminal selection to feature list
- `README_CN.md`: Added terminal selection to feature list (Chinese)

## Usage

### For Users

1. Open Settings (click the settings icon)
2. Go to the "General" tab
3. Find "Preferred Terminal" setting
4. Select your preferred terminal from the dropdown
5. The selection is automatically saved
6. When you run a task in the system terminal, it will use your selected terminal

### For Developers

To add support for a new terminal:

1. **Backend** (`src-tauri/src/commands.rs`):
   - Add detection logic in `get_available_terminals()`
   - Add launch logic in `open_in_specific_terminal()`

2. **Frontend**: No changes needed - the UI automatically displays all detected terminals

## Technical Details

### Platform-Specific Implementation

#### macOS
- Uses AppleScript for Terminal.app and iTerm2
- Uses `open` command for other terminals
- Handles proper escaping of commands and working directories

#### Windows
- Uses direct command execution for Command Prompt and PowerShell
- Uses `wt.exe` for Windows Terminal
- Handles path conversion for Git Bash

#### Linux
- Checks for terminal availability using `which` command
- Uses terminal-specific arguments for working directory
- Supports various terminal emulators with different command-line interfaces

### Process Management

The feature maintains process management capabilities by:
1. Still launching terminals as subprocesses
2. Terminals themselves manage the command execution
3. Terminal windows can be closed by users or system
4. No change to existing PTY-based terminal for in-app execution

## Benefits

1. **User Choice**: Users can select their preferred terminal emulator
2. **Platform Awareness**: Automatically detects installed terminals
3. **Flexibility**: Falls back to system default if no preference set
4. **Consistency**: Similar UX to popular development tools like VSCode
5. **Easy Configuration**: Simple dropdown in settings dialog

## Future Enhancements

Possible improvements for future versions:
1. Add support for custom terminal configurations
2. Allow per-task terminal selection (override global preference)
3. Add terminal-specific options (e.g., profile selection for Windows Terminal)
4. Support for terminal themes/appearance settings
5. Add ability to refresh terminal list without restarting

## Testing

To test this feature:

1. **Verify Detection**:
   - Open Settings → General
   - Check that installed terminals appear in the dropdown
   - Verify default terminal is marked

2. **Test Selection**:
   - Select a different terminal
   - Run a task with "Open in System Terminal"
   - Verify it opens in the selected terminal

3. **Test Fallback**:
   - Clear the preference (select "Use system default")
   - Run a task
   - Verify it uses the system default terminal

4. **Test Persistence**:
   - Select a terminal
   - Restart the application
   - Verify the selection is remembered

## Notes

- Terminal detection is performed once when the settings dialog opens
- Selection is persisted in the application's storage
- The feature does not affect in-app terminal execution (PTY-based)
- Only applies to "Open in System Terminal" functionality
