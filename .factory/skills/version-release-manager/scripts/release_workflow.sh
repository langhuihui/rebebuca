#!/bin/bash

# Enhanced Release Workflow Script
# Provides flexible release management with validation and error handling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current version from package.json
get_current_version() {
    cd "$PROJECT_ROOT"
    python3 "$SCRIPT_DIR/version_manager.py" current
}

# Validate version format
validate_version() {
    local version=$1
    python3 "$SCRIPT_DIR/version_manager.py" validate "$version"
}

# Check git status
check_git_status() {
    cd "$PROJECT_ROOT"
    python3 "$SCRIPT_DIR/version_manager.py" check-git
}

# Check TypeScript compilation
check_typescript() {
    cd "$PROJECT_ROOT"
    log_info "Running TypeScript type check..."
    local tsc_result=$(python3 "$SCRIPT_DIR/version_manager.py" check-tsc)
    
    if ! echo "$tsc_result" | grep -q '"clean": true'; then
        local errors=$(echo "$tsc_result" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('errors', 'Unknown error'))")
        log_error "TypeScript compilation failed:"
        echo "$errors"
        return 1
    fi
    
    log_success "TypeScript check passed"
    return 0
}

# Check if tag exists
tag_exists() {
    local version=$1
    cd "$PROJECT_ROOT"
    result=$(python3 "$SCRIPT_DIR/version_manager.py" tag-exists "$version")
    [ "$result" = "exists" ]
}

# Get release information
get_release_info() {
    local version=$1
    cd "$PROJECT_ROOT"
    python3 "$SCRIPT_DIR/version_manager.py" release-info "$version"
}

# Suggest next versions
suggest_versions() {
    local current_version=$1
    cd "$PROJECT_ROOT"
    python3 "$SCRIPT_DIR/version_manager.py" suggest "$current_version"
}

# Update version in files
update_version_files() {
    local version=$1
    cd "$PROJECT_ROOT"
    
    log_info "Updating version to $version in project files..."
    
    # Update package.json
    if [ -f "package.json" ]; then
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$version\"/" package.json
        log_success "Updated package.json"
    fi
    
    # Update tauri.conf.json
    if [ -f "src-tauri/tauri.conf.json" ]; then
        sed -i '' "s/\"version\": \".*\"/\"version\": \"$version\"/" src-tauri/tauri.conf.json
        log_success "Updated src-tauri/tauri.conf.json"
    fi
    
    # Update Cargo.toml
    if [ -f "src-tauri/Cargo.toml" ]; then
        sed -i '' "s/^version = \".*\"/version = \"$version\"/" src-tauri/Cargo.toml
        log_success "Updated src-tauri/Cargo.toml"
        
        # Update Cargo.lock
        cd src-tauri && cargo check --quiet 2>/dev/null || true && cd ..
        log_success "Updated src-tauri/Cargo.lock"
    fi
}

# Commit and tag release
commit_and_tag() {
    local version=$1
    local message=${2:-"chore: bump version to $version"}
    
    cd "$PROJECT_ROOT"
    
    log_info "Committing version changes..."
    git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock 2>/dev/null || true
    git commit -m "$message"
    log_success "Committed changes"
    
    log_info "Creating git tag v$version..."
    git tag -a "v$version" -m "Release v$version"
    log_success "Created tag v$version"
}

# Push to remote
push_release() {
    local version=$1
    
    cd "$PROJECT_ROOT"
    
    log_info "Pushing to remote repository..."
    git push origin main
    git push origin "v$version"
    log_success "Pushed release to remote"
}

# Main release function
release_version() {
    local version=$1
    local skip_checks=${2:-false}
    
    cd "$PROJECT_ROOT"
    
    log_info "Starting release process for version $version..."
    
    # Validation checks
    if [ "$skip_checks" != "true" ]; then
        # Validate version format
        if [ "$(validate_version "$version")" != "valid" ]; then
            log_error "Invalid version format: $version (expected x.y.z)"
            exit 1
        fi
        
        # Check git status
        git_status=$(check_git_status)
        if ! echo "$git_status" | grep -q '"clean": true'; then
            log_error "Git repository has uncommitted changes. Please commit or stash them first."
            exit 1
        fi
        
        # Check TypeScript compilation
        if ! check_typescript; then
            log_error "TypeScript compilation check failed. Please fix the errors before releasing."
            exit 1
        fi
        
        # Check if tag exists
        if tag_exists "$version"; then
            log_error "Tag v$version already exists"
            exit 1
        fi
    fi
    
    # Update version files
    update_version_files "$version"
    
    # Commit and tag
    commit_and_tag "$version"
    
    # Push to remote
    push_release "$version"
    
    log_success "Successfully released version $version"
    echo ""
    echo "GitHub Actions will now build and create the release."
    echo "Check progress at: https://github.com/langhuihui/rebebuca/actions"
}

# Republish existing version
republish_version() {
    local version=${1:-$(get_current_version)}
    local commit_msg=${2:-"chore: republish v$version"}
    
    cd "$PROJECT_ROOT"
    
    log_info "Republishing version $version..."
    
    # Check if tag exists locally
    if ! tag_exists "$version"; then
        log_error "Tag v$version does not exist locally"
        exit 1
    fi
    
    # Delete local tag
    log_info "Deleting local tag v$version..."
    git tag -d "v$version"
    
    # Delete remote tag
    log_info "Deleting remote tag v$version..."
    git push origin --delete "v$version" 2>/dev/null || log_warning "Remote tag not found, skipping..."
    
    # Commit any changes
    if ! git diff --quiet || ! git diff --staged --quiet; then
        log_info "Committing changes..."
        git add -A
        git commit -m "$commit_msg"
    else
        log_warning "No changes to commit, skipping commit..."
    fi
    
    # Create new tag
    log_info "Creating new tag v$version..."
    git tag -a "v$version" -m "Release v$version"
    
    # Force push to main and push tag
    log_info "Pushing to remote..."
    git push origin main -f
    git push origin "v$version"
    
    log_success "Successfully republished version $version"
}

# Interactive version selection
interactive_release() {
    local current_version=$(get_current_version)
    
    if [ -z "$current_version" ]; then
        log_error "Could not determine current version"
        exit 1
    fi
    
    log_info "Current version: $current_version"
    echo ""
    echo "Suggested next versions:"
    suggest_versions "$current_version"
    echo ""
    
    read -p "Enter the version to release (or press Enter to cancel): " version
    
    if [ -z "$version" ]; then
        log_info "Release cancelled"
        exit 0
    fi
    
    release_version "$version"
}

# Show usage
show_usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  release <version>              Release a new version"
    echo "  republish [version] [message]  Republish existing version"
    echo "  interactive                    Interactive release selection"
    echo "  current                        Show current version"
    echo "  suggest                        Show suggested next versions"
    echo "  info <version>                 Show release information"
    echo ""
    echo "Options:"
    echo "  --skip-checks                  Skip validation checks (use with caution)"
    echo ""
    echo "Examples:"
    echo "  $0 release 1.2.3"
    echo "  $0 republish"
    echo "  $0 interactive"
    echo "  $0 suggest"
}

# Main script logic
main() {
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    command=$1
    shift
    
    case $command in
        "release")
            if [ -z "$1" ]; then
                log_error "Version number is required"
                show_usage
                exit 1
            fi
            version=$1
            skip_checks=false
            if [ "$2" = "--skip-checks" ]; then
                skip_checks=true
            fi
            release_version "$version" "$skip_checks"
            ;;
        "republish")
            republish_version "$1" "$2"
            ;;
        "interactive")
            interactive_release
            ;;
        "current")
            current=$(get_current_version)
            echo "Current version: ${current:-"Unknown"}"
            ;;
        "suggest")
            current=$(get_current_version)
            if [ -n "$current" ]; then
                echo "Current version: $current"
                echo "Suggested next versions:"
                suggest_versions "$current"
            else
                log_error "Could not determine current version"
                exit 1
            fi
            ;;
        "info")
            if [ -z "$1" ]; then
                log_error "Version number is required"
                exit 1
            fi
            get_release_info "$1"
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"