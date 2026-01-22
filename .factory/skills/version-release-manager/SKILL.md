---
name: version-release-manager
description: Manages version releases for projects with automated version bumping, tagging, and publishing workflows. Handles semantic versioning, multi-file version updates, and release automation.
---

# Version Release Manager

This skill provides comprehensive version release management capabilities for software projects. It automates the entire release workflow including version bumping, file updates, git tagging, and publishing.

## When to Use This Skill

Use this skill when users need to:
- Release a new version of their project
- Bump version numbers across multiple configuration files
- Create git tags and push releases
- Automate the release workflow
- Handle semantic versioning (major.minor.patch)
- Republish or hotfix existing releases

## Core Functionality

### Version Release Workflow

The skill handles the complete release process:

1. **Version Validation**: Ensures proper semantic versioning format (x.y.z)
2. **Pre-release Checks**: Verifies clean git state, no existing tags, and TypeScript compilation
3. **Multi-file Updates**: Updates version numbers across all relevant files:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/Cargo.lock` (via cargo check)
4. **Git Operations**: Commits changes, creates tags, and pushes to remote
5. **CI/CD Integration**: Triggers automated builds and releases

### TypeScript Compilation Check

The skill automatically validates TypeScript compilation before release:
- Runs `pnpm build --mode=check` or `npx tsc --noEmit`
- Reports type errors and syntax issues
- Prevents releasing with TypeScript errors
- Supports both pnpm and npm package managers

### Supported Operations

- **New Release**: Create a new version release with proper version bumping
- **Republish**: Delete and recreate existing tags for hotfixes
- **Version Increment**: Automatically calculate next version (patch/minor/major)
- **Rollback**: Revert failed releases

## Implementation Details

### Version Detection and Updates

The skill automatically detects and updates version numbers in multiple file formats:

```javascript
// package.json
"version": "0.4.4"

// src-tauri/tauri.conf.json  
"version": "0.4.4"

// src-tauri/Cargo.toml
version = "0.4.4"
```

### Release Scripts Integration

The skill leverages existing release scripts when available:
- `scripts/release.sh` - Main release workflow
- `scripts/republish.sh` - Republish existing versions

### Git Workflow

Standard git operations for releases:
1. Check for uncommitted changes
2. Validate tag doesn't exist
3. Update version files
4. Commit with conventional message format
5. Create annotated git tag
6. Push to origin with tags

### Error Handling

Comprehensive error checking for:
- Invalid version formats
- Existing git tags
- Uncommitted changes
- TypeScript compilation errors
- Missing files
- Network connectivity issues

## Usage Examples

### Basic Version Release
```
Release version 1.2.3
```

### Increment Version Types
```
Bump patch version and release
Bump minor version and release  
Bump major version and release
```

### Republish Scenarios
```
Republish current version with bug fixes
Hotfix and republish v1.2.3
```

### Interactive Release
```
What's the next version I should release?
Help me release a new version
```

## Best Practices

1. **Always check git status** before releasing
2. **Use semantic versioning** (major.minor.patch)
3. **Write meaningful commit messages** following conventional commits
4. **Test releases** in staging environments first
5. **Document breaking changes** in major version releases
6. **Monitor CI/CD pipelines** after pushing tags

## Integration Points

- **GitHub Actions**: Automatically triggered by version tags
- **Package Managers**: Version updates propagate to npm, cargo, etc.
- **Distribution**: Builds and releases created automatically
- **Notifications**: Release announcements and changelogs

The skill ensures consistent, reliable version management across the entire project ecosystem while maintaining proper git history and enabling automated CI/CD workflows.