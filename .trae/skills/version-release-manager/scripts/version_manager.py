#!/usr/bin/env python3
"""
Version Manager Script
Handles version detection, validation, and increment operations for releases.
"""

import json
import re
import sys
import subprocess
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

class VersionManager:
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root).resolve()
        self.version_files = {
            "package.json": self.project_root / "package.json",
            "tauri.conf.json": self.project_root / "src-tauri" / "tauri.conf.json", 
            "Cargo.toml": self.project_root / "src-tauri" / "Cargo.toml"
        }
    
    def get_current_version(self) -> Optional[str]:
        """Get current version from package.json"""
        try:
            with open(self.version_files["package.json"], 'r') as f:
                data = json.load(f)
                return data.get("version")
        except (FileNotFoundError, json.JSONDecodeError, KeyError):
            return None
    
    def validate_version(self, version: str) -> bool:
        """Validate semantic version format (x.y.z)"""
        pattern = r'^[0-9]+\.[0-9]+\.[0-9]+$'
        return bool(re.match(pattern, version))
    
    def parse_version(self, version: str) -> Tuple[int, int, int]:
        """Parse version string into major, minor, patch components"""
        if not self.validate_version(version):
            raise ValueError(f"Invalid version format: {version}")
        
        parts = version.split('.')
        return int(parts[0]), int(parts[1]), int(parts[2])
    
    def increment_version(self, version: str, increment_type: str) -> str:
        """Increment version by type (major, minor, patch)"""
        major, minor, patch = self.parse_version(version)
        
        if increment_type == "major":
            return f"{major + 1}.0.0"
        elif increment_type == "minor":
            return f"{major}.{minor + 1}.0"
        elif increment_type == "patch":
            return f"{major}.{minor}.{patch + 1}"
        else:
            raise ValueError(f"Invalid increment type: {increment_type}")
    
    def suggest_next_version(self, current_version: str) -> Dict[str, str]:
        """Suggest next versions for all increment types"""
        return {
            "patch": self.increment_version(current_version, "patch"),
            "minor": self.increment_version(current_version, "minor"), 
            "major": self.increment_version(current_version, "major")
        }
    
    def check_git_status(self) -> Dict[str, Any]:
        """Check git repository status"""
        try:
            # Check for uncommitted changes
            result = subprocess.run(
                ["git", "diff", "--quiet"], 
                cwd=self.project_root,
                capture_output=True
            )
            has_unstaged = result.returncode != 0
            
            result = subprocess.run(
                ["git", "diff", "--staged", "--quiet"],
                cwd=self.project_root, 
                capture_output=True
            )
            has_staged = result.returncode != 0
            
            return {
                "clean": not (has_unstaged or has_staged),
                "has_unstaged": has_unstaged,
                "has_staged": has_staged
            }
        except subprocess.CalledProcessError:
            return {"clean": False, "error": "Git repository not found"}
    
    def tag_exists(self, version: str) -> bool:
        """Check if git tag already exists"""
        try:
            result = subprocess.run(
                ["git", "rev-parse", f"v{version}"],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except subprocess.CalledProcessError:
            return False
    
    def check_typescript(self) -> Dict[str, Any]:
        """Check TypeScript compilation errors"""
        try:
            result = subprocess.run(
                ["pnpm", "build", "--mode=check"],
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Check if pnpm is available, fallback to npm
            if result.returncode == 127:
                result = subprocess.run(
                    ["npm", "run", "build", "--", "--mode=check"],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
            
            # Try tsc directly if build scripts fail
            if result.returncode != 0:
                result = subprocess.run(
                    ["npx", "tsc", "--noEmit"],
                    cwd=self.project_root,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
            
            return {
                "clean": result.returncode == 0,
                "errors": result.stderr if result.returncode != 0 else "",
                "stdout": result.stdout,
                "stderr": result.stderr
            }
        except subprocess.TimeoutExpired:
            return {
                "clean": False,
                "errors": "TypeScript check timed out after 60 seconds",
                "stdout": "",
                "stderr": "Timeout"
            }
        except FileNotFoundError:
            return {
                "clean": False,
                "errors": "TypeScript not found. Please install TypeScript",
                "stdout": "",
                "stderr": "TypeScript not installed"
            }
        except Exception as e:
            return {
                "clean": False,
                "errors": f"Error running TypeScript check: {str(e)}",
                "stdout": "",
                "stderr": str(e)
            }
    
    def get_release_info(self, version: str) -> Dict[str, Any]:
        """Get comprehensive release information"""
        current = self.get_current_version()
        git_status = self.check_git_status()
        typescript_status = self.check_typescript()
        
        return {
            "current_version": current,
            "target_version": version,
            "version_valid": self.validate_version(version),
            "git_clean": git_status["clean"],
            "git_status": git_status,
            "tag_exists": self.tag_exists(version),
            "version_files_exist": {
                name: path.exists() 
                for name, path in self.version_files.items()
            },
            "typescript_clean": typescript_status["clean"],
            "typescript_status": typescript_status,
            "suggestions": self.suggest_next_version(current) if current else {}
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: python version_manager.py <command> [args]")
        print("Commands:")
        print("  current                    - Get current version")
        print("  validate <version>         - Validate version format")
        print("  increment <version> <type> - Increment version (patch/minor/major)")
        print("  suggest <version>          - Suggest next versions")
        print("  check-git                  - Check git status")
        print("  check-tsc                  - Check TypeScript compilation")
        print("  tag-exists <version>       - Check if tag exists")
        print("  release-info <version>     - Get release information")
        sys.exit(1)
    
    manager = VersionManager()
    command = sys.argv[1]
    
    try:
        if command == "current":
            version = manager.get_current_version()
            print(version if version else "No version found")
        
        elif command == "validate":
            if len(sys.argv) < 3:
                print("Usage: validate <version>")
                sys.exit(1)
            version = sys.argv[2]
            print("valid" if manager.validate_version(version) else "invalid")
        
        elif command == "increment":
            if len(sys.argv) < 4:
                print("Usage: increment <version> <type>")
                sys.exit(1)
            version = sys.argv[2]
            increment_type = sys.argv[3]
            print(manager.increment_version(version, increment_type))
        
        elif command == "suggest":
            if len(sys.argv) < 3:
                print("Usage: suggest <version>")
                sys.exit(1)
            version = sys.argv[2]
            suggestions = manager.suggest_next_version(version)
            for type_name, suggested_version in suggestions.items():
                print(f"{type_name}: {suggested_version}")
        
        elif command == "check-git":
            status = manager.check_git_status()
            print(json.dumps(status, indent=2))
        
        elif command == "check-tsc":
            status = manager.check_typescript()
            print(json.dumps(status, indent=2))
        
        elif command == "tag-exists":
            if len(sys.argv) < 3:
                print("Usage: tag-exists <version>")
                sys.exit(1)
            version = sys.argv[2]
            print("exists" if manager.tag_exists(version) else "not-exists")
        
        elif command == "release-info":
            if len(sys.argv) < 3:
                print("Usage: release-info <version>")
                sys.exit(1)
            version = sys.argv[2]
            info = manager.get_release_info(version)
            print(json.dumps(info, indent=2))
        
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()