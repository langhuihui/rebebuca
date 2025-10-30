# Rebebuca

<div align="center">
  <img src="assets/icons/logo.svg" alt="Rebebuca Logo" width="120" height="120">
  
  <h3>Powerful Run Configuration Management Tool</h3>
  
  <p>A modern desktop application that helps developers quickly manage and execute various commands and scripts</p>

  [![Build Status](https://img.shields.io/github/actions/workflow/status/langhuihui/rebebuca/build.yml?branch=main&style=flat-square&logo=github)](https://github.com/langhuihui/rebebuca/actions)
  [![GPUI](https://img.shields.io/badge/GPUI-0.2.2-FF6B6B?style=flat-square&logo=rust)](https://github.com/zed-industries/zed)
  [![Rust](https://img.shields.io/badge/Rust-1.70+-DEA584?style=flat-square&logo=rust)](https://www.rust-lang.org/)
  [![License](https://img.shields.io/badge/License-GPL--3.0-green.svg?style=flat-square)](LICENSE)

  [中文文档](README_CN.md) | English
</div>

---

## ✨ Features

- 🚀 **Quick Launch** - Create and run configurations with one click, no need to memorize complex commands
- ⚡ **Real-time Output** - View command execution results in real-time with multi-tab support
- 📝 **Configuration Management** - Support for advanced options like working directory and environment variables
- 🕒 **History Tracking** - Automatically save run history for easy re-execution
- 🎨 **Modern UI** - Beautiful native interface built with GPUI
- 💾 **Persistent Storage** - Configurations and history data are automatically saved and persist across restarts
- 🖥️ **Cross-platform** - Supports Windows, macOS, and Linux
- ⚡ **High Performance** - Pure Rust implementation with native performance

## 📸 Preview

<div align="center">
  <img src="screenshot.png" alt="Application Screenshot" width="800">
</div>

## 🛠️ Tech Stack

### Application
- **GPUI** - Modern Rust GUI framework for native desktop applications
- **Rust** - Systems programming language ensuring performance and safety
- **Tokio** - Async runtime for Rust
- **Serde** - Serialization framework for data persistence

### Architecture
- **Pure Rust** - No web technologies, no JavaScript, no HTML/CSS
- **Native Performance** - Direct OS integration via GPUI
- **Small Binary Size** - ~12MB vs ~20MB+ for web-based solutions

## 📦 Installation

### Prerequisites

- **Rust** >= 1.70.0
- **Cargo** (comes with Rust)

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/rebebuca.git
cd rebebuca
```

2. **Build the application**
```bash
cargo build
```

3. **Run the application**
```bash
cargo run
```

## 🚀 Usage Guide

### Creating Run Configurations

1. Click the **"New"** button in the left sidebar
2. Fill in the configuration details:
   - **Name**: Display name for the configuration
   - **Command**: The command to execute
   - **Working Directory**: Directory where the command will run (optional)
   - **Environment Variables**: Additional environment variables (optional)
3. Click **"Save"** to complete

### Running Configurations

- Click the **play button** ▶️ next to a configuration in the left sidebar
- The command will execute in a new tab, showing real-time output
- Multiple configurations can run simultaneously

### Managing Tabs

- **Restart**: Re-execute the current configuration
- **Stop**: Terminate the running command
- **Clear**: Clear console output
- **Scroll to Bottom**: Jump to the latest output
- **Edit**: Modify the configuration associated with the current tab

### Run History

- The right panel displays recent run history
- Click the **rerun button** to quickly execute historical commands
- Support for clearing history

## 📁 Project Structure

```
rebebuca/
├── Cargo.toml                   # Workspace configuration
├── crates/
│   ├── rebebuca-core/          # Core business logic
│   │   ├── src/
│   │   │   ├── lib.rs         # Main library
│   │   │   ├── models.rs      # Data models
│   │   │   ├── process.rs     # Process management
│   │   │   └── storage.rs     # Data persistence
│   │   └── Cargo.toml
│   ├── rebebuca-ui/            # GPUI UI components
│   │   ├── src/
│   │   │   ├── lib.rs         # UI library
│   │   │   ├── app.rs         # Main application view
│   │   │   ├── theme.rs       # Theme system
│   │   │   ├── ansi.rs        # ANSI color support
│   │   │   └── components/    # UI components
│   │   └── Cargo.toml
│   └── rebebuca-app/           # Main application entry
│       ├── src/
│       │   └── main.rs        # Application entry point
│       └── Cargo.toml
├── assets/                      # Application assets
│   ├── icons/                  # Application icons
│   └── themes/                 # Theme files
└── README.md
```

## 🔨 Building

### Development Mode
```bash
# Build and run in development mode
cargo run
```

### Release Build
```bash
# Build optimized release version
cargo build --release
```

The executable will be located at `target/release/rebebuca`.

### macOS App Bundle (with Icon)

On macOS, to display a custom Dock icon, you need to package the app as a `.app` bundle:

```bash
# Build macOS app bundle (includes icon configuration)
./build-macos-app.sh
```

This creates `Rebebuca.app` with:
- Configured `Info.plist`
- Application icon (`icon.icns`)
- Proper bundle structure

Then run it with:
```bash
open Rebebuca.app
```

**Note**: When running directly with `cargo run`, the app doesn't run as a bundle, so the Dock icon may show as the system default. Use the build script to create the `.app` bundle to display the custom icon.

### Cross-platform Building

The application can be built for different platforms:

```bash
# Build for current platform
cargo build --release

# Build for specific target (requires target to be installed)
cargo build --release --target x86_64-unknown-linux-gnu
cargo build --release --target x86_64-pc-windows-gnu
cargo build --release --target aarch64-apple-darwin
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Development Guidelines

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) 
- Extensions:
  - [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
  - [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) (for debugging)

### Code Standards

- Use Rust standard formatting (`cargo fmt`)
- Follow Rust naming conventions
- Use `cargo clippy` for linting
- Write comprehensive documentation
- Add tests for new functionality

## 🐛 Issue Reporting

If you find a bug or have a feature suggestion, please [create an issue](https://github.com/yourusername/rebebuca/issues/new).

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [GPUI](https://github.com/zed-industries/zed) - Modern Rust GUI framework
- [Rust](https://www.rust-lang.org/) - Systems programming language
- [Tokio](https://tokio.rs/) - Async runtime for Rust
- [Serde](https://serde.rs/) - Serialization framework

---

<div align="center">
  <p>Made with ❤️ and Rust</p>
  <p>If this project helps you, please give it a ⭐️</p>
</div>