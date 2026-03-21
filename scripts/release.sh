#!/bin/bash

# Rebebuca Release Script (npm-only)
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.5.6
# Pushing tag v* triggers GitHub Actions to build and publish to npm.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Error: Version number is required${NC}"
    echo "Usage: $0 <version>"
    echo "Example: $0 0.5.6"
    exit 1
fi

VERSION=$1

if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid version format. Use x.y.z (e.g., 0.5.6)${NC}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "${YELLOW}Releasing version ${VERSION}...${NC}"

if ! git diff --quiet || ! git diff --staged --quiet; then
    echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag v${VERSION} already exists${NC}"
    exit 1
fi

echo -e "${GREEN}[1/3]${NC} Updating version in package.json..."
npm version "$VERSION" --no-git-tag-version --allow-same-version

echo -e "${GREEN}[2/3]${NC} Committing changes..."
git add package.json package-lock.json 2>/dev/null || true
git commit -m "chore: bump version to ${VERSION}"

echo -e "${GREEN}[3/3]${NC} Creating and pushing tag..."
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin main
git push origin "v$VERSION"

echo ""
echo -e "${GREEN}✓ Successfully released version ${VERSION}${NC}"
echo "GitHub Actions will build and publish to npm on tag v${VERSION}."
