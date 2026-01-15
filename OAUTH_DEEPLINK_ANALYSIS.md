# Tauri Desktop App OAuth + Deep Linking Analysis
## Rebebuca Project - Desktop OAuth Flow Architecture

---

## EXECUTIVE SUMMARY

**Current State:** The project has a **foundation for OAuth flow but NO deep linking infrastructure** implemented. Auth currently uses browser redirects with `window.open()` and manual token storage (bearer tokens in localStorage).

**Best Fit Implementation:** Hybrid approach combining:
1. **localhost callback server** (cleanest, already has HTTP plugin)
2. **Token-based authentication** (already in place)
3. **Event-based window bridging** (Tauri provides this natively)

---

## WHAT EXISTS ALREADY

### 1. OAuth Backend Routes (Server-Side)
**Location:** `/Users/dexter/project/rebebuca/server/app/api/auth/tauri/`

#### GitHub OAuth for Tauri:
- **Initiate:** `server/app/api/auth/tauri/github/route.ts` (lines 1-33)
  - Returns JSON with OAuth URL and state (CSRF token)
  - Sets secure httpOnly cookie: `oauth_state` (10 min expiry)
  ```ts
  // Line 16-22: State generation & cookie
  const state = crypto.randomUUID();
  response.cookies.set('oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 10
  });
  ```

- **Callback:** `server/app/api/auth/tauri/github/callback/route.ts` (lines 1-217)
  - Exchanges code for GitHub token
  - Validates state (line 54-61)
  - Creates/updates user
  - **Returns JSON response with tokens** (lines 193-205):
    ```ts
    {
      success: true,
      user: { id, email, displayName, avatarUrl },
      tokens: {
        accessToken: jwtAccessToken,
        refreshToken: refreshToken
      }
    }
    ```

#### Google OAuth for Tauri:
- **Initiate:** `server/app/api/auth/tauri/google/route.ts` (lines 1-43)
- **Callback:** `server/app/api/auth/tauri/google/callback/route.ts` (lines 1-197)
- Same pattern as GitHub

### 2. Token-Based Authentication (Bearer Tokens)
**Location:** `/Users/dexter/project/rebebuca/src/services/authService.ts` (lines 1-285)

**Current implementation:**
```ts
// Line 108-110: Bearer token injection
if (this.accessToken) {
  (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
}

// Line 42: Auth server URL
const AUTH_SERVER_URL = import.meta.env.VITE_AUTH_SERVER_URL || 'http://localhost:3000';

// Lines 45-49: Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'rebebuca_access_token',
  REFRESH_TOKEN: 'rebebuca_refresh_token',
  USER: 'rebebuca_user',
};
```

**Token Management:**
- Stores tokens in localStorage (lines 60-95)
- Auto-refreshes tokens (lines 183-205)
- Validates and caches user data (lines 210-228)

### 3. Browser Opening Mechanism
**Location:** `/Users/dexter/project/rebebuca/src/adapters/tauri.ts` (lines 389-417)

**Current `openExternal()` implementation:**
```ts
// Lines 389-417: Multi-fallback approach
async openExternal(url: string): Promise<void> {
  // Priority 1: opener plugin (Tauri v2)
  if (opener.open || opener.openUrl)
  
  // Priority 2: shell plugin (Tauri v1 compat)
  if (tauriShell && tauriShell.open)
}
```

**Called from:**
- `/Users/dexter/project/rebebuca/src/services/authService.ts` line 272:
  ```ts
  openAuthPortal(path: string = '/login') {
    const url = `${AUTH_SERVER_URL}${path}`;
    window.open(url, '_blank');  // Currently uses window.open, not openExternal!
  }
  ```

### 4. HTTP Plugin Integration
**Location:** `/Users/dexter/project/rebebuca/src/utils/tauriFetch.ts` (lines 1-75)

- Uses `@tauri-apps/plugin-http` for network requests
- Tauri HTTP plugin can set custom headers (supports Bearer tokens)
- **No cookie jar setup** (plugin doesn't expose cookies at request level)

### 5. Tauri Configuration
**Location:** `/Users/dexter/project/rebebuca/src-tauri/tauri.conf.json` (lines 1-82)

**Current plugins:**
```json
"plugins": {
  "fs": { "requireLiteralLeadingDot": false },
  "shell": { "open": true },
  "tray-icon": { "all": true },
  "updater": { ... },
  // HTTP plugin available (line 32 in package.json)
}
```

**Note:** No deep-link plugin registered, no custom URL scheme handlers

### 6. Tauri App Builder (Rust Backend)
**Location:** `/Users/dexter/project/rebebuca/src-tauri/src/lib.rs` (lines 31-300+)

- Line 31-32: `tauri::Builder::default()`
- Plugins initialized (lines 33-42): shell, store, dialog, fs, updater, http, etc.
- **No deep link handler setup**
- Event system available via `Emitter` (line 20) for frontend-backend communication

---

## CURRENT AUTH FLOW (Incomplete)

```
1. User clicks "Login with GitHub"
   ↓
2. authService.openAuthPortal() → window.open(oauth_url)
   ↓
3. Browser opens OAuth provider
   ↓
4. User authorizes
   ↓
5. OAuth provider redirects to:
   https://auth-server.com/api/auth/tauri/github/callback?code=XXX&state=XXX
   ↓
6. Server validates, creates tokens, returns JSON
   ❌ DEAD END: Browser shows JSON response, tokens NOT returned to desktop app!
   ❌ No mechanism to capture callback and pass to app
```

---

## WHAT'S MISSING

### 1. Deep Link Handler
- No URL scheme registration (would need `com.rebebuca.runner://` protocol)
- No window listener for custom protocol URLs
- No event bridge to capture OAuth redirect

### 2. Callback Receiver
- No localhost server listening for OAuth callback
- No polling mechanism for token exchange result
- No way to close browser window after OAuth succeeds

### 3. Token Extraction
- Browser receives JSON response but no code to extract tokens
- No mechanism to pass tokens back to Tauri app
- No error handling for failed OAuth flow

---

## RECOMMENDED IMPLEMENTATION: Localhost Callback Server

### Why This Approach?
1. ✅ **Already has HTTP infrastructure** (Tauri plugin-http, browser can POST)
2. ✅ **No URL scheme registration needed** (cross-platform compatible)
3. ✅ **Server-side support ready** (callback endpoints exist)
4. ✅ **Token storage in place** (localStorage + bearer tokens work)
5. ✅ **Simple and secure** (localhost-only, csrf token already used)

### Architecture

```
App Desktop          OAuth Server       GitHub/Google
├─ Open browser ────────────────→ OAuth page
│  
├─ Start localhost:3100 listener
│  (in Tauri background)
│  
├─ Browser auth ───────────────→ GitHub
│                                 ↓
│                              Generate code
│                                 ↓
└─ Browser redirects to ←──────── GitHub
   http://localhost:3100/oauth/callback?code=XXX&state=XXX
   
   ↓
   
└─ Callback listener on port 3100
   │
   ├─ Extract code & state
   ├─ Close browser window (if possible)
   ├─ Exchange code with OAuth server
   ├─ Receive JWT tokens
   ├─ Store in localStorage (already supported)
   └─ Emit event to Tauri frontend: 'oauth-success' with tokens
   
   ↓
   
   Frontend listens to 'oauth-success' → 
   Store in auth service → 
   Update UI
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Callback Receiver (Rust/Backend)
**Files to modify:**
- `/Users/dexter/project/rebebuca/src-tauri/src/lib.rs` (setup handler)
- Create: `/Users/dexter/project/rebebuca/src-tauri/src/oauth_handler.rs`

**What to do:**
```rust
1. Spawn localhost HTTP server on :3100 in setup()
2. Listen for GET /oauth/callback?code=...&state=...
3. Validate state (compare with cookie sent by frontend)
4. Exchange code with OAuth server via server/api/auth/tauri/*/callback
5. Emit Tauri event: 'oauth-tokens-received' with tokens
6. Return success HTML to browser
```

**Use existing patterns:**
- Tauri event system: `Emitter` (already used in tray)
- HTTP client: Already in dependencies (tauri-plugin-http)
- No additional plugins needed

### Phase 2: Frontend Integration (TypeScript/Vue)
**Files to modify:**
- `/Users/dexter/project/rebebuca/src/services/authService.ts`
- `/Users/dexter/project/rebebuca/src/stores/auth.ts`
- `/Users/dexter/project/rebebuca/src/composables/useAuth.ts`

**What to do:**
```ts
1. Add oauthLoginGithub()/oauthLoginGoogle() methods
2. Redirect to server/api/auth/tauri/github (already exists!)
   - Server returns { url, state }
3. Open browser with `window.open(url)`
4. Setup Tauri event listener for 'oauth-tokens-received'
5. On receive: Store tokens in localStorage, update auth state
6. Handle timeout/error cases
```

**Use existing patterns:**
- `authService.openAuthPortal()` already opens browser
- Storage service already handles tokens
- Event listeners already used in stores

### Phase 3: Redirect URL Configuration
**Files to modify:**
- `/Users/dexter/project/rebebuca/server/app/api/auth/tauri/github/route.ts`
- `/Users/dexter/project/rebebuca/server/app/api/auth/tauri/google/route.ts`

**What to do:**
```ts
1. Change redirectUri from current value to:
   http://localhost:3100/oauth/callback
   
2. This forces OAuth callback to desktop app
   (GitHub/Google don't allow localhost, but can configure)
   
Alternative: Use desktop app's localhost with dynamic port
- Server generates redirect_uri dynamically
- Communicates port to desktop via server response
```

---

## CURRENT TOKEN HANDLING ASSESSMENT

### Bearer Token Support: ✅ FULLY IMPLEMENTED
**Evidence:**
- `authService.ts` line 109: Injects `Authorization: Bearer {token}` header
- Server returns JWT tokens (not cookies)
- Token refresh logic in place (lines 183-205)
- Token storage in localStorage (lines 60-95)

### Cookie Support: ⚠️ PARTIAL
**Evidence:**
- OAuth flow sets `oauth_state` cookie for CSRF protection
- Tauri HTTP plugin **does NOT expose cookie jar** at request level
- Browser cookies work (window.open() uses browser)
- **Issue:** Tauri HTTP requests won't automatically attach cookies

**Decision:** For OAuth callback:
- Use browser initially (has cookies)
- Exchange code server-side (not in desktop app)
- Return tokens as JSON
- Store as bearer tokens (already working)

---

## EXISTING PATTERNS TO REUSE

### 1. Event Listeners (Tauri→Frontend)
**Location:** `/Users/dexter/project/rebebuca/src/stores/app.ts` lines 48-60
```ts
// Already used pattern:
const safeListen = async (event: string, handler: (event: any) => void) => {
  const { listen } = await import("@tauri-apps/api/event");
  return await listen(event, handler);
};
```

### 2. Tauri HTTP Plugin
**Location:** `/Users/dexter/project/rebebuca/src/utils/tauriFetch.ts`
```ts
// Already wraps @tauri-apps/plugin-http
const httpFetch = await initTauriHttp();
```

### 3. Platform Adapters
**Location:** `/Users/dexter/project/rebebuca/src/adapters/`
- Already abstracts system.openExternal()
- Can add oauth methods to adapter interface

### 4. Auth Service Integration Points
**Location:** `/Users/dexter/project/rebebuca/src/services/authService.ts`
- Lines 60-95: Token storage
- Lines 97-124: Request wrapper (can inject state headers)
- Lines 249-251: Authentication check

### 5. Tauri Invocation Pattern
**Location:** `/Users/dexter/project/rebebuca/src-tauri/src/lib.rs` lines 84-94
```rust
// Already used pattern:
let result = await tauriCore!.invoke<string>('execute_task', {
  ptyId, command, args, options
});
```

---

## SECURITY CONSIDERATIONS

### 1. CSRF Protection ✅
- OAuth state already validated (line 54-61 in callback)
- State stored in httpOnly cookie
- No additional measures needed

### 2. Token Storage ⚠️
**Current:** localStorage (vulnerable if XSS occurs)
**Better:** Secure context needed
**Recommendation:** 
- Keep in memory (lose on refresh)
- OR use Tauri plugin-store (encrypted file storage)
  - Already available: `tauri-plugin-store`
  - Already used in adapters

### 3. Localhost Port Binding ✅
- Only accessible from local machine
- Use random high port (>= 3100) for isolation
- Verify request origin is localhost only

### 4. Browser Window Handling
- No ability to auto-close browser after OAuth success
- User must close manually (acceptable UX)
- Or provide "Return to app" button in callback response

---

## IMPLEMENTATION DIFFICULTY & TIMELINE

| Phase | Complexity | Files | Estimated Time | Dependencies |
|-------|-----------|-------|-----------------|--------------|
| **Phase 1: Backend Handler** | Medium | 2 new/modified | 4-6 hours | None (Rust/Tokio) |
| **Phase 2: Frontend Integration** | Low | 3 modified | 2-3 hours | Existing APIs |
| **Phase 3: Redirect Config** | Low | 2 modified | 1-2 hours | Environment vars |
| **Total** | **Medium** | **~7 files** | **7-11 hours** | **0 new packages** |

---

## FILE REFERENCES SUMMARY

### Backend (OAuth Endpoints - Already Exist)
```
✅ server/app/api/auth/tauri/github/route.ts (initiate)
✅ server/app/api/auth/tauri/github/callback/route.ts (callback)
✅ server/app/api/auth/tauri/google/route.ts (initiate)
✅ server/app/api/auth/tauri/google/callback/route.ts (callback)
```

### Authentication Service
```
✅ src/services/authService.ts (token management, localStorage)
✅ src/stores/auth.ts (state management)
✅ src/composables/useAuth.ts (hooks)
```

### Tauri Infrastructure
```
✅ src-tauri/src/lib.rs (app builder, event system)
✅ src-tauri/Cargo.toml (dependencies)
✅ src-tauri/tauri.conf.json (config)
```

### Adapters
```
✅ src/adapters/tauri.ts (openExternal implementation)
✅ src/adapters/types.ts (system interface)
✅ src/utils/tauriFetch.ts (HTTP requests)
```

### Event System
```
✅ src/stores/app.ts (safeListen pattern for Tauri events)
```

---

## NEXT STEPS

1. **Design Phase** (30 min):
   - Document exact localhost port strategy
   - Finalize redirect_uri configuration method
   - Plan error handling flows

2. **Implementation - Part 1** (4-6 hrs):
   - Create Rust oauth_handler module
   - Setup HTTP listener on localhost:3100
   - Emit 'oauth-tokens-received' event

3. **Implementation - Part 2** (2-3 hrs):
   - Update authService.ts with OAuth methods
   - Add event listeners in auth store
   - Update browser opening to use adapter

4. **Testing** (2-3 hrs):
   - Manual OAuth flow testing
   - Error case handling
   - Token refresh verification

5. **Deployment** (1 hr):
   - Configure environment variables
   - Document OAuth flow for developers

---

## ALTERNATIVE: Deep Link Protocol (NOT RECOMMENDED)

### Why Deep Link is Harder:
1. **Platform-specific registration:**
   - macOS: Add URL scheme to Info.plist
   - Windows: Registry entries
   - Linux: .desktop file setup

2. **No native Tauri 2 plugin:**
   - Manual setup required
   - Less reliable cross-platform
   - More complex error handling

3. **URL Scheme Security Issues:**
   - Any app can register `com.rebebuca.runner://`
   - More vulnerable to interception

### If Deep Link Needed Later:
- Use community plugin: `tauri-plugin-deep-link` (if maintained)
- Or implement custom scheme handler in Tauri setup
- Reuse localhost callback logic (easier to maintain)

---

## CONCLUSION

**Recommended Path: Localhost Callback + Token-Based Auth**

**Why:**
- Leverages existing OAuth endpoints (no server changes needed)
- Uses proven bearer token system (already in production code)
- Minimal new dependencies (0 packages)
- Cross-platform without special registration
- Fits Tauri's event architecture naturally
- Can be implemented in <12 hours

**Start with:** `Phase 1 - Backend Handler` in `/Users/dexter/project/rebebuca/src-tauri/src/`
