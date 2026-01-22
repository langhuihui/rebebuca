# Release Checklist

## Pre-Release Preparation

### Code Quality
- [ ] All tests are passing
- [ ] Code coverage meets requirements
- [ ] Linting passes without errors
- [ ] Security scan completed
- [ ] Performance benchmarks acceptable

### Documentation
- [ ] CHANGELOG.md updated with new features and fixes
- [ ] README.md reflects current functionality
- [ ] API documentation updated
- [ ] Migration guides written (for breaking changes)

### Version Planning
- [ ] Determine appropriate version increment (patch/minor/major)
- [ ] Check for breaking changes
- [ ] Review commit history since last release
- [ ] Validate semantic versioning compliance

## Release Process

### Git Repository
- [ ] All changes committed and pushed
- [ ] Working directory is clean
- [ ] On correct branch (usually main/master)
- [ ] Pull latest changes from remote

### Version Updates
- [ ] Update version in package.json
- [ ] Update version in src-tauri/tauri.conf.json
- [ ] Update version in src-tauri/Cargo.toml
- [ ] Update Cargo.lock file
- [ ] Verify all version files are consistent

### Git Operations
- [ ] Commit version changes with conventional message
- [ ] Create annotated git tag
- [ ] Push commits to remote
- [ ] Push tags to remote

## Post-Release Verification

### Automated Builds
- [ ] CI/CD pipeline triggered successfully
- [ ] All build targets completed
- [ ] Artifacts generated correctly
- [ ] Distribution packages created

### Release Assets
- [ ] GitHub release created automatically
- [ ] Release notes populated
- [ ] Binary downloads available
- [ ] Checksums provided

### Notifications
- [ ] Team notified of release
- [ ] Users informed of new version
- [ ] Breaking changes communicated
- [ ] Documentation sites updated

## Rollback Procedures

### If Release Fails
- [ ] Stop CI/CD pipeline if running
- [ ] Delete git tag locally and remotely
- [ ] Revert version commits if necessary
- [ ] Fix issues and retry release

### If Issues Discovered Post-Release
- [ ] Assess severity of issues
- [ ] Decide on hotfix vs. next release
- [ ] Create hotfix branch if needed
- [ ] Follow emergency release process

## Emergency Release Process

For critical security fixes or major bugs:

1. **Immediate Assessment**
   - Determine impact and urgency
   - Identify minimum viable fix
   - Skip non-critical checks if necessary

2. **Rapid Development**
   - Create hotfix branch from release tag
   - Implement minimal fix
   - Test fix thoroughly but quickly

3. **Expedited Release**
   - Increment patch version
   - Follow abbreviated release process
   - Prioritize speed over process

4. **Post-Emergency**
   - Conduct post-mortem
   - Update processes to prevent recurrence
   - Communicate lessons learned

## Version-Specific Considerations

### Patch Releases (x.y.Z)
- Minimal risk assessment needed
- Can be automated
- Quick turnaround acceptable

### Minor Releases (x.Y.z)
- Feature validation required
- Backwards compatibility testing
- Documentation updates essential

### Major Releases (X.y.z)
- Extensive testing required
- Migration guides mandatory
- Staged rollout recommended
- User communication critical

## Tools and Automation

### Required Tools
- Git with proper configuration
- Python 3.x for version management scripts
- Cargo for Rust dependency management
- CI/CD system access

### Automation Opportunities
- Version increment calculation
- File updates across project
- Git operations and tagging
- Release note generation
- Notification sending