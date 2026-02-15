#!/bin/bash

# Rebebuca Republish Script
# Republish the current version by deleting and recreating the tag
# Usage: ./scripts/republish.sh [version] [commit message]
# Examples:
#   ./scripts/republish.sh
#   ./scripts/republish.sh "fix: some bug fix"
#   ./scripts/republish.sh 1.2.3
#   ./scripts/republish.sh 1.2.3 "fix: some bug fix"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse args: first arg may be version (x.y.z) or commit message
if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
    VERSION="$1"
    COMMIT_MSG="${2:-chore: republish v$VERSION}"
else
    VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
    COMMIT_MSG="${1:-chore: republish v$VERSION}"
fi

if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Could not read version from package.json${NC}"
    exit 1
fi

TAG="v$VERSION"

echo -e "${YELLOW}Republishing version ${VERSION}...${NC}"

# Check if tag exists locally
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag ${TAG} does not exist locally${NC}"
    exit 1
fi

echo -e "${GREEN}[1/6]${NC} Deleting local tag ${TAG}..."
git tag -d "$TAG"

echo -e "${GREEN}[2/6]${NC} Deleting remote tag ${TAG}..."
git push origin --delete "$TAG" 2>/dev/null || echo -e "${YELLOW}Remote tag not found, skipping...${NC}"

echo -e "${GREEN}[3/6]${NC} Staging and committing changes..."
if git diff --quiet && git diff --staged --quiet; then
    echo -e "${YELLOW}No changes to commit, skipping commit...${NC}"
else
    git add -A
    git commit -m "$COMMIT_MSG"
fi

echo -e "${GREEN}[4/6]${NC} Creating new tag ${TAG}..."
git tag -a "$TAG" -m "Release $TAG"

echo -e "${GREEN}[5/6]${NC} Force pushing to main..."
git push origin main -f

echo -e "${GREEN}[6/6]${NC} Pushing tag..."
git push origin "$TAG"

echo ""
echo -e "${GREEN}✓ Successfully republished version ${VERSION}${NC}"
echo ""
echo "Build and release will be created manually."
