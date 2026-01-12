#!/bin/bash

# Build remote agent for multiple architectures
# Requirements:
# - musl-cross for cross-compilation
#   macOS: brew install filosottile/musl-cross/musl-cross
#   Also need: brew install filosottile/musl-cross/musl-cross --with-x86_64 --with-aarch64

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OUTPUT_DIR="../src-tauri"

echo "Building remote agent for multiple architectures..."

# Check if cross-compilation tools are available
check_toolchain() {
    local target=$1
    local linker=$2
    
    if ! command -v $linker &> /dev/null; then
        echo "Warning: $linker not found. Skipping $target build."
        echo "Install with: brew install filosottile/musl-cross/musl-cross"
        return 1
    fi
    
    if ! rustup target list --installed | grep -q "$target"; then
        echo "Adding Rust target: $target"
        rustup target add "$target"
    fi
    
    return 0
}

# Build for x86_64-unknown-linux-musl
if check_toolchain "x86_64-unknown-linux-musl" "x86_64-unknown-linux-musl-gcc"; then
    echo "Building for x86_64-unknown-linux-musl..."
    cargo build --release --target x86_64-unknown-linux-musl
    cp target/x86_64-unknown-linux-musl/release/rebebuca-remote-agent "$OUTPUT_DIR/rebebuca-remote-agent-x86_64"
    echo "Built: $OUTPUT_DIR/rebebuca-remote-agent-x86_64"
fi

# Build for aarch64-unknown-linux-musl
if check_toolchain "aarch64-unknown-linux-musl" "aarch64-unknown-linux-musl-gcc"; then
    echo "Building for aarch64-unknown-linux-musl..."
    cargo build --release --target aarch64-unknown-linux-musl
    cp target/aarch64-unknown-linux-musl/release/rebebuca-remote-agent "$OUTPUT_DIR/rebebuca-remote-agent-aarch64"
    echo "Built: $OUTPUT_DIR/rebebuca-remote-agent-aarch64"
fi

# Also copy one as default (for backward compatibility)
if [ -f "$OUTPUT_DIR/rebebuca-remote-agent-x86_64" ]; then
    cp "$OUTPUT_DIR/rebebuca-remote-agent-x86_64" "$OUTPUT_DIR/rebebuca-remote-agent"
    echo "Default agent set to x86_64"
elif [ -f "$OUTPUT_DIR/rebebuca-remote-agent-aarch64" ]; then
    cp "$OUTPUT_DIR/rebebuca-remote-agent-aarch64" "$OUTPUT_DIR/rebebuca-remote-agent"
    echo "Default agent set to aarch64"
fi

echo ""
echo "Build complete! Agent binaries:"
ls -la "$OUTPUT_DIR"/rebebuca-remote-agent* 2>/dev/null || echo "No agent binaries found"
