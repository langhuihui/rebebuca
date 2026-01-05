#!/bin/bash
# Rebebuca Shell Integration for Bash
# This script enables shell integration features like command detection,
# working directory tracking, and command status reporting.

# Only run if not already loaded
if [[ -n "$REBEBUCA_SHELL_INTEGRATION" ]]; then
    return 0
fi
export REBEBUCA_SHELL_INTEGRATION=1

# OSC 633 sequence helpers
# A - Mark prompt start
# B - Mark prompt end  
# C - Mark pre-execution (command about to run)
# D - Mark execution finished with exit code
# E - Set command line
# P - Set property (Cwd, etc.)

__rebebuca_escape_value() {
    # Escape special characters for OSC sequences
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//$'\n'/\\x0a}"
    value="${value//;/\\x3b}"
    printf '%s' "$value"
}

__rebebuca_prompt_start() {
    printf '\e]633;A\e\\'
}

__rebebuca_prompt_end() {
    printf '\e]633;B\e\\'
}

__rebebuca_preexec() {
    # Mark command execution start
    printf '\e]633;C\e\\'
    # Send the command line
    local cmd="$(__rebebuca_escape_value "$1")"
    printf '\e]633;E;%s\e\\' "$cmd"
}

__rebebuca_precmd() {
    local exit_code=$?
    # Mark command execution finished with exit code
    printf '\e]633;D;%d\e\\' "$exit_code"
    # Update current working directory
    printf '\e]633;P;Cwd=%s\e\\' "$(__rebebuca_escape_value "$PWD")"
}

# Install prompt hooks
if [[ -n "$BASH_VERSION" ]]; then
    # Store original PS1
    __rebebuca_original_ps1="$PS1"
    
    # Wrap PS1 with prompt markers
    __rebebuca_update_ps1() {
        PS1='\['"$(__rebebuca_prompt_start)"'\]'"$__rebebuca_original_ps1"'\['"$(__rebebuca_prompt_end)"'\]'
    }
    
    # Use PROMPT_COMMAND for precmd
    __rebebuca_prompt_command() {
        __rebebuca_precmd
        __rebebuca_update_ps1
    }
    
    # Append to PROMPT_COMMAND
    if [[ -z "$PROMPT_COMMAND" ]]; then
        PROMPT_COMMAND="__rebebuca_prompt_command"
    elif [[ "$PROMPT_COMMAND" != *"__rebebuca_prompt_command"* ]]; then
        PROMPT_COMMAND="__rebebuca_prompt_command${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
    fi
    
    # Use DEBUG trap for preexec
    __rebebuca_debug_trap() {
        # Only trigger for actual commands, not prompt
        if [[ -n "$BASH_COMMAND" && "$BASH_COMMAND" != "__rebebuca_prompt_command" && "$BASH_COMMAND" != "__rebebuca_precmd" ]]; then
            # Avoid triggering multiple times
            if [[ "$__rebebuca_last_cmd" != "$BASH_COMMAND" ]]; then
                __rebebuca_last_cmd="$BASH_COMMAND"
                __rebebuca_preexec "$BASH_COMMAND"
            fi
        fi
    }
    
    # Set up DEBUG trap
    trap '__rebebuca_debug_trap' DEBUG
    
    # Initial CWD report
    printf '\e]633;P;Cwd=%s\e\\' "$(__rebebuca_escape_value "$PWD")"
fi
