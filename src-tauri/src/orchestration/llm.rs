//! LLM Client for calling various provider APIs
//!
//! Supports OpenAI, Anthropic, and OpenAI-compatible endpoints

use crate::orchestration::ProviderConfig;
use rebebuca_orchestration::tools::ToolDefinition;
use std::result::Result;
use serde::{Deserialize, Serialize};
use futures::StreamExt;

/// LLM response with potential tool calls
pub struct LLMResponse {
    pub content: String,
    pub tool_calls: Vec<ToolCallInfo>,
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct ToolCallInfo {
    pub id: String,
    pub name: String,
    pub input: serde_json::Value,
}

/// LLM message for chat API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMMessage {
    pub role: String, // "system", "user", "assistant"
    pub content: String,
}

/// OpenAI tool definition
#[derive(Debug, Serialize)]
struct OpenAITool {
    #[serde(rename = "type")]
    tool_type: String,
    function: OpenAIToolFunction,
}

#[derive(Debug, Serialize)]
struct OpenAIToolFunction {
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct StreamOptions {
    include_usage: bool,
}

#[derive(Debug, Serialize)]
struct OpenRouterProviderParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    data_collection: Option<String>,
}

/// LLM chat completion request
#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<LLMMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<OpenAITool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream_options: Option<StreamOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    provider: Option<OpenRouterProviderParams>,
}

/// LLM chat completion response
#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChoiceMessage {
    content: String,
    #[serde(default)]
    tool_calls: Option<Vec<OpenAIToolCall>>,
}

#[derive(Debug, Deserialize)]
struct OpenAIToolCall {
    id: String,
    #[serde(rename = "type")]
    call_type: String,
    function: OpenAIFunction,
}

#[derive(Debug, Deserialize)]
struct OpenAIFunction {
    name: String,
    arguments: String, // JSON string
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

/// Anthropic tool definition
#[derive(Debug, Serialize)]
struct AnthropicTool {
    name: String,
    description: String,
    input_schema: serde_json::Value,
}

/// Anthropic Messages API request
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<AnthropicTool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

/// Anthropic Messages API response
#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
    #[allow(dead_code)]
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContent {
    #[serde(rename = "type")]
    content_type: String,
    #[serde(default)]
    text: String,
    // Tool use fields (for type == "tool_use")
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    input: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

/// LLM Client for making API calls
pub struct LLMClient {
    config: ProviderConfig,
    client: reqwest::Client,
}

impl LLMClient {
    /// Create a new LLM client
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            config,
            client: reqwest::Client::new(),
        }
    }

    /// Call LLM API with messages and return the response content
    pub async fn chat(&self, messages: Vec<LLMMessage>, system_prompt: Option<&str>) -> Result<String, String> {
        let response = self.chat_with_tools(messages, system_prompt, &[]).await?;
        Ok(response.content)
    }

    fn parse_usage_value(value: &serde_json::Value) -> Option<UsageInfo> {
        let prompt_tokens = value.get("prompt_tokens").and_then(|v| v.as_u64());
        let completion_tokens = value.get("completion_tokens").and_then(|v| v.as_u64());
        let total_tokens = value.get("total_tokens").and_then(|v| v.as_u64());

        if let (Some(prompt), Some(completion)) = (prompt_tokens, completion_tokens) {
            return Some(UsageInfo {
                prompt_tokens: prompt as u32,
                completion_tokens: completion as u32,
                total_tokens: total_tokens.unwrap_or(prompt + completion) as u32,
            });
        }

        let input_tokens = value.get("input_tokens").and_then(|v| v.as_u64());
        let output_tokens = value.get("output_tokens").and_then(|v| v.as_u64());
        let total_tokens = value.get("total_tokens").and_then(|v| v.as_u64());

        if let (Some(prompt), Some(completion)) = (input_tokens, output_tokens) {
            return Some(UsageInfo {
                prompt_tokens: prompt as u32,
                completion_tokens: completion as u32,
                total_tokens: total_tokens.unwrap_or(prompt + completion) as u32,
            });
        }

        None
    }
    
    /// Call LLM API with messages and return response with tool calls
    pub async fn chat_with_tools(&self, messages: Vec<LLMMessage>, system_prompt: Option<&str>, tools: &[ToolDefinition]) -> Result<LLMResponse, String> {
        let provider = self.config.provider.as_str();
        let model = self.config.model.as_str();

        if provider == "kilo" {
            return Err("Kilo provider is temporarily disabled".to_string());
        }
        
        // OpenCode Zen: minimax-m2.1-free 使用 Anthropic 格式
        if provider == "opencode" && model == "minimax-m2.1-free" {
            return self.chat_anthropic(messages, system_prompt, tools).await;
        }
        
        match provider {
            "anthropic" => self.chat_anthropic(messages, system_prompt, tools).await,
            "openai" | "openrouter" | "deepseek" | "glm" | "kimi" | "custom" | "opencode" => {
                self.chat_openai_compatible(messages, system_prompt, tools).await
            }
            "google" => {
                // Google API is more complex, use OpenAI-compatible for now
                // TODO: Implement proper Google API support
                self.chat_openai_compatible(messages, system_prompt, tools).await
            }
            _ => {
                // Default to OpenAI-compatible
                self.chat_openai_compatible(messages, system_prompt, tools).await
            }
        }
    }

    /// Call Anthropic Messages API with tools
    async fn chat_anthropic(&self, messages: Vec<LLMMessage>, system_prompt: Option<&str>, tools: &[ToolDefinition]) -> Result<LLMResponse, String> {
        // OpenCode Zen 免费模型使用默认 base URL
        let base_url = if self.config.provider == "opencode" {
            self.config.base_url.as_deref()
                .unwrap_or("https://opencode.ai/zen/v1")
        } else {
            self.config.base_url.as_deref()
                .unwrap_or("https://api.anthropic.com/v1")
        };
        
        // OpenCode Zen 免费模型强制使用 "public" 作为 API key
        let api_key = if self.config.provider == "opencode" {
            // 对于 OpenCode Zen 免费模型，无论前端传递什么，都强制使用 "public"
            let original_key = self.config.api_key.as_deref();
            log::info!("[LLMClient] OpenCode Zen - original api_key: {:?}, is_empty: {}", 
                original_key.map(|k| if k.is_empty() { "<empty>" } else { "***" }),
                original_key.map(|k| k.is_empty()).unwrap_or(true));
            
            // 强制使用 "public" 作为 API key（OpenCode Zen 免费模型的要求）
            let final_key = "public";
            log::info!("[LLMClient] OpenCode Zen detected - forcing api_key to: public (free)");
            final_key
        } else {
            self.config.api_key.as_deref()
                .ok_or_else(|| "Anthropic API key is required".to_string())?
        };
        
        log::info!("[LLMClient] Calling Anthropic API - provider: {}, base_url: {}, model: {}, api_key_set: {}", 
            self.config.provider, base_url, self.config.model, !api_key.is_empty());

        // Convert messages to Anthropic format
        let mut anthropic_messages = Vec::new();
        for msg in messages {
            // Skip system messages, they go in a separate field
            if msg.role == "system" {
                continue;
            }
            anthropic_messages.push(AnthropicMessage {
                role: if msg.role == "assistant" { "assistant".to_string() } else { "user".to_string() },
                content: msg.content,
            });
        }

        // Convert tools to Anthropic format
        let anthropic_tools: Vec<AnthropicTool> = tools.iter().map(|tool| {
            AnthropicTool {
                name: tool.name.clone(),
                description: tool.description.clone(),
                input_schema: tool.parameters.clone(),
            }
        }).collect();
        
        let request = AnthropicRequest {
            model: self.config.model.clone(),
            messages: anthropic_messages,
            max_tokens: Some(4096),
            temperature: Some(0.7),
            system: system_prompt.map(|s| s.to_string()),
            tools: anthropic_tools,
            stream: None, // Non-streaming request
        };

        let url = format!("{}/messages", base_url);
        
        let response = self.client
            .post(&url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send Anthropic request: {}", e))?;

        let status = response.status();
        let status_code = status.as_u16();
        
        // For OpenCode Zen, log response status and headers
        if self.config.provider == "opencode" {
            log::info!("[LLMClient] OpenCode Zen response status: {}", status_code);
            if let Some(content_type) = response.headers().get("content-type") {
                log::info!("[LLMClient] OpenCode Zen response content-type: {:?}", content_type);
            }
        }
        
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            if self.config.provider == "opencode" {
                log::error!("[LLMClient] OpenCode Zen API error ({}): {}", status_code, error_text);
            }
            return Err(format!("Anthropic API error: {} - {}", status, error_text));
        }

        // Read response body - ALWAYS log for OpenCode Zen before parsing
        let response_text = response.text().await
            .map_err(|e| {
                let err_msg = format!("Failed to read response body: {}", e);
                if self.config.provider == "opencode" {
                    log::error!("[LLMClient] OpenCode Zen - {}", err_msg);
                }
                err_msg
            })?;
        
        // Only log response length for OpenCode Zen (raw content removed for cleaner logs)
        if self.config.provider == "opencode" {
            log::info!("[LLMClient] OpenCode Zen response received ({} chars)", response_text.len());
        }
        
        // Try to parse response
        let anthropic_response: AnthropicResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                let err_msg = format!("Failed to parse Anthropic response: {}", e);
                if self.config.provider == "opencode" {
                    log::error!("[LLMClient] OpenCode Zen parse error: {}", e);
                    log::error!("[LLMClient] OpenCode Zen response that failed to parse (first 2000 chars): {}", 
                        response_text.chars().take(2000).collect::<String>());
                }
                err_msg
            })?;
        
        // Extract text and tool calls from content
        let mut text_parts = Vec::new();
        let mut tool_calls = Vec::new();
        
        for content_block in anthropic_response.content {
            match content_block.content_type.as_str() {
                "text" => {
                    if !content_block.text.is_empty() {
                        text_parts.push(content_block.text);
                    }
                }
                "tool_use" => {
                    if let (Some(id), Some(name), Some(input)) = (content_block.id, content_block.name, content_block.input) {
                        let id_clone = id.clone();
                        let name_clone = name.clone();
                        tool_calls.push(ToolCallInfo {
                            id,
                            name,
                            input,
                        });
                        log::info!("[LLMClient] Found tool_use block: {} with id: {}", name_clone, id_clone);
                    }
                }
                _ => {
                    // Ignore other types like "thinking"
                    log::debug!("[LLMClient] Ignoring content block type: {}", content_block.content_type);
                }
            }
        }
        
        let content = text_parts.join("\n");
        log::info!("[LLMClient] Extracted {} tool call(s) from Anthropic response", tool_calls.len());

        let usage = anthropic_response.usage.map(|u| UsageInfo {
            prompt_tokens: u.input_tokens,
            completion_tokens: u.output_tokens,
            total_tokens: u.input_tokens + u.output_tokens,
        });

        Ok(LLMResponse {
            content,
            tool_calls,
            usage,
        })
    }

    /// Call OpenAI-compatible API with tools
    async fn chat_openai_compatible(&self, messages: Vec<LLMMessage>, system_prompt: Option<&str>, tools: &[ToolDefinition]) -> Result<LLMResponse, String> {
        // OpenCode Zen 免费模型使用默认 base URL
        let base_url = if self.config.provider == "opencode" {
            self.config.base_url.as_deref()
                .unwrap_or("https://opencode.ai/zen/v1")
        } else if self.config.provider == "openrouter" || self.config.provider == "kilo" {
            self.config.base_url.as_deref()
                .unwrap_or("https://api.kilo.ai/api/openrouter")
        } else {
            self.config.base_url.as_deref()
                .unwrap_or("https://api.openai.com/v1")
        };
        
        // OpenCode Zen 免费模型强制使用 "public" 作为 API key
        let api_key = if self.config.provider == "opencode" {
            "public"
        } else if self.config.provider == "kilo" {
            self.config.api_key.as_deref().unwrap_or("not-provided")
        } else {
            self.config.api_key.as_deref()
                .ok_or_else(|| "API key is required".to_string())?
        };
        
        log::info!("[LLMClient] Calling OpenAI-compatible API - provider: {}, base_url: {}, model: {}, api_key_set: {}", 
            self.config.provider, base_url, self.config.model, !api_key.is_empty());

        // Build messages, inserting system prompt if provided
        let mut chat_messages = Vec::new();
        
        if let Some(system) = system_prompt {
            chat_messages.push(LLMMessage {
                role: "system".to_string(),
                content: system.to_string(),
            });
        }

        // Add existing messages, filtering out system messages (already added above)
        for msg in messages {
            if msg.role != "system" || system_prompt.is_none() {
                chat_messages.push(msg);
            }
        }

        // Convert tools to OpenAI format
        let openai_tools: Vec<OpenAITool> = tools.iter().map(|tool| {
            OpenAITool {
                tool_type: "function".to_string(),
                function: OpenAIToolFunction {
                    name: tool.name.clone(),
                    description: tool.description.clone(),
                    parameters: tool.parameters.clone(),
                },
            }
        }).collect();
        
        let provider_params = if self.config.provider == "openrouter" || self.config.provider == "kilo" {
            Some(OpenRouterProviderParams {
                data_collection: Some("allow".to_string()),
            })
        } else {
            None
        };

        let request = ChatRequest {
            model: self.config.model.clone(),
            messages: chat_messages,
            temperature: Some(0.7),
            max_tokens: Some(4096),
            tools: openai_tools,
            stream: None, // Non-streaming request
            stream_options: None,
            provider: provider_params,
        };

        let url = format!("{}/chat/completions", base_url);
        
        let mut rb = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json");

        // Apply Kilo AI disguise headers if needed
        if self.config.provider == "kilo" {
            let version = "4.151.0";
            rb = rb.header("HTTP-Referer", "https://kilocode.ai")
                  .header("X-Title", "Kilo Code")
                  .header("X-KiloCode-Version", version)
                  .header("X-KiloCode-EditorName", "vscode")
                  .header("X-KiloCode-EditorVersion", "1.96.2")
                  .header("X-KILOCODE-TESTER", "SUPPRESS")
                  .header("X-Kilocode-Language", "en")
                  .header("User-Agent", format!("Kilo-Code/{}", version))
                  .header("Origin", "vscode-webview://kilocode")
                  .header("x-api-key", api_key)
                  .header("Sec-Fetch-Mode", "cors")
                  .header("Sec-Fetch-Site", "cross-site");

            let message_roles: Vec<&str> = request.messages.iter().map(|m| m.role.as_str()).collect();
            let header_log = vec![
                ("HTTP-Referer", "https://kilocode.ai".to_string()),
                ("X-Title", "Kilo Code".to_string()),
                ("X-KiloCode-Version", version.to_string()),
                ("X-KiloCode-EditorName", "vscode".to_string()),
                ("X-KiloCode-EditorVersion", "1.96.2".to_string()),
                ("X-KILOCODE-TESTER", "SUPPRESS".to_string()),
                ("X-Kilocode-Language", "en".to_string()),
                ("User-Agent", format!("Kilo-Code/{}", version)),
                ("Origin", "vscode-webview://kilocode".to_string()),
                ("Sec-Fetch-Mode", "cors".to_string()),
                ("Sec-Fetch-Site", "cross-site".to_string()),
                ("Authorization", "Bearer <redacted>".to_string()),
                ("x-api-key", "<redacted>".to_string()),
            ];
            log::info!(
                "[LLMClient] Kilo request: url={}, model={}, messages={}, roles={:?}, tools={}, stream=false, api_key_present={}",
                url,
                request.model,
                request.messages.len(),
                message_roles,
                request.tools.len(),
                !api_key.is_empty()
            );
            log::info!("[LLMClient] Kilo request headers: {:?}", header_log);
        }
        
        let response = rb.json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send OpenAI request: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            if self.config.provider == "kilo" {
                let snippet = error_text.chars().take(500).collect::<String>();
                log::warn!("[LLMClient] Kilo response error: status={}, body_snippet={}", status, snippet);
            }
            return Err(format!("OpenAI API error: {} - {}", status, error_text));
        }

        let chat_response: ChatResponse = response.json().await
            .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;
        
        let choice = chat_response
            .choices
            .first()
            .ok_or_else(|| "No choices in response".to_string())?;
        
        let content = choice.message.content.clone();
        
        // Parse tool calls from OpenAI format
        let mut tool_calls = Vec::new();
        if let Some(openai_tool_calls) = &choice.message.tool_calls {
            for tc in openai_tool_calls {
                if tc.call_type == "function" {
                    let args: serde_json::Value = serde_json::from_str(&tc.function.arguments)
                        .unwrap_or_else(|_| serde_json::json!({}));
                    tool_calls.push(ToolCallInfo {
                        id: tc.id.clone(),
                        name: tc.function.name.clone(),
                        input: args,
                    });
                    log::info!("[LLMClient] Found OpenAI tool call: {} with id: {}", tc.function.name, tc.id);
                }
            }
        }
        
        log::info!("[LLMClient] Extracted {} tool call(s) from OpenAI response", tool_calls.len());

        let usage = chat_response.usage.map(|u| UsageInfo {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        Ok(LLMResponse {
            content,
            tool_calls,
            usage,
        })
    }

    /// Call LLM API with streaming support
    /// Returns a stream of content chunks and tool calls
    pub async fn chat_with_tools_stream<F>(
        &self,
        messages: Vec<LLMMessage>,
        system_prompt: Option<&str>,
        tools: &[ToolDefinition],
        on_chunk: F,
    ) -> Result<LLMResponse, String>
    where
        F: FnMut(&str) -> Result<(), String>,
    {
        let provider = self.config.provider.as_str();
        let model = self.config.model.as_str();

        if provider == "kilo" {
            return Err("Kilo provider is temporarily disabled".to_string());
        }
        
        // OpenCode Zen: minimax-m2.1-free 使用 Anthropic 格式
        if provider == "opencode" && model == "minimax-m2.1-free" {
            return self.chat_anthropic_stream(messages, system_prompt, tools, on_chunk).await;
        }
        
        match provider {
            "anthropic" => self.chat_anthropic_stream(messages, system_prompt, tools, on_chunk).await,
            "openai" | "deepseek" | "glm" | "kimi" | "custom" | "opencode" => {
                self.chat_openai_compatible_stream(messages, system_prompt, tools, on_chunk).await
            }
            "google" => {
                // Google API is more complex, use OpenAI-compatible for now
                self.chat_openai_compatible_stream(messages, system_prompt, tools, on_chunk).await
            }
            _ => {
                // Default to OpenAI-compatible
                self.chat_openai_compatible_stream(messages, system_prompt, tools, on_chunk).await
            }
        }
    }

    /// Call Anthropic Messages API with streaming
    async fn chat_anthropic_stream<F>(
        &self,
        messages: Vec<LLMMessage>,
        system_prompt: Option<&str>,
        tools: &[ToolDefinition],
        mut on_chunk: F,
    ) -> Result<LLMResponse, String>
    where
        F: FnMut(&str) -> Result<(), String>,
    {
        // OpenCode Zen 免费模型使用默认 base URL
        let base_url = if self.config.provider == "opencode" {
            self.config.base_url.as_deref()
                .unwrap_or("https://opencode.ai/zen/v1")
        } else {
            self.config.base_url.as_deref()
                .unwrap_or("https://api.anthropic.com/v1")
        };
        
        // OpenCode Zen 免费模型强制使用 "public" 作为 API key
        let api_key = if self.config.provider == "opencode" {
            "public"
        } else {
            self.config.api_key.as_deref()
                .ok_or_else(|| "Anthropic API key is required".to_string())?
        };
        
        // Convert messages to Anthropic format
        let mut anthropic_messages = Vec::new();
        for msg in messages {
            if msg.role == "system" {
                continue;
            }
            anthropic_messages.push(AnthropicMessage {
                role: if msg.role == "assistant" { "assistant".to_string() } else { "user".to_string() },
                content: msg.content,
            });
        }

        // Convert tools to Anthropic format
        let anthropic_tools: Vec<AnthropicTool> = tools.iter().map(|tool| {
            AnthropicTool {
                name: tool.name.clone(),
                description: tool.description.clone(),
                input_schema: tool.parameters.clone(),
            }
        }).collect();
        
        let request = AnthropicRequest {
            model: self.config.model.clone(),
            messages: anthropic_messages,
            max_tokens: Some(4096),
            temperature: Some(0.7),
            system: system_prompt.map(|s| s.to_string()),
            tools: anthropic_tools,
            stream: Some(true), // Enable streaming
        };

        let url = format!("{}/messages", base_url);
        
        let response = self.client
            .post(&url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .header("anthropic-beta", "messages-2023-12-15") // Required for streaming
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send Anthropic request: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Anthropic API error: {} - {}", status, error_text));
        }

        // Parse SSE stream
        let mut stream = response.bytes_stream();
        let mut content = String::new();
        let mut tool_calls = Vec::new();
        let mut usage: Option<UsageInfo> = None;
        // Track current tool call: (id, name, accumulated_json_string)
        let mut current_tool_call: Option<(String, String, String)> = None;
        // Buffer for incomplete SSE data across chunks
        let mut sse_buffer = String::new();
        
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Failed to read stream chunk: {}", e))?;
            let chunk_str = String::from_utf8_lossy(&chunk);
            
            // Append to buffer
            sse_buffer.push_str(&chunk_str);
            
            // Process complete SSE events (terminated by \n\n or \r\n\r\n)
            while let Some(event_end) = sse_buffer.find("\n\n").or_else(|| sse_buffer.find("\r\n\r\n")) {
                let delimiter_len = if sse_buffer[event_end..].starts_with("\r\n\r\n") { 4 } else { 2 };
                let event_data = sse_buffer[..event_end].to_string();
                sse_buffer = sse_buffer[event_end + delimiter_len..].to_string();
                
                // Parse SSE format: "data: {...}"
                for line in event_data.lines() {
                    if line.starts_with("data: ") {
                        let json_str = &line[6..]; // Skip "data: "
                        
                        if json_str == "[DONE]" {
                            break;
                        }
                        
                        match serde_json::from_str::<serde_json::Value>(json_str) {
                            Ok(event) => {
                                if usage.is_none() {
                                    let usage_value = event.get("usage")
                                        .or_else(|| event.get("message").and_then(|m| m.get("usage")));
                                    if let Some(value) = usage_value {
                                        usage = Self::parse_usage_value(value);
                                    }
                                }
                                // Handle different event types
                                if let Some(event_type) = event.get("type").and_then(|t| t.as_str()) {
                                    match event_type {
                                        "content_block_start" => {
                                            if let Some(content_block) = event.get("content_block") {
                                                log::info!("[LLMClient] Anthropic content_block_start: {}", 
                                                    serde_json::to_string(content_block).unwrap_or_default());
                                                if let Some(block_type) = content_block.get("type").and_then(|t| t.as_str()) {
                                                    if block_type == "tool_use" {
                                                        if let (Some(id), Some(name)) = (
                                                            content_block.get("id").and_then(|i| i.as_str()),
                                                            content_block.get("name").and_then(|n| n.as_str()),
                                                        ) {
                                                            log::info!("[LLMClient] Starting tool_use block: id={}, name={}", id, name);
                                                            current_tool_call = Some((
                                                                id.to_string(),
                                                                name.to_string(),
                                                                String::new(), // Start with empty string for JSON accumulation
                                                            ));
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        "content_block_delta" => {
                                            if let Some(delta) = event.get("delta") {
                                                // Text content delta
                                                if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                                    content.push_str(text);
                                                    on_chunk(text)?;
                                                }
                                                
                                                // Tool use input delta - Anthropic sends partial_json
                                                if let Some(partial_json) = delta.get("partial_json").and_then(|p| p.as_str()) {
                                                    if let Some((_id, _name, ref mut json_str)) = current_tool_call.as_mut() {
                                                        json_str.push_str(partial_json);
                                                        log::debug!("[LLMClient] Accumulated partial_json for tool, total len: {}", json_str.len());
                                                    }
                                                }
                                                
                                                // Some providers might send 'input' field directly
                                                if let Some(input) = delta.get("input") {
                                                    log::info!("[LLMClient] Received 'input' in delta: {}", 
                                                        serde_json::to_string(input).unwrap_or_default());
                                                    if let Some((_id, _name, ref mut json_str)) = current_tool_call.as_mut() {
                                                        // If input is a string, accumulate it
                                                        if let Some(input_str) = input.as_str() {
                                                            json_str.push_str(input_str);
                                                        }
                                                        // If input is an object, serialize it
                                                        else if input.is_object() {
                                                            *json_str = serde_json::to_string(input).unwrap_or_default();
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        "content_block_stop" => {
                                            if let Some((id, name, json_str)) = current_tool_call.take() {
                                                log::info!("[LLMClient] content_block_stop for tool '{}', accumulated JSON ({} chars): {}", 
                                                    name, json_str.len(), json_str.chars().take(200).collect::<String>());
                                                
                                                // Parse the accumulated JSON string
                                                let input = if json_str.is_empty() {
                                                    log::warn!("[LLMClient] Tool '{}' has empty JSON string", name);
                                                    serde_json::json!({})
                                                } else {
                                                    match serde_json::from_str::<serde_json::Value>(&json_str) {
                                                        Ok(parsed) => {
                                                            log::info!("[LLMClient] Successfully parsed tool '{}' input: {:?}", name, parsed);
                                                            parsed
                                                        }
                                                        Err(e) => {
                                                            log::warn!("[LLMClient] Failed to parse tool '{}' JSON: {}. Raw: {}", 
                                                                name, e, json_str.chars().take(200).collect::<String>());
                                                            serde_json::json!({})
                                                        }
                                                    }
                                                };
                                                
                                                tool_calls.push(ToolCallInfo {
                                                    id,
                                                    name,
                                                    input,
                                                });
                                            }
                                        }
                                        _ => {}
                                    }
                                }
                            }
                            Err(e) => {
                                log::warn!("[LLMClient] Failed to parse SSE event: {} - {}", e, json_str);
                            }
                        }
                    }
                }
            } // end of while let Some(event_end) - process complete SSE events
        } // end of while let Some(chunk_result) - read stream chunks
        
        log::info!("[LLMClient] Anthropic stream completed: {} tool call(s)", tool_calls.len());
        for tc in &tool_calls {
            log::info!("[LLMClient] Tool call '{}' final input: {:?}", tc.name, tc.input);
        }

        Ok(LLMResponse {
            content,
            tool_calls,
            usage,
        })
    }

    /// Call OpenAI-compatible API with streaming
    async fn chat_openai_compatible_stream<F>(
        &self,
        messages: Vec<LLMMessage>,
        system_prompt: Option<&str>,
        tools: &[ToolDefinition],
        mut on_chunk: F,
    ) -> Result<LLMResponse, String>
    where
        F: FnMut(&str) -> Result<(), String>,
    {
        // This function handles streaming tool call arguments parsing
        // OpenCode Zen 免费模型使用默认 base URL
        let base_url = if self.config.provider == "opencode" {
            self.config.base_url.as_deref()
                .unwrap_or("https://opencode.ai/zen/v1")
        } else if self.config.provider == "openrouter" || self.config.provider == "kilo" {
            self.config.base_url.as_deref()
                .unwrap_or("https://api.kilo.ai/api/openrouter")
        } else {
            self.config.base_url.as_deref()
                .unwrap_or("https://api.openai.com/v1")
        };
        
        // OpenCode Zen 免费模型强制使用 "public" 作为 API key
        let api_key = if self.config.provider == "opencode" {
            "public"
        } else if self.config.provider == "kilo" {
            self.config.api_key.as_deref().unwrap_or("not-provided")
        } else {
            self.config.api_key.as_deref()
                .ok_or_else(|| "API key is required".to_string())?
        };
        
        // Build messages
        let mut chat_messages = Vec::new();
        if let Some(system) = system_prompt {
            chat_messages.push(LLMMessage {
                role: "system".to_string(),
                content: system.to_string(),
            });
        }
        for msg in messages {
            if msg.role != "system" || system_prompt.is_none() {
                chat_messages.push(msg);
            }
        }

        // Convert tools to OpenAI format
        let openai_tools: Vec<OpenAITool> = tools.iter().map(|tool| {
            OpenAITool {
                tool_type: "function".to_string(),
                function: OpenAIToolFunction {
                    name: tool.name.clone(),
                    description: tool.description.clone(),
                    parameters: tool.parameters.clone(),
                },
            }
        }).collect();
        
        let provider_params = if self.config.provider == "openrouter" || self.config.provider == "kilo" {
            Some(OpenRouterProviderParams {
                data_collection: Some("allow".to_string()),
            })
        } else {
            None
        };

        let request = ChatRequest {
            model: self.config.model.clone(),
            messages: chat_messages,
            temperature: Some(0.7),
            max_tokens: Some(4096),
            tools: openai_tools,
            stream: Some(true), // Enable streaming
            stream_options: Some(StreamOptions { include_usage: true }),
            provider: provider_params,
        };

        let url = format!("{}/chat/completions", base_url);
        
        let mut rb = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json");

        // Apply Kilo AI disguise headers if needed
        if self.config.provider == "kilo" {
            let version = "4.151.0";
            rb = rb.header("HTTP-Referer", "https://kilocode.ai")
                  .header("X-Title", "Kilo Code")
                  .header("X-KiloCode-Version", version)
                  .header("X-KiloCode-EditorName", "vscode")
                  .header("X-KiloCode-EditorVersion", "1.96.2")
                  .header("X-KILOCODE-TESTER", "SUPPRESS")
                  .header("X-Kilocode-Language", "en")
                  .header("User-Agent", format!("Kilo-Code/{}", version))
                  .header("Origin", "vscode-webview://kilocode")
                  .header("x-api-key", api_key)
                  .header("Sec-Fetch-Mode", "cors")
                  .header("Sec-Fetch-Site", "cross-site");

            let message_roles: Vec<&str> = request.messages.iter().map(|m| m.role.as_str()).collect();
            let header_log = vec![
                ("HTTP-Referer", "https://kilocode.ai".to_string()),
                ("X-Title", "Kilo Code".to_string()),
                ("X-KiloCode-Version", version.to_string()),
                ("X-KiloCode-EditorName", "vscode".to_string()),
                ("X-KiloCode-EditorVersion", "1.96.2".to_string()),
                ("X-KILOCODE-TESTER", "SUPPRESS".to_string()),
                ("X-Kilocode-Language", "en".to_string()),
                ("User-Agent", format!("Kilo-Code/{}", version)),
                ("Origin", "vscode-webview://kilocode".to_string()),
                ("Sec-Fetch-Mode", "cors".to_string()),
                ("Sec-Fetch-Site", "cross-site".to_string()),
                ("Authorization", "Bearer <redacted>".to_string()),
                ("x-api-key", "<redacted>".to_string()),
            ];
            log::info!(
                "[LLMClient] Kilo request: url={}, model={}, messages={}, roles={:?}, tools={}, stream=true, api_key_present={}",
                url,
                request.model,
                request.messages.len(),
                message_roles,
                request.tools.len(),
                !api_key.is_empty()
            );
            log::info!("[LLMClient] Kilo request headers: {:?}", header_log);
        }
        
        let response = rb.json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send OpenAI request: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            if self.config.provider == "kilo" {
                let snippet = error_text.chars().take(500).collect::<String>();
                log::warn!("[LLMClient] Kilo response error: status={}, body_snippet={}", status, snippet);
            }
            return Err(format!("OpenAI API error: {} - {}", status, error_text));
        }

        // Parse SSE stream
        let mut stream = response.bytes_stream();
        let mut content = String::new();
        let mut tool_calls: Vec<ToolCallInfo> = Vec::new();
        let mut tool_call_args: Vec<String> = Vec::new(); // Accumulate tool call arguments
        let mut usage: Option<UsageInfo> = None;
        
        use futures::StreamExt;
        
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Failed to read stream chunk: {}", e))?;
            let chunk_str = String::from_utf8_lossy(&chunk);
            
            // Parse SSE format: "data: {...}\n\n"
            for line in chunk_str.lines() {
                if line.starts_with("data: ") {
                    let json_str = &line[6..]; // Skip "data: "
                    
                    if json_str == "[DONE]" {
                        // Before breaking, try to parse any remaining tool call arguments
                        // This ensures arguments are parsed even if finish_reason wasn't set
                        for (i, args_str) in tool_call_args.iter().enumerate() {
                            if i < tool_calls.len() && tool_calls[i].input == serde_json::json!({}) && !args_str.is_empty() {
                                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(args_str) {
                                    if parsed.is_object() && !parsed.as_object().unwrap().is_empty() {
                                        tool_calls[i].input = parsed;
                                        log::info!("[LLMClient] Parsed arguments for '{}' on [DONE]: {:?}", 
                                            tool_calls[i].name, tool_calls[i].input);
                                    }
                                }
                            }
                        }
                        break;
                    }
                    
                    match serde_json::from_str::<serde_json::Value>(json_str) {
                        Ok(event) => {
                            if let Some(usage_value) = event.get("usage") {
                                if usage.is_none() {
                                    usage = Self::parse_usage_value(usage_value);
                                }
                            }
                            if let Some(choices) = event.get("choices").and_then(|c| c.as_array()) {
                                if let Some(choice) = choices.first() {
                                    if let Some(delta) = choice.get("delta") {
                                        // Text content
                                        if let Some(text) = delta.get("content").and_then(|c| c.as_str()) {
                                            content.push_str(text);
                                            on_chunk(text)?;
                                        }
                                        
                                        // Tool calls
                                        if let Some(tool_calls_delta) = delta.get("tool_calls").and_then(|tc| tc.as_array()) {
                                            log::info!("[LLMClient] Received tool_calls delta: {}", serde_json::to_string(tool_calls_delta).unwrap_or_default());
                                            for tc_delta in tool_calls_delta {
                                                log::debug!("[LLMClient] Processing tc_delta: {}", serde_json::to_string(tc_delta).unwrap_or_default());
                                                if let Some(index) = tc_delta.get("index").and_then(|i| i.as_u64()) {
                                                    let index = index as usize;
                                                    
                                                    // Ensure tool_calls vector is large enough
                                                    while tool_calls.len() <= index {
                                                        tool_calls.push(ToolCallInfo {
                                                            id: String::new(),
                                                            name: String::new(),
                                                            input: serde_json::json!({}),
                                                        });
                                                        tool_call_args.push(String::new());
                                                    }
                                                    
                                                    if let Some(id) = tc_delta.get("id").and_then(|i| i.as_str()) {
                                                        if tool_calls[index].id.is_empty() {
                                                            tool_calls[index].id = id.to_string();
                                                        }
                                                    }
                                                    
                                                    if let Some(function) = tc_delta.get("function") {
                                                        if let Some(name) = function.get("name").and_then(|n| n.as_str()) {
                                                            if tool_calls[index].name.is_empty() {
                                                                tool_calls[index].name = name.to_string();
                                                            }
                                                        }
                                                        
                                                        // Log raw function data for debugging
                                                        log::info!("[LLMClient] Raw function data for tool '{}' (index {}): {}", 
                                                            tool_calls[index].name, index, 
                                                            serde_json::to_string(function).unwrap_or_default());
                                                        
                                                        // Try to get arguments as string (streaming format)
                                                        if let Some(args_delta) = function.get("arguments").and_then(|a| a.as_str()) {
                                                            // Accumulate arguments as string
                                                            tool_call_args[index].push_str(args_delta);
                                                            log::info!("[LLMClient] Accumulated args for tool '{}' (index {}): '{}' (total length: {})", 
                                                                tool_calls[index].name, index, 
                                                                args_delta.chars().take(100).collect::<String>(),
                                                                tool_call_args[index].len());
                                                        } 
                                                        // Also try to get arguments as object (some providers send complete object)
                                                        else if let Some(args_obj) = function.get("arguments").and_then(|a| a.as_object()) {
                                                            // If arguments is already an object, use it directly
                                                            if !args_obj.is_empty() {
                                                                tool_calls[index].input = serde_json::json!(args_obj);
                                                                log::info!("[LLMClient] Got complete arguments object for '{}' (index {}): {:?}", 
                                                                    tool_calls[index].name, index, tool_calls[index].input);
                                                            }
                                                        }
                                                        // Check if arguments is null or missing
                                                        else if let Some(args_value) = function.get("arguments") {
                                                            log::warn!("[LLMClient] Unexpected arguments type for '{}' (index {}): type={:?}, value={}", 
                                                                tool_calls[index].name, index, 
                                                                if args_value.is_null() { "null" } 
                                                                else if args_value.is_array() { "array" }
                                                                else if args_value.is_boolean() { "boolean" }
                                                                else if args_value.is_number() { "number" }
                                                                else { "unknown" },
                                                                serde_json::to_string(args_value).unwrap_or_default());
                                                        }
                                                        else {
                                                            log::debug!("[LLMClient] No arguments field in function for tool '{}' (index {})", 
                                                                tool_calls[index].name, index);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    
                                    // Check if finished - parse accumulated tool call arguments
                                    if let Some(finish_reason) = choice.get("finish_reason").and_then(|fr| fr.as_str()) {
                                        if finish_reason == "tool_calls" || finish_reason == "stop" {
                                            // Parse accumulated tool call arguments
                                            for (i, args_str) in tool_call_args.iter().enumerate() {
                                                if i < tool_calls.len() {
                                                    if args_str.is_empty() {
                                                        log::warn!("[LLMClient] Tool call '{}' (index {}) finished with empty argument string", 
                                                            tool_calls[i].name, i);
                                                    } else {
                                                        match serde_json::from_str::<serde_json::Value>(args_str) {
                                                            Ok(parsed) => {
                                                                if parsed.is_object() && !parsed.as_object().unwrap().is_empty() {
                                                                    tool_calls[i].input = parsed;
                                                                    log::info!("[LLMClient] Parsed arguments for '{}' on finish: {:?}", 
                                                                        tool_calls[i].name, tool_calls[i].input);
                                                                } else {
                                                                    log::warn!("[LLMClient] Tool call '{}' (index {}) parsed to empty object. Raw: {}", 
                                                                        tool_calls[i].name, i, args_str.chars().take(200).collect::<String>());
                                                                }
                                                            }
                                                            Err(e) => {
                                                                log::warn!("[LLMClient] Failed to parse arguments for '{}' (index {}) on finish: {}. Raw: {}", 
                                                                    tool_calls[i].name, i, e, args_str.chars().take(200).collect::<String>());
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            log::warn!("[LLMClient] Failed to parse SSE event: {} - {}", e, json_str);
                        }
                    }
                }
            }
        }
        
        // After stream ends, ensure all tool call arguments are parsed
        // This is critical because some providers may not set finish_reason properly
        // or the stream may end before finish_reason is received
        for (i, args_str) in tool_call_args.iter().enumerate() {
            if i < tool_calls.len() && tool_calls[i].input == serde_json::json!({}) && !args_str.is_empty() {
                match serde_json::from_str::<serde_json::Value>(args_str) {
                    Ok(parsed) => {
                        if parsed.is_object() && !parsed.as_object().unwrap().is_empty() {
                            tool_calls[i].input = parsed;
                            log::info!("[LLMClient] Parsed arguments for '{}' after stream end: {:?}", 
                                tool_calls[i].name, tool_calls[i].input);
                        } else {
                            log::warn!("[LLMClient] Tool call '{}' (index {}) parsed to empty object after stream end. Raw: {}", 
                                tool_calls[i].name, i, args_str.chars().take(200).collect::<String>());
                        }
                    }
                    Err(e) => {
                        log::warn!("[LLMClient] Failed to parse arguments for '{}' (index {}) after stream end: {}. Raw: {}", 
                            tool_calls[i].name, i, e, args_str.chars().take(200).collect::<String>());
                    }
                }
            }
        }
        
        // Final parse of tool call arguments if not already parsed
        for (i, args_str) in tool_call_args.iter().enumerate() {
            if i < tool_calls.len() {
                if tool_calls[i].input == serde_json::json!({}) {
                    if args_str.is_empty() {
                        log::warn!("[LLMClient] Tool call '{}' (index {}) has empty argument string", tool_calls[i].name, i);
                        // Keep empty object, will be validated later
                    } else {
                        match serde_json::from_str::<serde_json::Value>(args_str) {
                            Ok(parsed) => {
                                // Validate parsed arguments are not empty
                                if parsed.is_object() {
                                    let obj = parsed.as_object().unwrap();
                                    if obj.is_empty() {
                                        log::warn!("[LLMClient] Tool call '{}' (index {}) parsed to empty object. Raw args: {}", 
                                            tool_calls[i].name, i, args_str.chars().take(200).collect::<String>());
                                    } else {
                                        tool_calls[i].input = parsed;
                                        log::info!("[LLMClient] Successfully parsed arguments for '{}': {:?}", 
                                            tool_calls[i].name, tool_calls[i].input);
                                    }
                                } else {
                                    log::warn!("[LLMClient] Tool call '{}' (index {}) parsed to non-object. Raw args: {}", 
                                        tool_calls[i].name, i, args_str.chars().take(200).collect::<String>());
                                }
                            }
                            Err(e) => {
                                log::warn!("[LLMClient] Failed to parse tool call arguments for '{}' (index {}): {}. Raw args: {}", 
                                    tool_calls[i].name, i, e, args_str.chars().take(200).collect::<String>());
                                // Keep empty object, will be validated later
                            }
                        }
                    }
                } else {
                    log::info!("[LLMClient] Tool call '{}' (index {}) already has parsed arguments: {:?}", 
                        tool_calls[i].name, i, tool_calls[i].input);
                }
            }
        }
        
        // Validate tool calls - check for empty arguments
        for tool_call in &tool_calls {
            if tool_call.input.is_object() {
                let obj = tool_call.input.as_object().unwrap();
                if obj.is_empty() {
                    log::warn!("[LLMClient] Tool call '{}' has empty arguments after parsing", tool_call.name);
                }
            } else if tool_call.input.is_null() {
                log::warn!("[LLMClient] Tool call '{}' has null arguments", tool_call.name);
                // Convert null to empty object for consistency
            }
        }
        
        // Filter out empty tool calls (but keep those with empty args for error reporting)
        tool_calls.retain(|tc| !tc.id.is_empty() && !tc.name.is_empty());

        Ok(LLMResponse {
            content,
            tool_calls,
            usage,
        })
    }
}
