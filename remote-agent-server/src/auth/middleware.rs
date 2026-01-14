//! Authentication middleware for axum

#![allow(dead_code)]

use axum::{
    body::Body,
    extract::Request,
    http::{header::SET_COOKIE, StatusCode},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::cookie::{Cookie, SameSite};

use super::tokens::validate_session_token;

/// Parse cookies from request headers
fn parse_cookies(request: &Request) -> std::collections::HashMap<String, String> {
    let mut cookies = std::collections::HashMap::new();

    if let Some(cookie_header) = request.headers().get("cookie") {
        if let Ok(cookie_str) = cookie_header.to_str() {
            for cookie in cookie_str.split(';') {
                let parts: Vec<&str> = cookie.trim().splitn(2, '=').collect();
                if parts.len() == 2 {
                    cookies.insert(parts[0].to_string(), parts[1].to_string());
                }
            }
        }
    }

    cookies
}

/// Authentication middleware
/// Validates session token from cookies
pub async fn auth_middleware(request: Request, next: Next) -> Result<Response, StatusCode> {
    let cookies = parse_cookies(&request);

    let session_token = match cookies.get("session_token") {
        Some(token) => token.clone(),
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    match validate_session_token(&session_token) {
        Ok(true) => {
            // Token is valid, proceed
            let response = next.run(request).await;
            Ok(response)
        }
        Ok(false) | Err(_) => {
            // Token is invalid, clear cookie and return unauthorized
            let mut response = Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .body(Body::empty())
                .unwrap();

            // Clear the session cookie
            let clear_cookie = Cookie::build(("session_token", ""))
                .http_only(true)
                .secure(false)
                .same_site(SameSite::Strict)
                .path("/")
                .max_age(time::Duration::seconds(0))
                .build();

            response
                .headers_mut()
                .append(SET_COOKIE, clear_cookie.to_string().parse().unwrap());

            Ok(response)
        }
    }
}
