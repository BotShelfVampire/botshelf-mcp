// FIX_3 (2026-11-18): read-only MCP endpoint (/api/mcp). Offline: fetch is replaced by a reader of the
// tree on disk, so the test never touches the network, a store or real visitor data.
// Usage (box): node ~/team_test/bsv/work/tests/mcp_test.js <tree root holding netlify/ and site/>
process.env.COMMERCE_SESSION_SECRET = "mcp-test-secret-not-a-real-one";
const fs = require("fs");
const path = require("path");
const root = path.resolve(process.argv[2] || ".");
const F = (p) => path.join(root, "netlify/functions", p);
const G = typeof globalThis !== "undefined" ? globalThis : this;

let fetched = [], failNext = 0, nextBody = null;
G.fetch = async (url) => {
  fetched.push(url);
  if (failNext > 0) { failNext--; throw new Error("network down (test)"); }
  if (nextBody !== null) { const b = nextBody; nextBody = null; return { ok: true, status: 200, text: async () => b }; }
  const m = /^https:\/\/botshelfvampire\.com(\/[^?#]*)$/.exec(url);
  if (!m) throw new Error("test: fetch outside the site: " + url);
  const file = path.join(root, "site", m[1]);
  if (!fs.existsSync(file)) return { ok: false, status: 404, text: async () => "" };
  const text = String(fs.readFileSync(file, "utf8"));
  return { ok: true, status: 200, text: async () => text };
};
if (typeof G.AbortController === "undefined") G.AbortController = function () { this.signal = {}; this.abort = function () {}; };
if (typeof G.clearTimeout === "undefined") { G.setTimeout = function () { return 0; }; G.clearTimeout = function () {}; } // jsc shell only

const core = require(F("_lib/mcpCore.js"));
const mcp = require(F("mcp.js"));

let checks = 0, failures = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; console.error("FAIL", m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + " (got " + JSON.stringify(a) + ")");
let ipN = 0;
const freshIp = () => "203.0.113." + (++ipN % 250) + "";
const ev = (body, o) => Object.assign({ httpMethod: "POST", headers: { "content-type": "application/json", "x-nf-client-connection-ip": (o && o.ip) || freshIp() },
  body: typeof body === "string" ? body : JSON.stringify(body) }, (o && o.over) || {});
const call = async (body, o) => { const r = await mcp.handler(ev(body, o)); return { r, j: r.body ? JSON.parse(r.body) : null }; };
const rpc = (id, method, params) => ({ jsonrpc: "2.0", id, method, params });
const tool = async (name, args, o) => {
  const { r, j } = await call(rpc(7, "tools/call", { name, arguments: args }), o);
  return { r, j, res: j && j.result, data: j && j.result && j.result.structuredContent };
};

(async () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, "site", mcp.INDEX_PATH), "utf8"));
  const rows = index.rows;
  ok(rows.length > 1000, "index on disk has rows");

  // --- transport
  let x = await mcp.handler({ httpMethod: "OPTIONS", headers: {} });
  eq(x.statusCode, 204, "OPTIONS -> 204");
  ok(/Mcp-Protocol-Version/.test(x.headers["Access-Control-Allow-Headers"]), "CORS lets the protocol header through");
  x = await mcp.handler({ httpMethod: "GET", headers: {} });
  eq(x.statusCode, 405, "GET -> 405 (no event stream offered)");
  ok(/POST/.test(x.headers.Allow), "405 names POST");
  x = await mcp.handler({ httpMethod: "DELETE", headers: {} });
  eq(x.statusCode, 405, "DELETE -> 405");
  x = await mcp.handler({ httpMethod: "POST", headers: { "content-type": "text/plain", "x-nf-client-connection-ip": freshIp() }, body: "{}" });
  eq(x.statusCode, 415, "wrong content type -> 415");
  x = await call("{not json");
  eq([x.r.statusCode, x.j.error.code, x.j.id], [400, -32700, null], "bad JSON -> parse error");
  x = await call([rpc(1, "ping")]);
  eq([x.r.statusCode, x.j.error.code], [400, -32600], "batch refused");
  x = await call({ id: 1, method: "ping" });
  eq([x.r.statusCode, x.j.error.code], [400, -32600], "missing jsonrpc refused");
  x = await call({ jsonrpc: "2.0", id: null, method: "ping" });
  eq(x.r.statusCode, 400, "null id refused");
  x = await call({ jsonrpc: "2.0", method: "notifications/initialized" });
  eq([x.r.statusCode, x.r.body], [202, ""], "notification -> 202, no body");
  x = await call({ jsonrpc: "2.0", id: 3, result: {} });
  eq(x.r.statusCode, 202, "client response -> 202");
  x = await call("x".repeat(core.LIMITS.bodyBytes + 1));
  eq(x.r.statusCode, 413, "oversize request -> 413");
  const wide = JSON.stringify(rpc(1, "ping", { x: "\u3042".repeat(12000) }));
  ok(wide.length < core.LIMITS.bodyBytes, "multi-byte probe is short in characters");
  eq((await call(wide)).r.statusCode, 413, "size is counted in bytes, not characters");
  let b64 = null;
  try { b64 = Buffer.from(JSON.stringify(rpc(5, "ping")), "utf8").toString("base64"); } catch (e) { b64 = null; } // the jsc stand-in has no base64
  if (b64) {
    x = await call(b64, { over: { isBase64Encoded: true } });
    eq([x.r.statusCode, x.j.id], [200, 5], "base64 body is decoded");
    x = await call(Buffer.from(wide, "utf8").toString("base64"), { over: { isBase64Encoded: true } });
    eq(x.r.statusCode, 413, "base64 body: decoded size is what counts");
  }
  for (const badId of [1.5, true, {}, []]) eq((await call({ jsonrpc: "2.0", id: badId, method: "ping" })).r.statusCode, 400, "id must be a string or whole number: " + JSON.stringify(badId));
  const hdr = (h) => ({ over: { headers: Object.assign({ "content-type": "application/json", "x-nf-client-connection-ip": freshIp() }, h) } });
  eq((await call(rpc(1, "ping"), hdr({ Origin: "not-an-origin" }))).r.statusCode, 403, "malformed Origin -> 403");
  eq((await call(rpc(1, "ping"), hdr({ Origin: "https://example.com" }))).r.statusCode, 200, "a real web origin may read (public data)");
  eq((await call(rpc(1, "ping"), hdr({ origin: "null" }))).r.statusCode, 200, "Origin: null is accepted");
  x = await call(rpc(1, "ping"));
  eq(x.r.headers["Cache-Control"], "no-store", "responses are not cached");
  ok(!x.r.headers["Mcp-Session-Id"] && !x.r.headers["Set-Cookie"], "no session, no cookie");

  // --- lifecycle
  x = await call(rpc("a", "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } }));
  eq([x.r.statusCode, x.j.id, x.j.result.protocolVersion], [200, "a", "2025-06-18"], "initialize echoes a supported version and the id");
  eq(x.j.result.serverInfo.name, "botshelf-vampire", "server name");
  eq(Object.keys(x.j.result.capabilities), ["tools"], "only the tools capability is declared");
  ok(/not an\s+official/i.test(x.j.result.instructions) && /Untested/.test(x.j.result.instructions), "instructions say unofficial and Untested");
  x = await call(rpc(2, "initialize", { protocolVersion: "1999-01-01" }));
  ok(core.PROTOCOLS.indexOf(x.j.result.protocolVersion) >= 0, "unknown version -> a version this server speaks");
  x = await call(rpc(2, "initialize", { protocolVersion: "2025-03-26" }));
  ok(x.j.result.protocolVersion !== "2025-03-26", "2025-03-26 (which requires batches) is not agreed to");
  eq((await call(rpc(2, "initialize", {}))).j.error.code, -32602, "initialize without a version -> invalid params");
  eq((await call(rpc(2, "initialize"))).j.error.code, -32602, "initialize without params -> invalid params");
  eq((await call({ jsonrpc: "2.0", id: 2, method: "ping", params: false })).j.error.code, -32602, "params must be structured");
  const garbage = { over: { headers: { "content-type": "application/json", "mcp-protocol-version": "garbage", "x-nf-client-connection-ip": freshIp() } } };
  eq((await call({ jsonrpc: "2.0", method: "notifications/initialized" }, garbage)).r.statusCode, 400, "bad protocol header on a notification -> 400");
  eq((await call(rpc(2, "initialize", { protocolVersion: "2025-06-18" }), garbage)).r.statusCode, 400, "bad protocol header on initialize -> 400");
  x = await call(rpc(2, "ping"));
  eq(x.j.result, {}, "ping");
  x = await call(rpc(2, "ping"), { over: { headers: { "content-type": "application/json", "MCP-Protocol-Version": "1999-01-01", "x-nf-client-connection-ip": freshIp() } } });
  eq(x.r.statusCode, 400, "unsupported protocol header -> 400");
  x = await call(rpc(2, "resources/list"));
  eq(x.j.error.code, -32601, "undeclared capability -> method not found");

  // --- tools/list
  x = await call(rpc(4, "tools/list"));
  const tools = x.j.result.tools;
  eq(tools.map((t) => t.name), ["search_items", "get_item", "list_items"], "three tools");
  ok(tools.every((t) => t.annotations.readOnlyHint === true && t.annotations.destructiveHint === false), "every tool is marked read-only");
  ok(tools.every((t) => t.inputSchema.type === "object" && t.inputSchema.additionalProperties === false), "schemas are closed objects");

  // --- search
  let t = await tool("search_items", { query: "code review" });
  ok(t.res.isError === false && t.data.items.length > 0 && t.data.items.length <= 10, "search returns a default page");
  ok(t.data.items.every((i) => i.url === "https://botshelfvampire.com" + i.id), "result urls are on the site");
  const hay = (i) => { const r = rows.find((q) => q.u === i.id); return JSON.stringify(r).toLowerCase(); };
  ok(t.data.items.every((i) => hay(i).indexOf("code") >= 0 && hay(i).indexOf("review") >= 0) && t.data.total >= t.data.items.length, "every result holds every word");
  eq(JSON.parse(t.res.content[0].text), t.data, "text content and structured content agree");
  t = await tool("search_items", { query: "code review", limit: 3, runs_on: "claude code" });
  ok(t.data.items.length <= 3 && t.data.items.every((i) => i.runs_on.indexOf("Claude Code") >= 0), "limit and runs_on filter");
  t = await tool("search_items", { query: "zzzzqqqqxxxx-nothing" });
  eq([t.res.isError, t.data.total, t.data.items], [false, 0, []], "no match is an empty list, not an error");
  t = await tool("search_items", { query: "a", limit: 26 });
  ok(t.res.isError === true, "limit above the cap is refused");
  t = await tool("search_items", { query: "y".repeat(201) });
  ok(t.res.isError === true, "over-long query is refused");
  t = await tool("search_items", {});
  ok(t.res.isError === true && /query/.test(t.res.content[0].text), "missing query is a tool error");
  t = await tool("search_items", { query: "x", shell: "rm -rf" });
  ok(t.res.isError === true, "unknown argument is refused");
  t = await tool("search_items", { query: 5 });
  ok(t.res.isError === true, "wrong type is refused");
  x = await call(rpc(9, "tools/call", { name: "delete_everything", arguments: {} }));
  eq(x.j.error.code, -32602, "unknown tool -> protocol error");
  for (const badName of [{ toString: null }, 7, null, ["search_items"]]) {
    x = await call(rpc(9, "tools/call", { name: badName, arguments: {} }));
    eq([x.r.statusCode, x.j.error.code], [200, -32602], "tool name that is not a string -> invalid params, not a crash");
  }
  eq((await call(rpc(9, "tools/call", ["search_items"]))).j.error.code, -32602, "positional params on tools/call -> invalid params");
  t = await tool("search_items", { query: "code ".repeat(12) + "zzzzabsentword" });
  eq(t.data.total, 0, "every word counts, also the thirteenth");

  // --- list
  t = await tool("list_items", {});
  eq(t.data.total, rows.length, "list total equals the index");
  eq(t.data.items.map((i) => i.id), rows.slice(0, 10).map((r) => r.u), "list keeps shelf order");
  const kindSum = Object.keys(t.data.kinds).reduce((s, k) => s + t.data.kinds[k], 0);
  eq(kindSum, rows.length, "kind counts add up");
  const p1 = (await tool("list_items", { kind: "toolkit", limit: 5 })).data;
  const p2 = (await tool("list_items", { kind: "toolkit", limit: 5, offset: p1.next_offset })).data;
  ok(p1.items.length === 5 && p2.items.length > 0 && !p1.items.some((a) => p2.items.some((b) => a.id === b.id)), "pages do not overlap");
  ok(p1.items.concat(p2.items).every((i) => i.kind === "toolkit"), "kind filter");
  t = await tool("list_items", { access: "paid", limit: 25 });
  const nPaid = rows.filter((r) => r.a !== "open").length;
  eq([t.data.total, t.data.items.every((i) => i.text_url === null)], [nPaid, true], "paid listings: counted, no text address");
  t = await tool("list_items", { offset: rows.length + 5 });
  eq([t.data.items, t.data.next_offset], [[], null], "offset past the end");

  // --- get_item
  const openRow = rows.find((r) => r.k === "build" && r.raw);
  const onDisk = String(fs.readFileSync(path.join(root, "site", openRow.raw), "utf8"));
  t = await tool("get_item", { id: openRow.u });
  ok(t.data.text === onDisk.slice(0, 20000) && t.data.total_chars === onDisk.length, "open item: text equals the published file");
  t = await tool("get_item", { id: "https://botshelfvampire.com" + openRow.u + "?lang=ja" });
  eq(t.data.item.id, openRow.u, "full address with a query is accepted");
  const a = (await tool("get_item", { id: openRow.u, max_chars: 500 })).data;
  const b = (await tool("get_item", { id: openRow.u, max_chars: 500, offset: a.next_offset || 0 })).data;
  ok(onDisk.length <= 500 ? a.next_offset === null : (a.text + b.text === onDisk.slice(0, a.text.length + b.text.length) && a.text.length === 500), "long text continues from next_offset");
  const paid = rows.find((r) => r.a !== "open");
  fetched = [];
  t = await tool("get_item", { id: paid.u });
  ok(t.res.isError === false && t.data.text === null && /paid/.test(t.data.text_note), "paid listing: card only, no text");
  ok(!fetched.some((u) => /\.md$/.test(u)), "paid listing: no file was read");
  const noFile = rows.find((r) => r.a === "open" && !r.raw);
  t = await tool("get_item", { id: noFile.u });
  ok(t.data.text === null && t.data.item.url.indexOf(noFile.u) > 0, "item without a plain file: card and page address");
  for (const bad of ["/netlify/functions/_free_bodies.json", "/../netlify.toml", "/packs/switchboard-paid.md", "https://example.com/x", "/registered.html", "file:///etc/passwd"]) {
    fetched = [];
    t = await tool("get_item", { id: bad });
    ok(t.res.isError === true && fetched.every((u) => u === "https://botshelfvampire.com" + mcp.INDEX_PATH), "id outside the index reads nothing: " + bad);
  }
  ok(!core.safeRaw("/../x.md") && !core.safeRaw("/a/../x.md") && !core.safeRaw("/a//x.md") && !core.safeRaw("/a/x.md?y=.md") && !core.safeRaw("//evil.example/x.md") && !core.safeRaw("/a/b.json") && !core.safeRaw("https://x/y.md") && core.safeRaw("/library/a/b/body.md"), "file path guard");

  // --- a hostile or broken index cannot widen what is read
  let read = [];
  const fake = core.create({ origin: "https://botshelfvampire.com", now: () => 0,
    loadIndex: async () => ({ rows: [{ u: "/x/", t: "X", a: "open", k: "build", raw: "/../netlify/functions/_free_bodies.json" },
      { u: "/y/", t: "Y", a: "paid", k: "team", raw: "/y.md" }, { u: "https://evil.example/", t: "Z", a: "open", raw: "/z.md" }, null] }),
    loadText: async (p) => { read.push(p); return "secret"; } });
  const fcall = async (name, args) => JSON.parse((await fake.handle(ev(rpc(1, "tools/call", { name, arguments: args })), "k")).body).result;
  let fr = await fcall("get_item", { id: "/x/" });
  ok(fr.structuredContent.text === null && read.length === 0, "unsafe file path in the index is not read");
  fr = await fcall("get_item", { id: "/y/" });
  ok(fr.structuredContent.text === null && read.length === 0, "paid row with a file path is not read");
  fr = await fcall("list_items", {});
  eq(fr.structuredContent.total, 2, "rows that are not site paths are dropped");
  const long = core.create({ origin: "https://botshelfvampire.com", loadIndex: async () => ({ rows: [{ u: "/l/", t: "L", a: "open", k: "build", raw: "/l/body.md" }] }),
    loadText: async () => "x".repeat(core.LIMITS.fileChars + 1) });
  let lr = JSON.parse((await long.handle(ev(rpc(1, "tools/call", { name: "get_item", arguments: { id: "/l/" } })), "k")).body).result;
  ok(lr.isError === true && /too long/.test(lr.content[0].text) && /\/l\/body\.md/.test(lr.content[0].text), "over-long file: said plainly, never cut short as if complete");
  const gone = core.create({ origin: "https://botshelfvampire.com", loadIndex: async () => ({ rows: [{ u: "/g/", t: "G", a: "open", k: "build", raw: "/g/body.md" }] }),
    loadText: async () => { throw new Error("ECONNRESET internal-host"); } });
  lr = JSON.parse((await gone.handle(ev(rpc(1, "tools/call", { name: "get_item", arguments: { id: "/g/" } })), "k")).body).result;
  ok(lr.isError === true && /botshelfvampire\.com\/g\//.test(lr.content[0].text) && !/ECONNRESET|internal-host/.test(lr.content[0].text), "unreadable file: tool error with the page address, no internals");
  const broken = core.create({ origin: "https://botshelfvampire.com", loadIndex: async () => { throw new Error("ENOENT /secret/path"); }, loadText: async () => "" });
  const br = await broken.handle(ev(rpc(1, "tools/call", { name: "list_items", arguments: {} })), "k");
  ok(br.statusCode === 200 && JSON.parse(br.body).result.isError === true && !/secret|ENOENT/.test(br.body), "index failure: tool error without internals");

  // --- callers are limited, in memory, per caller
  let clock = 1000;
  const lim = core.create({ origin: "https://botshelfvampire.com", now: () => clock, loadIndex: async () => ({ rows: [] }), loadText: async () => "" });
  let codes = [];
  for (let i = 0; i < core.LIMITS.perMinute + 1; i++) codes.push((await lim.handle(ev(rpc(i, "ping")), "caller-a")).statusCode);
  ok(codes.slice(0, core.LIMITS.perMinute).every((c) => c === 200) && codes[core.LIMITS.perMinute] === 429, "call " + (core.LIMITS.perMinute + 1) + " in a minute -> 429");
  const limited = await lim.handle(ev(rpc(1, "ping")), "caller-a");
  ok(Number(limited.headers["Retry-After"]) >= 1, "429 carries Retry-After");
  eq((await lim.handle(ev(rpc(1, "ping")), "caller-b")).statusCode, 200, "another caller is not affected");
  // a flood of other callers must not free the limited one, and a full table turns new callers away
  for (let i = 0; i < core.LIMITS.rateKeys + 10; i++) await lim.handle(ev(rpc(1, "ping")), "flood-" + i);
  eq((await lim.handle(ev(rpc(1, "ping")), "caller-a")).statusCode, 429, "a full table does not forget a limited caller");
  eq((await lim.handle(ev(rpc(1, "ping")), "brand-new-caller")).statusCode, 429, "a full table turns a new caller away");
  clock += 60001;
  eq((await lim.handle(ev(rpc(1, "ping")), "caller-a")).statusCode, 200, "the limit clears after a minute");
  eq((await lim.handle(ev(rpc(1, "ping")), "brand-new-caller")).statusCode, 200, "finished windows are dropped, so the table has room again");

  // --- the handler keeps serving the last good index when a refresh fails or returns rubbish
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow() + skew;
  ok((await tool("list_items", {})).data.total === rows.length, "index is loaded");
  skew += mcp.INDEX_TTL + 1000; failNext = 1;
  ok((await tool("list_items", {})).data.total === rows.length, "refresh fails: the last good index is still served");
  skew += 31000; nextBody = JSON.stringify({ rows: null });
  ok((await tool("list_items", {})).data.total === rows.length, "refresh returns a broken index: the good one is kept");
  skew += 31000; nextBody = "<html>not json</html>";
  ok((await tool("list_items", {})).data.total === rows.length, "refresh returns a page instead of JSON: the good one is kept");
  skew += 31000; fetched = [];
  ok((await tool("list_items", {})).data.total === rows.length && fetched.length === 1, "and it looks again half a minute later");
  Date.now = realNow;

  // --- no write path
  const src = String(fs.readFileSync(F("_lib/mcpCore.js"), "utf8")) + String(fs.readFileSync(F("mcp.js"), "utf8"));
  ok(!/require\(["'][^"']*(blobs|engine|session|commerce|license|smtp|notifications|paidBodies|emailVerify)/.test(src), "no store, session, mail or payment module is loaded");
  // (http.ipTag, which these files call, reads the session secret to key the address hash: that is the one indirect read)
  ok(!/_free_bodies|process\.env/.test(src.replace(/\/\/[^\n]*/g, "")), "these two files name no gated file and read no environment value themselves");
  ok(fs.existsSync(path.join(root, "site", mcp.INDEX_PATH)), "the index the handler names exists in the tree");

  console.log(failures ? "FAILED " + failures + " of " + checks : "PASS " + checks + " checks");
  if (failures) process.exit(1);
})().catch((e) => { console.error("ERROR", e && e.stack || e); process.exit(1); });
