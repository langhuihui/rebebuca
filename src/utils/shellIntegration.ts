/**
 * Rebebuca Shell Integration
 * 
 * Parses OSC 633 sequences to enable command detection, decorations,
 * and navigation features similar to VSCode's terminal shell integration.
 * 
 * OSC 633 Sequences:
 * - A: Prompt start
 * - B: Prompt end
 * - C: Pre-execution (command about to run)
 * - D: Execution finished with exit code
 * - E: Command line content
 * - P: Property (Cwd, etc.)
 */

import type { Terminal, IMarker, IDecoration } from '@xterm/xterm';

export interface CommandInfo {
  /** Line number where the command started (prompt line) */
  promptLine: number;
  /** Line number where command output started */
  outputStartLine: number;
  /** Line number where command output ended */
  outputEndLine?: number;
  /** The command that was executed */
  command?: string;
  /** Exit code of the command */
  exitCode?: number;
  /** Current working directory when command was executed */
  cwd?: string;
  /** Marker for the command line */
  marker?: IMarker;
  /** Decoration for the command status */
  decoration?: IDecoration;
}

export interface ShellIntegrationState {
  /** Whether shell integration is active */
  isActive: boolean;
  /** Current working directory */
  cwd?: string;
  /** List of detected commands */
  commands: CommandInfo[];
  /** Index of current command (for navigation) */
  currentCommandIndex: number;
  /** Current state in the command lifecycle */
  state: 'idle' | 'prompt' | 'command' | 'output';
}

export class ShellIntegration {
  private terminal: Terminal;
  private state: ShellIntegrationState;
  private pendingCommand: Partial<CommandInfo> | null = null;
  private oscBuffer: string = '';
  private inOscSequence: boolean = false;
  
  // Callbacks
  private onCommandStart?: (command: CommandInfo) => void;
  private onCommandEnd?: (command: CommandInfo) => void;
  private onCwdChange?: (cwd: string) => void;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
    this.state = {
      isActive: false,
      commands: [],
      currentCommandIndex: -1,
      state: 'idle',
    };
  }

  /**
   * Process data from the terminal, parsing OSC 633 sequences
   */
  processData(data: string): string {
    let output = '';
    let i = 0;

    while (i < data.length) {
      const char = data[i];

      if (this.inOscSequence) {
        // Check for sequence terminator
        if (char === '\x07') {
          // Bell terminator
          this.handleOscSequence(this.oscBuffer);
          this.oscBuffer = '';
          this.inOscSequence = false;
        } else if (char === '\x1b' && data[i + 1] === '\\') {
          // ST terminator (ESC \)
          this.handleOscSequence(this.oscBuffer);
          this.oscBuffer = '';
          this.inOscSequence = false;
          i++; // Skip the backslash
        } else {
          this.oscBuffer += char;
        }
      } else if (char === '\x1b' && data[i + 1] === ']') {
        // Start of OSC sequence
        this.inOscSequence = true;
        this.oscBuffer = '';
        i++; // Skip the ]
      } else {
        // Regular character, pass through
        output += char;
      }

      i++;
    }

    return output;
  }

  /**
   * Handle a complete OSC sequence
   */
  private handleOscSequence(sequence: string): void {
    // Check if it's our 633 sequence
    if (!sequence.startsWith('633;')) {
      return;
    }

    this.state.isActive = true;
    const parts = sequence.substring(4).split(';');
    const type = parts[0];

    switch (type) {
      case 'A':
        // Prompt start
        this.handlePromptStart();
        break;
      case 'B':
        // Prompt end
        this.handlePromptEnd();
        break;
      case 'C':
        // Pre-execution
        this.handlePreExecution();
        break;
      case 'D':
        // Execution finished
        const exitCode = parts[1] ? parseInt(parts[1], 10) : undefined;
        this.handleExecutionFinished(exitCode);
        break;
      case 'E':
        // Command line
        const command = this.unescapeValue(parts.slice(1).join(';'));
        this.handleCommandLine(command);
        break;
      case 'P':
        // Property
        this.handleProperty(parts.slice(1).join(';'));
        break;
    }
  }

  /**
   * Unescape values from OSC sequences
   */
  private unescapeValue(value: string): string {
    return value
      .replace(/\\x0a/g, '\n')
      .replace(/\\x3b/g, ';')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Handle prompt start (OSC 633 ; A)
   */
  private handlePromptStart(): void {
    this.state.state = 'prompt';
    this.pendingCommand = {
      promptLine: this.terminal.buffer.active.cursorY + this.terminal.buffer.active.baseY,
    };
  }

  /**
   * Handle prompt end (OSC 633 ; B)
   */
  private handlePromptEnd(): void {
    if (this.pendingCommand) {
      this.state.state = 'command';
    }
  }

  /**
   * Handle pre-execution (OSC 633 ; C)
   */
  private handlePreExecution(): void {
    if (this.pendingCommand) {
      this.pendingCommand.outputStartLine = 
        this.terminal.buffer.active.cursorY + this.terminal.buffer.active.baseY + 1;
      this.state.state = 'output';
      
      // Create marker for the command
      const marker = this.terminal.registerMarker(
        this.pendingCommand.promptLine! - this.terminal.buffer.active.baseY - this.terminal.buffer.active.cursorY
      );
      if (marker) {
        this.pendingCommand.marker = marker;
      }
    }
  }

  /**
   * Handle execution finished (OSC 633 ; D)
   */
  private handleExecutionFinished(exitCode?: number): void {
    if (this.pendingCommand && this.pendingCommand.outputStartLine !== undefined) {
      this.pendingCommand.exitCode = exitCode;
      this.pendingCommand.outputEndLine = 
        this.terminal.buffer.active.cursorY + this.terminal.buffer.active.baseY;
      this.pendingCommand.cwd = this.state.cwd;

      // Create decoration for command status
      if (this.pendingCommand.marker) {
        this.addCommandDecoration(this.pendingCommand as CommandInfo);
      }

      // Add to command history
      this.state.commands.push(this.pendingCommand as CommandInfo);
      this.state.currentCommandIndex = this.state.commands.length - 1;

      // Notify callback
      if (this.onCommandEnd) {
        this.onCommandEnd(this.pendingCommand as CommandInfo);
      }

      this.pendingCommand = null;
      this.state.state = 'idle';
    }
  }

  /**
   * Handle command line content (OSC 633 ; E)
   */
  private handleCommandLine(command: string): void {
    if (this.pendingCommand) {
      this.pendingCommand.command = command;
      
      // Notify callback
      if (this.onCommandStart) {
        this.onCommandStart(this.pendingCommand as CommandInfo);
      }
    }
  }

  /**
   * Handle property (OSC 633 ; P)
   */
  private handleProperty(property: string): void {
    const [key, ...valueParts] = property.split('=');
    const value = this.unescapeValue(valueParts.join('='));

    switch (key) {
      case 'Cwd':
        this.state.cwd = value;
        if (this.onCwdChange) {
          this.onCwdChange(value);
        }
        break;
    }
  }

  /**
   * Add visual decoration for command status
   */
  private addCommandDecoration(command: CommandInfo): void {
    if (!command.marker) return;

    const isSuccess = command.exitCode === 0;
    
    try {
      const decoration = this.terminal.registerDecoration({
        marker: command.marker,
        anchor: 'left',
        width: 1,
      });

      if (decoration) {
        decoration.onRender((element) => {
          element.style.width = '8px';
          element.style.height = '100%';
          element.style.marginLeft = '-12px';
          element.innerHTML = isSuccess 
            ? '<span style="color: #50fa7b; font-size: 10px;">●</span>'
            : '<span style="color: #ff5555; font-size: 10px;">●</span>';
          element.title = isSuccess 
            ? `Exit code: ${command.exitCode}` 
            : `Exit code: ${command.exitCode ?? 'unknown'}`;
        });

        command.decoration = decoration;
      }
    } catch (e) {
      // Decoration API might not be available
      console.debug('Could not add command decoration:', e);
    }
  }

  /**
   * Navigate to previous command
   */
  navigateToPreviousCommand(): boolean {
    if (this.state.commands.length === 0) return false;
    
    if (this.state.currentCommandIndex > 0) {
      this.state.currentCommandIndex--;
    }
    
    const command = this.state.commands[this.state.currentCommandIndex];
    if (command?.marker) {
      this.scrollToMarker(command.marker);
      return true;
    }
    return false;
  }

  /**
   * Navigate to next command
   */
  navigateToNextCommand(): boolean {
    if (this.state.commands.length === 0) return false;
    
    if (this.state.currentCommandIndex < this.state.commands.length - 1) {
      this.state.currentCommandIndex++;
    }
    
    const command = this.state.commands[this.state.currentCommandIndex];
    if (command?.marker) {
      this.scrollToMarker(command.marker);
      return true;
    }
    return false;
  }

  /**
   * Scroll terminal to a marker
   */
  private scrollToMarker(marker: IMarker): void {
    const line = marker.line;
    this.terminal.scrollToLine(line);
  }

  /**
   * Get current state
   */
  getState(): ShellIntegrationState {
    return { ...this.state };
  }

  /**
   * Check if shell integration is active
   */
  isActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Get command history
   */
  getCommands(): CommandInfo[] {
    return [...this.state.commands];
  }

  /**
   * Get current working directory
   */
  getCwd(): string | undefined {
    return this.state.cwd;
  }

  /**
   * Set callback for command start
   */
  setOnCommandStart(callback: (command: CommandInfo) => void): void {
    this.onCommandStart = callback;
  }

  /**
   * Set callback for command end
   */
  setOnCommandEnd(callback: (command: CommandInfo) => void): void {
    this.onCommandEnd = callback;
  }

  /**
   * Set callback for cwd change
   */
  setOnCwdChange(callback: (cwd: string) => void): void {
    this.onCwdChange = callback;
  }

  /**
   * Dispose and clean up
   */
  dispose(): void {
    // Clean up decorations
    for (const command of this.state.commands) {
      command.decoration?.dispose();
      command.marker?.dispose();
    }
    this.state.commands = [];
    this.state.currentCommandIndex = -1;
  }
}
