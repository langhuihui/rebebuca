# Semantic Versioning Reference

## Version Format

Semantic versioning uses a three-part version number: `MAJOR.MINOR.PATCH`

### Version Components

- **MAJOR**: Incremented for incompatible API changes
- **MINOR**: Incremented for backwards-compatible functionality additions  
- **PATCH**: Incremented for backwards-compatible bug fixes

### Examples

- `1.0.0` - Initial stable release
- `1.0.1` - Patch release (bug fix)
- `1.1.0` - Minor release (new feature)
- `2.0.0` - Major release (breaking change)

## When to Increment Each Component

### Patch Version (x.y.Z)

Increment when making backwards-compatible bug fixes:
- Security patches
- Performance improvements
- Documentation fixes
- Internal refactoring
- Dependency updates (non-breaking)

### Minor Version (x.Y.z)

Increment when adding functionality in a backwards-compatible manner:
- New features
- New API endpoints
- Optional parameters
- Deprecating functionality (but not removing)
- Substantial internal improvements

### Major Version (X.y.z)

Increment when making incompatible API changes:
- Removing public APIs
- Changing existing API behavior
- Removing deprecated features
- Changing configuration formats
- Requiring newer runtime versions

## Pre-release Versions

For development and testing:
- `1.0.0-alpha.1` - Alpha release
- `1.0.0-beta.1` - Beta release  
- `1.0.0-rc.1` - Release candidate

## Version Precedence

Version precedence is determined by comparing each component:
- `1.0.0 < 2.0.0 < 2.1.0 < 2.1.1`
- Pre-release versions have lower precedence than normal versions
- `1.0.0-alpha < 1.0.0`

## Best Practices

1. **Start with 0.1.0** for initial development
2. **Use 1.0.0** for first stable release
3. **Never reuse version numbers** once published
4. **Document breaking changes** clearly in major releases
5. **Use pre-release versions** for testing
6. **Follow conventional commits** for automatic version determination

## Conventional Commits Integration

Commit message prefixes can indicate version increment type:
- `fix:` → Patch version increment
- `feat:` → Minor version increment  
- `BREAKING CHANGE:` → Major version increment

## Version Ranges

For dependency management:
- `^1.2.3` - Compatible within major version (>=1.2.3 <2.0.0)
- `~1.2.3` - Compatible within minor version (>=1.2.3 <1.3.0)
- `1.2.3` - Exact version match