#!/bin/zsh
# Rebebuca Shell Integration for Zsh
# This script enables shell integration features like command detection,
# working directory tracking, and command status reporting.

# Only run if not already loaded
if [[ -n "$REBEBUCA_SHELL_INTEGRATION" ]]; then
    return 0
fi
export REBEBUCA_SHELL_INTEGRATION=1

# OSC 633 sequence helpers
__rebebuca_escape_value() {
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
    # Send the command line (zsh passes it as $1)
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

# Add to precmd hooks
autoload -Uz add-zsh-hook
add-zsh-hook precmd __rebebuca_precmd
add-zsh-hook preexec __rebebuca_preexec

# Wrap prompt with markers
# Save original prompts
__rebebuca_original_ps1="$PS1"
__rebebuca_original_rps1="$RPS1"

# Function to update prompts with markers
__rebebuca_update_prompt() {
    PS1="%{$(__rebebuca_prompt_start)%}${__rebebuca_original_ps1}%{$(__rebebuca_prompt_end)%}"
}

# Add prompt update to precmd
add-zsh-hook precmd __rebebuca_update_prompt

# Initial CWD report
printf '\e]633;P;Cwd=%s\e\\' "$(__rebebuca_escape_value "$PWD")"
