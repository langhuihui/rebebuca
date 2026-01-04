#!/bin/bash

# Rebebuca Release Script
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.1.5

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version number is required${NC}"
    echo "Usage: $0 <version>"
    echo "Example: $0 0.1.5"
    exit 1
fi

VERSION=$1

# Validate version format (x.y.z)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format. Use x.y.z (e.g., 0.1.5)${NC}"
    exit 1
fi

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${YELLOW}Releasing version ${VERSION}...${NC}"

# Check for uncommitted changes
if ! git diff --quiet || ! git diff --staged --quiet; then
    echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

# Check if tag already exists
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag v${VERSION} already exists${NC}"
    exit 1
fi

echo -e "${GREEN}[1/5]${NC} Updating version in package.json..."
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

echo -e "${GREEN}[2/5]${NC} Updating version in src-tauri/tauri.conf.json..."
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

echo -e "${GREEN}[3/5]${NC} Updating version in src-tauri/Cargo.toml..."
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

echo -e "${GREEN}[4/5]${NC} Committing changes..."
# Update Cargo.lock by running cargo check
cd src-tauri && cargo check --quiet 2>/dev/null || true && cd ..
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: bump version to ${VERSION}"

echo -e "${GREEN}[5/5]${NC} Creating and pushing tag..."
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin main
git push origin "v$VERSION"

echo ""
echo -e "${GREEN}✓ Successfully released version ${VERSION}${NC}"
echo ""
echo "GitHub Actions will now build and create the release."
echo "Check progress at: https://github.com/langhuihui/rebebuca/actions"
