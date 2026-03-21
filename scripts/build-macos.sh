#!/bin/bash

# Build remote-agent for macOS (universal binary).
# Usage: ./scripts/build-macos.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Rebebuca remote-agent (macOS)${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${GREEN}[1/3] Building remote-agent x86_64...${NC}"
cd remote-agent
cargo build --release --target x86_64-apple-darwin --bin rebebuca-remote-agent
echo -e "${GREEN}✓ x86_64 done${NC}"
echo ""

echo -e "${GREEN}[2/3] Building remote-agent aarch64...${NC}"
cargo build --release --target aarch64-apple-darwin --bin rebebuca-remote-agent
echo -e "${GREEN}✓ aarch64 done${NC}"
echo ""

echo -e "${GREEN}[3/3] Creating universal binary...${NC}"
mkdir -p target/universal-apple-darwin/release
lipo -create \
  target/x86_64-apple-darwin/release/rebebuca-remote-agent \
  target/aarch64-apple-darwin/release/rebebuca-remote-agent \
  -output target/universal-apple-darwin/release/rebebuca-remote-agent
echo -e "${GREEN}✓ Universal binary created${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Output: remote-agent/target/universal-apple-darwin/release/rebebuca-remote-agent"
echo ""
