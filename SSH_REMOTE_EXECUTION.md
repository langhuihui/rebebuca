# SSH Remote Execution Feature

## Overview

This feature implements SSH remote execution capability for Rebebuca, similar to VSCode's remote development functionality. It allows users to configure tasks to execute commands on remote servers via SSH, with real-time output streaming and process management.

## Architecture

### Components

1. **Remote Agent** (`src-tauri/src/remote_agent.rs`)
   - Standalone Rust binary that runs on remote servers
   - Handles command execution on the remote machine
   - Streams stdout/stderr back to the local client
   - Communicates via JSON messages over stdin/stdout

2. **SSH Module** (`src-tauri/src/ssh.rs`)
   - Manages SSH connections to remote servers
   - Deploys the remote agent to target servers
   - Forwards commands to the remote agent
   - Streams output back to the frontend
   - Supports password and private key authentication

3. **Frontend Integration** (`src/stores/runConfig.ts`)
   - Extended RunConfig interface with SSH configuration
   - Automatic detection of SSH-enabled tasks
   - Routing execution to local or remote based on configuration

4. **UI Components** (`src/components/sidebar/dialogs/TaskEditDialog.vue`)
   - SSH configuration form with validation
   - Connection testing
   - Support for both password and private key authentication

## Features

### SSH Configuration

Tasks can be configured with the following SSH parameters:

- **Host**: Remote server hostname or IP address
- **Port**: SSH port (default: 22)
- **Username**: SSH username for authentication
- **Authentication Method**:
  - Password authentication
  - Private key authentication with optional passphrase

### Remote Agent Deployment

When a task is executed with SSH enabled:

1. The system checks if the remote agent is already deployed
2. If not deployed, it automatically transfers the agent binary to `/tmp/rebebuca-remote-agent-{uuid}` on the remote server
3. The agent is given executable permissions (0755)
4. The agent runs in the background, waiting for commands

### Command Execution Flow

```
Local Rebebuca → SSH Connection → Remote Agent → Command Execution
                                              ↓
                                         stdout/stderr
                                              ↓
                                      JSON Messages
                                              ↓
Local Rebebuca ← Event Emission ← SSH Module
```

### Communication Protocol

The remote agent and local client communicate using JSON messages:

**Execute Command**:
```json
{
  "type": "execute",
  "id": "unique-id",
  "command": "npm run dev",
  "args": ["--port", "3000"],
  "cwd": "/home/user/project",
  "env": {"NODE_ENV": "development"}
}
```

**Process Started**:
```json
{
  "type": "process_started",
  "id": "unique-id",
  "pid": 12345
}
```

**Output**:
```json
{
  "type": "output",
  "id": "unique-id",
  "output_type": "stdout",
  "content": "Server listening on port 3000\n"
}
```

**Process Finished**:
```json
{
  "type": "process_finished",
  "id": "unique-id",
  "exit_code": 0
}
```

**Error**:
```json
{
  "type": "error",
  "id": "unique-id",
  "message": "Command not found"
}
```

## Usage

### Configuring an SSH Task

1. Create or edit a task
2. Enable "使用 SSH 远程执行" (Use SSH Remote Execution)
3. Fill in SSH connection details:
   - Host: e.g., `example.com` or `192.168.1.100`
   - Port: e.g., `22`
   - Username: e.g., `root` or `ubuntu`
4. Choose authentication method:
   - **Password**: Enter SSH password
   - **Private Key**: Select SSH private key file (e.g., `~/.ssh/id_rsa`)
5. Click "测试连接" (Test Connection) to verify connectivity
6. Save the task

### Running an SSH Task

When executing an SSH-configured task:

1. Rebebuca establishes an SSH connection to the remote server
2. The remote agent is deployed (if needed)
3. The command is sent to the remote agent
4. Output streams back in real-time to the local terminal
5. Process status is tracked and displayed

## Security Considerations

### Agent Deployment

- Agents are deployed to `/tmp` with unique IDs
- Executable permissions are set to 0755
- Agents should be periodically cleaned up by the system

### Authentication

- Passwords are stored in memory only (not persisted)
- Private key paths are stored, not the keys themselves
- SSH connections use standard SSH2 library security

### Recommendations

1. **Use SSH Keys**: Private key authentication is more secure than passwords
2. **Protect Private Keys**: Use passphrases for private keys
3. **Limit Permissions**: Use dedicated SSH users with limited permissions
4. **Regular Cleanup**: Remove old remote agents from `/tmp` directories

## Dependencies

### Rust Dependencies

- `ssh2 = "0.9"`: SSH client library
- `lazy_static = "1.4"`: For managing SSH connection pool
- `base64 = "0.21"`: For encoding/decoding data

### System Requirements

- **Remote Server**: Linux/Unix system with SSH server installed
- **Network**: Accessible SSH port (default: 22)
- **Permissions**: Ability to write to `/tmp` directory on remote server

## Localization

Translations are provided for both Chinese (zh-CN) and English (en):

- `task.useSsh`: Toggle for SSH remote execution
- `task.sshConfig`: SSH configuration section title
- `task.sshHost`: SSH host input label
- `task.sshPort`: SSH port input label
- `task.sshUsername`: Username input label
- `task.sshAuthMethod`: Authentication method selector
- `task.sshPassword`: Password input label
- `task.sshPrivateKey`: Private key path input label
- `task.sshPassphrase`: Private key passphrase input label
- `task.sshTestConnection`: Test connection button
- `task.sshTestSuccess`: Connection successful message
- `task.sshTestFailed`: Connection failed message

## Limitations

1. **Agent Persistence**: Agents are deployed to `/tmp` and may be cleaned by the system
2. **No Reconnection**: If SSH connection drops, task must be restarted
3. **Single Session**: Each task execution creates a new SSH connection
4. **Platform Support**: Remote agent currently supports Linux/Unix systems

## Future Enhancements

Potential improvements for the SSH remote execution feature:

1. **Agent Management**: UI to view and manage deployed agents
2. **Connection Pooling**: Reuse SSH connections for multiple tasks
3. **Automatic Reconnection**: Handle network interruptions gracefully
4. **Multi-Platform Agents**: Support for Windows remote agents
5. **SSH Config Integration**: Import settings from `~/.ssh/config`
6. **Port Forwarding**: Support for SSH port forwarding in tasks
7. **File Synchronization**: Sync local files to remote before execution
8. **Agent Updates**: Automatically update remote agents when app updates

## Troubleshooting

### Connection Test Fails

- Verify host and port are correct
- Check firewall rules allow SSH connections
- Ensure SSH server is running on remote host
- Verify username and authentication credentials

### Agent Deployment Fails

- Check write permissions in remote `/tmp` directory
- Verify sufficient disk space on remote server
- Check if firewall blocks SCP transfers

### Command Execution Fails

- Verify the command exists on the remote system
- Check PATH and environment variables on remote system
- Ensure working directory exists on remote server
- Review remote agent logs if available

## References

- SSH2 Library Documentation: https://docs.rs/ssh2/
- Tauri Documentation: https://tauri.app/
- VSCode Remote Development: https://code.visualstudio.com/docs/remote/remote-overview
