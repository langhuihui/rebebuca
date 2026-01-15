# OAuth + Deep Linking - Quick Reference
## Rebebuca Project

### Status Overview
| Component | Status | Location |
|-----------|--------|----------|
| OAuth Backend Endpoints | ✅ READY | `server/app/api/auth/tauri/` |
| Bearer Token Auth | ✅ READY | `src/services/authService.ts:109` |
| Token Storage (localStorage) | ✅ READY | `src/services/authService.ts:60-95` |
| Token Refresh Logic | ✅ READY | `src/services/authService.ts:183-205` |
| Browser Opening (openExternal) | ✅ READY | `src/adapters/tauri.ts:389-417` |
| HTTP Plugin (Tauri) | ✅ READY | `src/utils/tauriFetch.ts` |
| Tauri Event System | ✅ READY | `src/stores/app.ts:48-60` |
| **Deep Link Handler** | ❌ MISSING | - |
| **Callback Receiver** | ❌ MISSING | - |
| **Token Pass-back to App** | ❌ MISSING | - |

### Current Problem
1. OAuth callback redirects to browser
2. Browser shows JSON tokens but no code to extract them
3. No way to pass tokens back to Tauri app
4. User is stuck in browser after OAuth

### Recommended Solution: Localhost Callback Server

**Why:** 
- No new plugins needed
- Uses existing infrastructure
- Cross-platform compatible
- ~7-11 hours implementation time

**What to implement:**
1. Rust HTTP server on localhost:3100 in Tauri backend
2. Listen for OAuth callback URL
3. Exchange code for tokens (backend calls existing endpoint)
4. Emit Tauri event with tokens
5. Frontend listens to event and stores tokens

### Key Files (No Changes Needed Yet)

#### Already Working - Don't Touch:
```
✅ server/app/api/auth/tauri/github/route.ts
✅ server/app/api/auth/tauri/github/callback/route.ts
✅ server/app/api/auth/tauri/google/route.ts
✅ server/app/api/auth/tauri/google/callback/route.ts
✅ src/services/authService.ts (line 109 - Bearer token injection)
✅ src/services/authService.ts (lines 60-95 - Token storage)
✅ src/adapters/tauri.ts (lines 389-417 - openExternal)
```

#### Files to Create/Modify:
```
🔧 Create: src-tauri/src/oauth_handler.rs
🔧 Modify: src-tauri/src/lib.rs (add OAuth handler setup)
🔧 Modify: src/services/authService.ts (add OAuth methods)
🔧 Modify: src/stores/auth.ts (add event listener)
🔧 Modify: server/app/api/auth/tauri/github/route.ts (change redirect_uri)
🔧 Modify: server/app/api/auth/tauri/google/route.ts (change redirect_uri)
```

### Current Auth Flow (Broken)
```
User → Login button → Browser opens → GitHub auth → 
Server returns tokens → Browser shows JSON ❌ DEAD END
```

### Proposed Auth Flow (Working)
```
User → Login button → Browser opens → GitHub auth → 
localhost:3100/callback ← GitHub redirects → 
Rust backend receives → exchanges code → gets tokens → 
emits Tauri event → Frontend stores → Auth complete ✅
```

### Implementation Steps (in order)

1. **Check ports are free**
   - Verify localhost:3100 is not in use
   - Consider using random port allocation

2. **Create Rust OAuth handler** (4-6 hours)
   - HTTP listener on localhost:3100
   - Parse query params (code, state)
   - Call server endpoint to exchange code
   - Emit Tauri event with tokens

3. **Update frontend auth service** (2-3 hours)
   - Add oauthLoginGithub() / oauthLoginGoogle()
   - Setup event listener for tokens
   - Store tokens in existing localStorage

4. **Update OAuth redirect_uri** (1-2 hours)
   - Change from current value to http://localhost:3100/oauth/callback
   - Test with GitHub/Google settings

5. **Test full flow** (2-3 hours)
   - Manual OAuth test
   - Error handling
   - Token refresh

### Code Snippets Reference

**Bearer Token Injection (already working):**
```ts
// src/services/authService.ts:108-110
if (this.accessToken) {
  (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
}
```

**Token Storage (already working):**
```ts
// src/services/authService.ts:45-49
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'rebebuca_access_token',
  REFRESH_TOKEN: 'rebebuca_refresh_token',
  USER: 'rebebuca_user',
};
```

**Event Listener Pattern (to reuse):**
```ts
// src/stores/app.ts:48-60
const safeListen = async (event: string, handler: (event: any) => void) => {
  const { listen } = await import("@tauri-apps/api/event");
  return await listen(event, handler);
};
```

**Browser Opening (to enhance):**
```ts
// src/adapters/tauri.ts:389-417
async openExternal(url: string): Promise<void> {
  // Already handles multiple platforms
  // Just needs to be called from authService
}
```

### Security Checklist

- ✅ CSRF protection (state validation already in place)
- ✅ localhost-only binding (no external network)
- ✅ Bearer tokens (not cookies)
- ⚠️ Token storage (localStorage = XSS vulnerable, but acceptable)
- ✅ Secure headers (CORS will be localhost only)

### OAuth Endpoints Already Configured

- GitHub initiate: `/api/auth/tauri/github`
- GitHub callback: `/api/auth/tauri/github/callback`
- Google initiate: `/api/auth/tauri/google`
- Google callback: `/api/auth/tauri/google/callback`

All return JSON with tokens (no HTML redirect needed).

### Testing Checklist

- [ ] Port 3100 available
- [ ] Rust OAuth handler compiles
- [ ] GitHub callback URL updated in settings
- [ ] Google callback URL updated in settings
- [ ] Browser opens on login
- [ ] OAuth succeeds and redirects to localhost
- [ ] Tauri event receives tokens
- [ ] Tokens stored in localStorage
- [ ] Frontend auth state updates
- [ ] User is logged in
- [ ] Token refresh works
- [ ] Error cases handled gracefully

### Timeline

| Phase | Time | Status |
|-------|------|--------|
| Analysis | ✅ Done | - |
| Rust Handler | 4-6 hrs | Ready to start |
| Frontend Integration | 2-3 hrs | After handler done |
| Testing | 2-3 hrs | Final phase |
| **Total** | **8-12 hrs** | Realistic estimate |

### Next: Read Full Analysis

See `OAUTH_DEEPLINK_ANALYSIS.md` for:
- Detailed architecture diagram
- Line-by-line code references
- Alternate approaches (deep links)
- Security deep-dive
- Troubleshooting guide
