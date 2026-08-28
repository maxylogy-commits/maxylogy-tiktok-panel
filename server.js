const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || "";
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || "";

const sessions = new Map();

function json(res, code, data) {
  res.writeHead(code, {"Content-Type": "application/json; charset=utf-8"});
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) out[k] = decodeURIComponent(v.join("="));
  }
  return out;
}

function session(req, res) {
  const cookies = parseCookies(req);
  let sid = cookies.sid;
  if (!sid || !sessions.has(sid)) {
    sid = crypto.randomBytes(24).toString("hex");
    sessions.set(sid, {});
    res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`);
  }
  return sessions.get(sid);
}

function tiktokAuthorizeUrl(state) {
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.searchParams.set("client_key", CLIENT_KEY);
  u.searchParams.set("scope", "user.info.basic,video.publish,video.upload");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("state", state);
  return u.toString();
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_key: CLIENT_KEY,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI
  });
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body
  });
  return {status: r.status, data: await r.json()};
}

async function creatorInfo(accessToken) {
  const r = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8"
    },
    body: "{}"
  });
  return {status: r.status, data: await r.json()};
}

const server = http.createServer(async (req, res) => {
  const s = session(req, res);
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/") {
    const html = fs.readFileSync(path.join(__dirname, "index.html"));
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    return res.end(html);
  }

  if (url.pathname === "/privacy") {
    const html = fs.readFileSync(path.join(__dirname, "privacy.html"));
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    return res.end(html);
  }

  if (url.pathname === "/terms") {
    const html = fs.readFileSync(path.join(__dirname, "terms.html"));
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    return res.end(html);
  }

  if (url.pathname === "/api/config") {
    return json(res, 200, {
      configured: Boolean(CLIENT_KEY && CLIENT_SECRET && REDIRECT_URI),
      redirectUri: REDIRECT_URI || null
    });
  }

  if (url.pathname === "/auth/tiktok") {
    if (!CLIENT_KEY || !CLIENT_SECRET || !REDIRECT_URI) {
      return json(res, 500, {error: "TikTok environment variables are not configured"});
    }
    const state = crypto.randomBytes(24).toString("hex");
    s.oauthState = state;
    return res.writeHead(302, {Location: tiktokAuthorizeUrl(state)}).end();
  }

  if (url.pathname === "/auth/tiktok/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || state !== s.oauthState) {
      return json(res, 400, {error: "Invalid OAuth state or missing code"});
    }
    try {
      const token = await exchangeCode(code);
      if (token.status >= 400 || !token.data.access_token) {
        return json(res, token.status, token.data);
      }
      s.accessToken = token.data.access_token;
      s.openId = token.data.open_id || null;
      const info = await creatorInfo(s.accessToken);
      s.creator = info.data?.data || null;
      res.writeHead(302, {Location: "/?connected=1"});
      return res.end();
    } catch (e) {
      return json(res, 500, {error: e.message});
    }
  }

  if (url.pathname === "/api/status") {
    return json(res, 200, {
      connected: Boolean(s.accessToken),
      creator: s.creator || null
    });
  }
  const file = path.join(__dirname, url.pathname.slice(1));
  if (url.pathname === "/api/post") {
    if (!s.accessToken) return json(res, 401, {error: "TikTok account is not connected"});
    // The actual Direct Post request is intentionally left as the next integration step.
    // TikTok requires creator_info + explicit user consent + video init/upload.
    return json(res, 501, {
      error: "Direct Post endpoint is ready to integrate",
      next: "POST /v2/post/publish/video/init/ with the authorized access token"
    });
  }

  if (url.pathname.startsWith("/")) {
    const file = path.join(__dirname, "public", url.pathname.slice(1));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file);
      const types = {".js":"text/javascript", ".css":"text/css", ".png":"image/png", ".svg":"image/svg+xml"};
      res.writeHead(200, {"Content-Type": types[ext] || "application/octet-stream"});
      return fs.createReadStream(file).pipe(res);
    }
  }

  json(res, 404, {error: "Not found"});
});

server.listen(PORT, () => console.log(`Maxylogy panel: http://localhost:${PORT}`));
