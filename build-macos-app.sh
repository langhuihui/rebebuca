#!/bin/bash

# Build script for macOS app bundle
set -e

BINARY_NAME="rebebuca"
APP_NAME="Rebebuca.app"
BUNDLE_DIR="${APP_NAME}/Contents"
RESOURCES_DIR="${BUNDLE_DIR}/Resources"
MACOS_DIR="${BUNDLE_DIR}/MacOS"
ICON_SOURCE="assets/icons/icon.icns"
INFO_PLIST="Info.plist"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building macOS app bundle...${NC}"

# Build the release binary
echo -e "${YELLOW}Building release binary...${NC}"
cargo build --release

# Find the binary path
if [ -f "target/release/${BINARY_NAME}" ]; then
    BINARY_PATH="target/release/${BINARY_NAME}"
elif [ -f "target/release/rebebuca-app/${BINARY_NAME}" ]; then
    BINARY_PATH="target/release/rebebuca-app/${BINARY_NAME}"
else
    echo "Error: Could not find release binary"
    exit 1
fi

# Create bundle structure
echo -e "${YELLOW}Creating app bundle structure...${NC}"
rm -rf "${APP_NAME}"
mkdir -p "${RESOURCES_DIR}"
mkdir -p "${MACOS_DIR}"

# Copy binary
echo -e "${YELLOW}Copying binary...${NC}"
cp "${BINARY_PATH}" "${MACOS_DIR}/${BINARY_NAME}"
chmod +x "${MACOS_DIR}/${BINARY_NAME}"

# Copy icon
if [ -f "${ICON_SOURCE}" ]; then
    echo -e "${YELLOW}Copying icon...${NC}"
    cp "${ICON_SOURCE}" "${RESOURCES_DIR}/icon.icns"
else
    echo -e "${YELLOW}Warning: Icon file not found at ${ICON_SOURCE}${NC}"
fi

# Copy Info.plist
if [ -f "${INFO_PLIST}" ]; then
    echo -e "${YELLOW}Copying Info.plist...${NC}"
    cp "${INFO_PLIST}" "${BUNDLE_DIR}/Info.plist"
else
    echo -e "${YELLOW}Warning: Info.plist not found${NC}"
fi

echo -e "${GREEN}App bundle created successfully: ${APP_NAME}${NC}"
echo -e "${GREEN}You can now run: open ${APP_NAME}${NC}"

