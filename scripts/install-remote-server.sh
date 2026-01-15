#!/bin/bash
#
# Rebebuca Remote Server Installer
# Usage: curl -fsSL https://download.m7s.live/rb/install-remote-server.sh | bash
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
INSTALL_DIR="${INSTALL_DIR:-/opt/rebebuca}"
VERSION="${VERSION:-latest}"
BASE_URL="https://download.m7s.live/rb"

print_banner() {
    echo -e "${BLUE}"
    echo "  ____      _          _                    "
    echo " |  _ \ ___| |__   ___| |__  _   _  ___ __ _ "
    echo " | |_) / _ \ '_ \ / _ \ '_ \| | | |/ __/ _\` |"
    echo " |  _ <  __/ |_) |  __/ |_) | |_| | (_| (_| |"
    echo " |_| \_\___|_.__/ \___|_.__/ \__,_|\___\__,_|"
    echo -e "${NC}"
    echo "  Remote Server Installer"
    echo ""
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

detect_arch() {
    local arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)
            echo "x86_64"
            ;;
        aarch64|arm64)
            echo "aarch64"
            ;;
        *)
            error "Unsupported architecture: $arch"
            ;;
    esac
}

detect_os() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$os" in
        linux)
            echo "linux"
            ;;
        darwin)
            echo "darwin"
            ;;
        *)
            error "Unsupported operating system: $os"
            ;;
    esac
}

check_dependencies() {
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        error "Either curl or wget is required to download the binary"
    fi
}

download_file() {
    local url="$1"
    local output="$2"
    
    if command -v curl &> /dev/null; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget &> /dev/null; then
        wget -q "$url" -O "$output"
    fi
}

resolve_latest_version() {
    # Resolve latest version from releases.json so we don't need a /latest/ directory
    local tmp_file=$(mktemp)
    if ! download_file "${BASE_URL}/releases.json" "$tmp_file"; then
        rm -f "$tmp_file"
        error "Failed to download releases.json"
    fi

    local latest=$(sed -n 's/.*"latest"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$tmp_file" | head -n 1)
    rm -f "$tmp_file"

    if [ -z "$latest" ]; then
        error "Failed to parse latest version from releases.json"
    fi

    echo "v${latest}"
}

get_download_url() {
    local os="$1"
    local arch="$2"
    local version="$3"

    # Remote server is Linux-only
    if [ "$os" != "linux" ]; then
        error "Remote server is currently only available for Linux. Your OS: $os"
    fi

    # Resolve latest version via releases.json
    if [ "$version" = "latest" ]; then
        version=$(resolve_latest_version)
    fi

    # Support x86_64 and aarch64
    if [ "$arch" != "x86_64" ] && [ "$arch" != "aarch64" ]; then
        error "Unsupported architecture: $arch"
    fi

    echo "${BASE_URL}/${version}/remote-agent-server/rebebuca-remote-server-linux-${arch}.tar.gz"
}

install() {
    print_banner
    
    info "Detecting system..."
    local os=$(detect_os)
    local arch=$(detect_arch)
    info "OS: $os, Architecture: $arch"
    
    check_dependencies
    
    info "Version: $VERSION"
    
    local download_url=$(get_download_url "$os" "$arch" "$VERSION")
    info "Download URL: $download_url"
    
    # Create temp directory
    local tmp_dir=$(mktemp -d)
    local tmp_file="$tmp_dir/rebebuca-remote-server.tar.gz"
    
    info "Downloading rebebuca-remote-server..."
    if ! download_file "$download_url" "$tmp_file"; then
        rm -rf "$tmp_dir"
        error "Failed to download from $download_url"
    fi
    
    # Extract the archive
    info "Extracting archive..."
    tar -xzf "$tmp_file" -C "$tmp_dir"
    
    # Check if we need sudo
    local use_sudo=""
    if [ ! -w "$(dirname "$INSTALL_DIR")" ]; then
        if command -v sudo &> /dev/null; then
            use_sudo="sudo"
            warn "Installation directory $INSTALL_DIR requires sudo..."
        else
            rm -rf "$tmp_dir"
            error "Cannot write to $INSTALL_DIR and sudo is not available"
        fi
    fi
    
    # Remove old installation if exists
    if [ -d "$INSTALL_DIR" ]; then
        warn "Removing existing installation at $INSTALL_DIR..."
        $use_sudo rm -rf "$INSTALL_DIR"
    fi
    
    # Move extracted directory to install location
    info "Installing to $INSTALL_DIR..."
    $use_sudo mv "$tmp_dir/rebebuca-remote-server" "$INSTALL_DIR"
    
    # Make binary executable
    $use_sudo chmod +x "$INSTALL_DIR/rebebuca-remote-server"
    
    # Create symlink in /usr/local/bin for easy access
    if [ -d "/usr/local/bin" ]; then
        info "Creating symlink in /usr/local/bin..."
        $use_sudo ln -sf "$INSTALL_DIR/rebebuca-remote-server" /usr/local/bin/rebebuca-remote-server
    fi
    
    # Cleanup
    rm -rf "$tmp_dir"
    
    success "rebebuca-remote-server installed successfully!"
    echo ""
    echo "  Installation directory: $INSTALL_DIR"
    echo "  Binary: $INSTALL_DIR/rebebuca-remote-server"
    echo "  Web assets: $INSTALL_DIR/dist/"
    echo ""
    echo "  Quick start:"
    echo "    rebebuca-remote-server --help"
    echo ""
    echo "  To generate a config file:"
    echo "    rebebuca-remote-server --generate-config > config.toml"
    echo ""
    echo "  To start the server:"
    echo "    cd $INSTALL_DIR && ./rebebuca-remote-server -c config.toml"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -d|--dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        -h|--help)
            print_banner
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --version VERSION   Specify version to install (default: latest)"
            echo "  -d, --dir DIRECTORY     Specify installation directory (default: /opt/rebebuca)"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  VERSION                 Same as --version"
            echo "  INSTALL_DIR             Same as --dir"
            echo ""
            echo "Examples:"
            echo "  # Install latest version"
            echo "  curl -fsSL https://download.m7s.live/rb/install-remote-server.sh | bash"
            echo ""
            echo "  # Install specific version"
            echo "  curl -fsSL https://download.m7s.live/rb/install-remote-server.sh | VERSION=v0.1.0 bash"
            echo ""
            echo "  # Install to custom directory"
            echo "  curl -fsSL https://download.m7s.live/rb/install-remote-server.sh | INSTALL_DIR=~/.local/bin bash"
            echo ""
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

install
