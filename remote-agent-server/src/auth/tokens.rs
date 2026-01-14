//! Session token management

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Session token structure
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SessionToken {
    pub token: String,
    pub created_at: u64,
    pub expires_at: u64,
}

/// Secret key for token signing (in production, use a proper secret management)
static TOKEN_SECRET: &str = "rebebuca-server-secret-key-change-in-production";

/// Create a new session token
pub fn create_session_token(expiry_hours: u64) -> SessionToken {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let expires_at = now + (expiry_hours * 3600);

    // Generate random UUID
    let random_part = Uuid::new_v4().to_string();

    // Create token payload
    let payload = format!("{}:{}:{}", random_part, now, expires_at);

    // Sign the payload
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    hasher.update(TOKEN_SECRET.as_bytes());
    let signature = hasher.finalize();

    // Combine payload and signature
    let token_data = format!("{}:{}", payload, URL_SAFE_NO_PAD.encode(signature));
    let token = URL_SAFE_NO_PAD.encode(token_data.as_bytes());

    SessionToken {
        token,
        created_at: now,
        expires_at,
    }
}

/// Validate a session token
pub fn validate_session_token(token: &str) -> Result<bool, String> {
    // Decode the token
    let token_bytes = URL_SAFE_NO_PAD
        .decode(token)
        .map_err(|_| "Invalid token encoding")?;
    let token_data = String::from_utf8(token_bytes).map_err(|_| "Invalid token data")?;

    // Parse token parts
    let parts: Vec<&str> = token_data.split(':').collect();
    if parts.len() != 4 {
        return Err("Invalid token format".to_string());
    }

    let random_part = parts[0];
    let created_at: u64 = parts[1].parse().map_err(|_| "Invalid timestamp")?;
    let expires_at: u64 = parts[2].parse().map_err(|_| "Invalid expiry")?;
    let provided_signature = parts[3];

    // Verify signature
    let payload = format!("{}:{}:{}", random_part, created_at, expires_at);
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    hasher.update(TOKEN_SECRET.as_bytes());
    let expected_signature = URL_SAFE_NO_PAD.encode(hasher.finalize());

    if provided_signature != expected_signature {
        return Err("Invalid signature".to_string());
    }

    // Check expiry
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    if now > expires_at {
        return Err("Token expired".to_string());
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_validate_token() {
        let token = create_session_token(24);
        assert!(validate_session_token(&token.token).is_ok());
    }

    #[test]
    fn test_invalid_token() {
        assert!(validate_session_token("invalid-token").is_err());
    }
}
