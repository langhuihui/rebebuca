#!/bin/bash

# Rebebuca macOS Build Script
# This script builds the macOS universal version and prepares artifacts for R2 upload

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Read current version
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Rebebuca macOS Build${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo ""

# Check if we have signing keys
if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ] || [ -z "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]; then
    echo -e "${YELLOW}Warning: No signing keys found. Build will be unsigned.${NC}"
    echo -e "Set TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD environment variables for signed builds."
    echo ""
fi

# Step 1: Build remote-agent for both architectures
echo -e "${GREEN}[1/5] Building remote-agent for x86_64...${NC}"
cd remote-agent
cargo build --release --target x86_64-apple-darwin --bin rebebuca-remote-agent
echo -e "${GREEN}✓ x86_64 build complete${NC}"
echo ""

echo -e "${GREEN}[2/5] Building remote-agent for aarch64...${NC}"
cargo build --release --target aarch64-apple-darwin --bin rebebuca-remote-agent
echo -e "${GREEN}✓ aarch64 build complete${NC}"
echo ""

# Step 3: Create universal binary
echo -e "${GREEN}[3/5] Creating universal remote-agent binary...${NC}"
mkdir -p target/universal-apple-darwin/release
lipo -create \
    target/x86_64-apple-darwin/release/rebebuca-remote-agent \
    target/aarch64-apple-darwin/release/rebebuca-remote-agent \
    -output target/universal-apple-darwin/release/rebebuca-remote-agent
echo -e "${GREEN}✓ Universal binary created${NC}"
echo ""

# Step 4: Copy to src-tauri/build
echo -e "${GREEN}[4/5] Copying binaries to src-tauri/build...${NC}"
mkdir -p ../src-tauri/build
cp target/x86_64-apple-darwin/release/rebebuca-remote-agent ../src-tauri/build/rebebuca-remote-agent-x86_64-apple-darwin
cp target/aarch64-apple-darwin/release/rebebuca-remote-agent ../src-tauri/build/rebebuca-remote-agent-aarch64-apple-darwin
echo -e "${GREEN}✓ Binaries copied${NC}"
echo ""

# Step 5: Build Tauri app
echo -e "${GREEN}[5/5] Building Tauri app (universal)...${NC}"
cd "$PROJECT_ROOT"
pnpm install
pnpm tauri build --target universal-apple-darwin
echo -e "${GREEN}✓ Tauri build complete${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Artifacts location:"
echo -e "  ${YELLOW}src-tauri/target/universal-apple-darwin/release/bundle/${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the build artifacts"
echo "  2. Upload to R2: /Users/dexter/Library/CloudStorage/S3-S3/monibuca/rb/v${VERSION}/"
echo ""
