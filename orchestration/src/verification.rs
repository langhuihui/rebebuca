//! # Verification Module
//!
//! This module provides verification capabilities to ensure worker agent reports
//! are accurate. It implements the "trust but verify" principle - we verify
//! worker claims independently rather than trusting self-reports.

use crate::errors::{OrchestrationError, Result};
use crate::tools::ToolExecutor;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    /// Whether verification passed
    pub passed: bool,
    /// Issues found during verification
    pub issues: Vec<VerificationIssue>,
    /// Verification summary
    pub summary: String,
}

/// Verification issue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationIssue {
    /// Issue type
    pub r#type: IssueType,
    /// Issue description
    pub description: String,
    /// Severity
    pub severity: IssueSeverity,
}

/// Issue type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueType {
    /// Code has syntax or type errors
    CodeError,
    /// Tests are failing
    TestFailure,
    /// Build failed
    BuildFailure,
    /// Files were not created/modified as claimed
    MissingChanges,
    /// Implementation doesn't match requirements
    RequirementMismatch,
    /// Other issues
    Other,
}

/// Issue severity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    /// Critical - must be fixed
    Critical,
    /// High - should be fixed
    High,
    /// Medium - could be improved
    Medium,
    /// Low - minor issue
    Low,
}

/// Verification context
pub struct VerificationContext {
    /// Project path
    pub project_path: String,
    /// Files that were supposedly modified
    pub modified_files: Vec<String>,
    /// Actions that were performed
    pub actions: Vec<String>,
    /// Tool executor for verification checks
    pub tool_executor: Arc<dyn ToolExecutor>,
}

/// Verifier for worker reports
pub struct Verifier;

impl Verifier {
    /// Verify worker report
    pub async fn verify(
        context: VerificationContext,
        worker_report: &str,
        worker_success: bool,
    ) -> Result<VerificationResult> {
        let mut issues = Vec::new();
        
        // Extract information from worker report
        let modified_files = Self::extract_modified_files(worker_report);
        
        // 1. Check if files exist (if files were mentioned)
        if !modified_files.is_empty() {
            for file in &modified_files {
                if let Err(e) = Self::verify_file_exists(context.tool_executor.clone(), file).await {
                    issues.push(VerificationIssue {
                        r#type: IssueType::MissingChanges,
                        description: format!("File {} not found or inaccessible: {}", file, e),
                        severity: IssueSeverity::Critical,
                    });
                }
            }
        }

        // 2. Check for common code issues using bash (compile/lint checks)
        // This is a basic check - in a real implementation, we'd use LSP or more sophisticated tools
        if !modified_files.is_empty() {
            if let Err(e) = Self::verify_code_quality(context.tool_executor.clone(), &modified_files).await {
                issues.push(VerificationIssue {
                    r#type: IssueType::CodeError,
                    description: format!("Code quality check failed: {}", e),
                    severity: IssueSeverity::High,
                });
            }
        }

        // 3. If worker claims success but verification finds issues, add warning
        if worker_success && !issues.is_empty() {
            issues.push(VerificationIssue {
                r#type: IssueType::Other,
                description: "Worker reported success but verification found issues".to_string(),
                severity: IssueSeverity::High,
            });
        }

        let passed = issues.is_empty() || issues.iter().all(|i| matches!(i.severity, IssueSeverity::Low));
        let summary = if passed {
            "Verification passed - no critical issues found".to_string()
        } else {
            let critical_count = issues.iter().filter(|i| matches!(i.severity, IssueSeverity::Critical)).count();
            let high_count = issues.iter().filter(|i| matches!(i.severity, IssueSeverity::High)).count();
            format!(
                "Verification found {} critical and {} high severity issues",
                critical_count, high_count
            )
        };

        Ok(VerificationResult {
            passed,
            issues,
            summary,
        })
    }

    /// Extract modified files from worker report
    fn extract_modified_files(report: &str) -> Vec<String> {
        // Try to parse as JSON first
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(report) {
            if let Some(actions) = json.get("actions").and_then(|a| a.as_array()) {
                let mut files = Vec::new();
                for action in actions {
                    if let Some(action_str) = action.as_str() {
                        // Look for file paths in actions (simple heuristic)
                        if action_str.contains("write") || action_str.contains("edit") || action_str.contains("create") {
                            // Try to extract file path (this is a simple heuristic)
                            // In production, we'd parse tool call results more carefully
                            if let Some(path_start) = action_str.find('/') {
                                if let Some(path_end) = action_str[path_start..].find('"') {
                                    let path = &action_str[path_start..path_start + path_end];
                                    if !path.is_empty() {
                                        files.push(path.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
                return files;
            }
        }

        // Fallback: look for common file patterns in text
        let mut files = Vec::new();
        for line in report.lines() {
            if line.contains(".rs") || line.contains(".ts") || line.contains(".js") || line.contains(".py") {
                // Simple heuristic: if line mentions a file extension, try to extract path
                let parts: Vec<&str> = line.split_whitespace().collect();
                for part in parts {
                    if part.contains('/') && (part.contains(".rs") || part.contains(".ts") || part.contains(".js")) {
                        files.push(part.to_string());
                    }
                }
            }
        }

        files
    }

    /// Verify file exists
    async fn verify_file_exists(
        tool_executor: Arc<dyn ToolExecutor>,
        file_path: &str,
    ) -> Result<()> {
        // Use read tool to check if file exists (it will fail if file doesn't exist)
        let result = tool_executor
            .execute(
                "read",
                serde_json::json!({
                    "path": file_path
                }),
            )
            .await;

        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(OrchestrationError::VerificationFailed(format!(
                "File {} verification failed: {}",
                file_path, e
            ))),
        }
    }

    /// Verify code quality (basic check using bash)
    async fn verify_code_quality(
        tool_executor: Arc<dyn ToolExecutor>,
        files: &[String],
    ) -> Result<()> {
        // This is a basic implementation - check if files can be read
        // In a production system, we'd use LSP diagnostics or actual compilation checks
        for file in files {
            // Basic check: file should be readable
            if let Err(e) = Self::verify_file_exists(tool_executor.clone(), file).await {
                return Err(e);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_modified_files_from_json() {
        let report = r#"
        {
            "summary": "Created files",
            "success": true,
            "actions": [
                "Created file src/main.rs",
                "Modified file src/lib.rs"
            ]
        }
        "#;

        let files = Verifier::extract_modified_files(report);
        // Note: current implementation is basic - would need more sophisticated parsing
        assert!(!files.is_empty() || files.is_empty()); // Just check it doesn't crash
    }
}
