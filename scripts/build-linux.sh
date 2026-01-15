#!/bin/bash

# Rebebuca Linux Build Script
# This script builds remote-agent-server for Linux and prepares artifacts for R2 upload

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
echo -e "${GREEN}Rebebuca Linux Build (Remote Agent Server Only)${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Version: ${YELLOW}${VERSION}${NC}"
echo ""

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64|amd64)
        TARGET="x86_64-unknown-linux-gnu"
        ARCH_NAME="x86_64"
        ;;
    aarch64|arm64)
        TARGET="aarch64-unknown-linux-gnu"
        ARCH_NAME="aarch64"
        ;;
    *)
        echo -e "${RED}Unsupported architecture: $ARCH${NC}"
        exit 1
        ;;
esac

echo -e "${YELLOW}Detected architecture: $ARCH_NAME ($TARGET)${NC}"
echo ""

# Step 1: Build remote-agent-server
echo -e "${GREEN}[1/2] Building remote-agent-server for Linux ($ARCH_NAME)...${NC}"
cd remote-agent-server
cargo build --release --target $TARGET --bin rebebuca-remote-server
echo -e "${GREEN}✓ Remote-agent-server build complete${NC}"
echo ""

# Step 2: Package with web assets
echo -e "${GREEN}[2/2] Packaging remote-agent-server with web assets...${NC}"
cd "$PROJECT_ROOT"
pnpm install
pnpm build:server
mkdir -p package/rebebuca-remote-server
cp remote-agent-server/target/$TARGET/release/rebebuca-remote-server package/rebebuca-remote-server/
cp -r dist package/rebebuca-remote-server/
cd package
tar -czvf rebebuca-remote-server-linux-${ARCH_NAME}.tar.gz rebebuca-remote-server
echo -e "${GREEN}✓ Package created${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Build Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Artifacts location:"
echo -e "  ${YELLOW}package/rebebuca-remote-server-linux-${ARCH_NAME}.tar.gz${NC}"
echo ""
echo "Binary location:"
echo -e "  ${YELLOW}remote-agent-server/target/$TARGET/release/rebebuca-remote-server${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the package"
echo "  2. Upload to R2: /Users/dexter/Library/CloudStorage/S3-S3/monibuca/rb/v${VERSION}/remote-agent-server/"
echo "  3. Update releases.json and latest.json manually using local-release skill"
echo ""

