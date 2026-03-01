/**
 * Tauri Fetch Interceptor
 *
 * In the Tauri desktop app, there is no Astro server to handle /api/* routes.
 * This module monkey-patches window.fetch to intercept all /api/* calls and
 * handle them locally — calling VinFast, Auth0, and Cognito APIs directly
 * via the Tauri HTTP plugin (Rust-side fetch, bypasses CORS).
 *
 * The browser version is completely unaffected — this module is a no-op
 * when not running inside Tauri.
 */

// --- Tauri Detection ---
export const isTauri =
  typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

if (!isTauri) {
  // Not in Tauri — do nothing, all /api/* calls go to the Astro server as usual
} else {
  // --- Token Storage ---
  const TOKEN_KEY = "vf_tauri_tokens";

  function getTokens() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }

  function setTokens(tokens) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }

  function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // --- Lazy Tauri HTTP Plugin ---
  let _tauriFetch = null;
  async function getTauriFetch() {
    if (!_tauriFetch) {
      try {
        const mod = await import("@tauri-apps/plugin-http");
        _tauriFetch = mod.fetch;
      } catch {
        // Fallback: if plugin not available, use regular fetch
        console.warn(
          "[tauriFetch] HTTP plugin not available, using window.fetch",
        );
        _tauriFetch = _originalFetch;
      }
    }
    return _tauriFetch;
  }

  // --- Region Config (mirrors src/config/vinfast.js) ---
  const REGIONS = {
    us: {
      auth0_domain: "vinfast-us-prod.us.auth0.com",
      auth0_client_id: "xhGY7XKDFSk1Q22rxidvwujfz0EPAbUP",
      auth0_audience: "https://vinfast-us-prod.us.auth0.com/api/v2/",
      api_base: "https://mobile.connected-car.vinfastauto.us",
    },
    eu: {
      auth0_domain: "vinfast-eu-prod.eu.auth0.com",
      auth0_client_id: "dxxtNkkhsPWW78x6s1BWQlmuCfLQrkze",
      auth0_audience: "https://vinfast-eu-prod.eu.auth0.com/api/v2/",
      api_base: "https://mobile.connected-car.vinfastauto.eu",
    },
    vn: {
      auth0_domain: "vin3s.au.auth0.com",
      auth0_client_id: "jE5xt50qC7oIh1f32qMzA6hGznIU5mgH",
      auth0_audience: "https://mobile.connected-car.vinfast.vn",
      api_base: "https://mobile.connected-car.vinfast.vn",
    },
  };

  const MQTT_CONFIG = {
    vn: {
      endpoint: "prod.iot.connected-car.vinfast.vn",
      region: "ap-southeast-1",
      cognitoPoolId: "ap-southeast-1:c6537cdf-92dd-4b1f-99a8-9826f153142a",
      cognitoLoginProvider: "vin3s.au.auth0.com",
    },
  };

  const API_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-SERVICE-NAME": "CAPP",
    "X-APP-VERSION": "2.17.5",
    "X-Device-Platform": "android",
    "X-Device-Family": "SM-F946B",
    "X-Device-OS-Version": "android 14",
    "X-Device-Locale": "vi-VN",
    "X-Timezone": "Asia/Ho_Chi_Minh",
    "X-Device-Identifier": "vfdashboard-community-edition",
    "X-IMEI": "",
    "User-Agent": "android - vfdashboard-community-edition - 2.17.5",
  };

  // HMAC signing paths (same as server proxy)
  const SIGNED_PATH_PREFIXES = ["ccaraccessmgmt/", "ccarcharging/"];

  // --- Web Crypto HMAC-SHA256 ---
  async function hmacSha256Base64(key, message) {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      enc.encode(message),
    );
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  // --- X-HASH Generation (mirrors server [...path].js) ---
  async function generateXHash(method, apiPath, vin, timestamp) {
    const secretKey = "Vinfast@2025";
    const normalizedPath = apiPath.startsWith("/") ? apiPath : "/" + apiPath;
    const parts = [method, normalizedPath];
    if (vin) parts.push(vin);
    parts.push(secretKey);
    parts.push(String(timestamp));
    return hmacSha256Base64(secretKey, parts.join("_").toLowerCase());
  }

  // --- X-HASH-2 Generation (mirrors server [...path].js) ---
  async function generateXHash2({
    platform,
    vinCode,
    identifier,
    path,
    method,
    timestamp,
  }) {
    const hash2Key = "ConnectedCar@6521";
    let normalizedPath = path.startsWith("/") ? path.substring(1) : path;
    normalizedPath = normalizedPath.replace(/\//g, "_");
    const parts = [platform];
    if (vinCode) parts.push(vinCode);
    parts.push(identifier);
    parts.push(normalizedPath);
    parts.push(method);
    parts.push(String(timestamp));
    return hmacSha256Base64(hash2Key, parts.join("_").toLowerCase());
  }

  // --- Helper: Build a Response object ---
  function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    });
  }

  // --- Handler: /api/login ---
  async function handleLogin(options) {
    try {
      const body = JSON.parse(options?.body || "{}");
      const { email, password, region = "vn", rememberMe } = body;
      const regionConfig = REGIONS[region] || REGIONS.vn;
      const fetchFn = await getTauriFetch();

      const auth0Url = `https://${regionConfig.auth0_domain}/oauth/token`;
      const auth0Payload = {
        client_id: regionConfig.auth0_client_id,
        audience: regionConfig.auth0_audience,
        grant_type: "password",
        scope:
          "offline_access openid profile email read:current_user update:current_user_metadata",
        connection: "Username-Password-Authentication",
        username: email,
        password,
      };

      console.log(`[tauriFetch] Login → Auth0 direct`);
      const response = await fetchFn(auth0Url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth0Payload),
      });

      const data = await response.json();
      console.log(`[tauriFetch] Login ← ${response.status}`);

      if (!response.ok) {
        return jsonResponse(data, response.status);
      }

      // Store tokens locally
      const expiresIn = data.expires_in || 3600;
      const tokenExpiresAt = Date.now() + expiresIn * 1000;
      setTokens({
        access_token: data.access_token,
        id_token: data.id_token || null,
        refresh_token: data.refresh_token || null,
        region,
        tokenExpiresAt,
      });

      return jsonResponse({
        success: true,
        region,
        tokenExpiresAt,
        _authLog: [{ via: "tauri-direct", status: response.status }],
      });
    } catch (e) {
      console.error("[tauriFetch] Login error:", e);
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // --- Handler: /api/refresh ---
  async function handleRefresh(options) {
    try {
      const body = JSON.parse(options?.body || "{}");
      const { region = "vn", rememberMe } = body;
      const tokens = getTokens();

      if (!tokens.refresh_token) {
        return jsonResponse({ error: "No refresh token found" }, 401);
      }

      const regionConfig = REGIONS[region] || REGIONS.vn;
      const fetchFn = await getTauriFetch();

      const auth0Url = `https://${regionConfig.auth0_domain}/oauth/token`;
      const response = await fetchFn(auth0Url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: regionConfig.auth0_client_id,
          grant_type: "refresh_token",
          refresh_token: tokens.refresh_token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        clearTokens();
        return jsonResponse(data, response.status);
      }

      const expiresIn = data.expires_in || 3600;
      const tokenExpiresAt = Date.now() + expiresIn * 1000;
      setTokens({
        ...tokens,
        access_token: data.access_token,
        id_token: data.id_token || tokens.id_token,
        refresh_token: data.refresh_token || tokens.refresh_token,
        tokenExpiresAt,
      });

      return jsonResponse({ success: true, tokenExpiresAt });
    } catch (e) {
      console.error("[tauriFetch] Refresh error:", e);
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // --- Handler: /api/user ---
  async function handleUser(url) {
    try {
      const tokens = getTokens();
      if (!tokens.access_token) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const urlObj = new URL(url, "http://localhost");
      const region = urlObj.searchParams.get("region") || "vn";
      const regionConfig = REGIONS[region] || REGIONS.vn;
      const fetchFn = await getTauriFetch();

      const response = await fetchFn(
        `https://${regionConfig.auth0_domain}/userinfo`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.access_token}`,
          },
        },
      );

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ error: `Auth0 returned ${response.status}` }));
        return jsonResponse(errorBody, response.status);
      }

      const data = await response.json();
      return jsonResponse({
        name: data.name,
        nickname: data.nickname,
        picture: data.picture,
        email: data.email,
        sub: data.sub,
      });
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // --- Handler: /api/mqtt-credentials ---
  async function handleMqttCredentials() {
    try {
      const tokens = getTokens();
      if (!tokens.access_token) {
        return jsonResponse({ error: "Not logged in" }, 401);
      }

      const regionKey = tokens.region || "vn";
      const mqttConfig = MQTT_CONFIG[regionKey] || MQTT_CONFIG.vn;
      const regionConfig = REGIONS[regionKey] || REGIONS.vn;
      const fetchFn = await getTauriFetch();

      const loginProvider =
        mqttConfig.cognitoLoginProvider || regionConfig.auth0_domain;
      const cognitoToken = tokens.id_token || tokens.access_token;
      const tokenType = tokens.id_token ? "id_token" : "access_token";
      const logins = { [loginProvider]: cognitoToken };

      // Step 1: GetId
      const getIdResponse = await fetchFn(
        `https://cognito-identity.${mqttConfig.region}.amazonaws.com/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityService.GetId",
          },
          body: JSON.stringify({
            IdentityPoolId: mqttConfig.cognitoPoolId,
            Logins: logins,
          }),
        },
      );

      if (!getIdResponse.ok) {
        const err = await getIdResponse.text();
        throw new Error(
          `Cognito GetId failed (${getIdResponse.status}): ${err}`,
        );
      }

      const getIdResult = await getIdResponse.json();
      const identityId = getIdResult.IdentityId;

      // Step 2: GetCredentialsForIdentity
      const credsResponse = await fetchFn(
        `https://cognito-identity.${mqttConfig.region}.amazonaws.com/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target":
              "AWSCognitoIdentityService.GetCredentialsForIdentity",
          },
          body: JSON.stringify({
            IdentityId: identityId,
            Logins: logins,
          }),
        },
      );

      if (!credsResponse.ok) {
        const err = await credsResponse.text();
        throw new Error(
          `Cognito GetCredentials failed (${credsResponse.status}): ${err}`,
        );
      }

      const credsResult = await credsResponse.json();
      const creds = credsResult.Credentials;

      // Step 3: Attach Policy
      const attachPolicyUrl = `${regionConfig.api_base}/ccarusermgnt/api/v1/user-vehicle/attach-policy`;
      let policyAttached = false;
      let policyMessage = "skipped";

      try {
        const policyResponse = await fetchFn(attachPolicyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.access_token}`,
            "x-service-name": "CAPP",
            "x-app-version": "2.17.5",
            "x-device-platform": "android",
            "x-device-identifier": "vfdashboard-community-edition",
            "x-timezone": "Asia/Ho_Chi_Minh",
            "x-device-locale": "vi-VN",
            Accept: "application/json",
            Origin: "",
            Referer: "",
          },
          body: JSON.stringify({ target: identityId }),
        });

        const policyText = await policyResponse.text();
        let policyPayload = null;
        try {
          policyPayload = JSON.parse(policyText);
        } catch {}

        if (policyResponse.ok) {
          const code = Number(policyPayload?.code);
          policyAttached = !Number.isFinite(code) || code === 200000;
          policyMessage = policyPayload?.message || policyText || "ok";
        } else {
          policyMessage = `attach-policy failed (${policyResponse.status}): ${policyText}`;
        }
      } catch (e) {
        policyMessage = `attach-policy error: ${e.message}`;
      }

      console.log(
        `[tauriFetch] MQTT creds OK with ${tokenType}, identity: ${identityId}`,
      );

      return jsonResponse({
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretKey,
        sessionToken: creds.SessionToken,
        expiration: creds.Expiration,
        identityId,
        tokenType,
        policyAttached,
        policyMessage,
        endpoint: mqttConfig.endpoint,
        region: mqttConfig.region,
      });
    } catch (e) {
      console.error("[tauriFetch] MQTT credentials error:", e.message);
      const status =
        e.message.includes("401") || e.message.includes("NotAuthorized")
          ? 401
          : 500;
      return jsonResponse({ error: e.message }, status);
    }
  }

  // --- Handler: /api/proxy/* ---
  async function handleProxy(url, options) {
    try {
      const tokens = getTokens();
      if (!tokens.access_token) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      // Parse: /api/proxy/{apiPath}?region=vn&...
      const urlObj = new URL(url, "http://localhost");
      const fullPath = urlObj.pathname.replace(/^\/api\/proxy\//, "");
      const region = urlObj.searchParams.get("region") || "vn";
      const regionConfig = REGIONS[region] || REGIONS.vn;

      // Strip internal params, keep the rest
      const targetParams = new URLSearchParams(urlObj.search);
      targetParams.delete("region");
      const searchStr = targetParams.toString();
      const targetUrl = `${regionConfig.api_base}/${fullPath}${searchStr ? "?" + searchStr : ""}`;

      const method = options?.method || "GET";
      const clientHeaders = options?.headers || {};
      const vinHeader =
        clientHeaders["x-vin-code"] || clientHeaders["X-Vin-Code"] || null;
      const playerHeader =
        clientHeaders["x-player-identifier"] ||
        clientHeaders["X-Player-Identifier"] ||
        null;

      // Build proxy headers
      // CRITICAL: Tauri's HTTP plugin injects Origin: 'tauri://localhost' on every request.
      // VinFast's server rejects this with 403 'Invalid CORS request'.
      // Setting Origin to empty string triggers the plugin's escape hatch in Rust:
      //   if Origin == "" → remove header entirely (like a server-to-server request).
      // Requires 'unsafe-headers' feature in Cargo.toml for tauri-plugin-http.
      const proxyHeaders = {
        ...API_HEADERS,
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access_token}`,
        Origin: "",
        Referer: "",
      };

      // HMAC signing for protected paths
      const requiresSigning = SIGNED_PATH_PREFIXES.some((p) =>
        fullPath.startsWith(p),
      );
      if (requiresSigning) {
        const timestamp = Date.now();
        const xHash = await generateXHash(
          method,
          fullPath,
          vinHeader,
          timestamp,
        );
        const xHash2 = await generateXHash2({
          platform: API_HEADERS["X-Device-Platform"],
          vinCode: vinHeader || null,
          identifier: API_HEADERS["X-Device-Identifier"],
          path: "/" + fullPath,
          method,
          timestamp: String(timestamp),
        });

        proxyHeaders["X-HASH"] = xHash;
        proxyHeaders["X-HASH-2"] = xHash2;
        proxyHeaders["X-TIMESTAMP"] = String(timestamp);
      }

      if (vinHeader) proxyHeaders["X-Vin-Code"] = vinHeader;
      if (playerHeader) proxyHeaders["X-Player-Identifier"] = playerHeader;

      const fetchFn = await getTauriFetch();
      const fetchInit = { method, headers: proxyHeaders };
      if (options?.body) fetchInit.body = options.body;

      console.log(`[tauriFetch] Proxy → ${method} ${targetUrl}`);
      const response = await fetchFn(targetUrl, fetchInit);
      const responseText = await response.text();
      console.log(
        `[tauriFetch] Proxy ← ${response.status} (${responseText.length} bytes)`,
      );

      return new Response(responseText, {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "X-Proxy-Route": "tauri-direct",
        },
      });
    } catch (e) {
      console.error("[tauriFetch] Proxy error:", e);
      return jsonResponse({ error: e.message }, 500);
    }
  }

  // --- Handler: /api/logout ---
  async function handleLogout() {
    clearTokens();
    return jsonResponse({ success: true });
  }

  // --- Handler: /api/known-aliases ---
  async function handleKnownAliases() {
    // In desktop mode, we don't have Cloudflare KV
    // Return empty — Deep Scan will work with static alias map only
    return jsonResponse({});
  }

  // --- Main Router ---
  async function handleTauriApiCall(url, options) {
    const pathname = new URL(url, "http://localhost").pathname;

    if (pathname === "/api/login") return handleLogin(options);
    if (pathname === "/api/refresh") return handleRefresh(options);
    if (pathname.startsWith("/api/user")) return handleUser(url);
    if (pathname === "/api/mqtt-credentials") return handleMqttCredentials();
    if (pathname.startsWith("/api/proxy/")) return handleProxy(url, options);
    if (pathname === "/api/logout") return handleLogout();
    if (pathname === "/api/known-aliases") return handleKnownAliases();

    // Unknown API path — return 404
    console.warn(`[tauriFetch] Unknown API route: ${pathname}`);
    return jsonResponse({ error: `Unknown API route: ${pathname}` }, 404);
  }

  // --- Install Fetch Interceptor ---
  const _originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || String(input);

    // Intercept all /api/* calls
    if (url.startsWith("/api/")) {
      return handleTauriApiCall(url, init);
    }

    // Everything else (MQTT WebSocket, CDN assets, etc.) goes through normally
    return _originalFetch(input, init);
  };

  console.log(
    "%c[VFDashboard] Tauri mode active — API calls handled locally",
    "color:#22c55e;font-weight:bold",
  );
}
