// Read-only MCP endpoint (/api/mcp), the function. Offline: fetch is replaced by a reader of the
// tree on disk, so the test never touches the network, a store or real visitor data.
// Usage: node mcp_test.js <tree root holding netlify/ and site/>
// 1.1.0 (2026-11-19): list_filters, whole-word ranking, suggestions, serverInfo fields, the "via" header.
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
  const si = x.j.result.serverInfo;
  eq([si.version, core.SERVER.version], ["1.1.0", "1.1.0"], "server version");
  ok(si.websiteUrl === "https://botshelfvampire.com/mcp/" && fs.existsSync(path.join(root, "site", "mcp", "index.html")), "serverInfo names the page of the site, and the page exists");
  ok(Array.isArray(si.icons) && si.icons.length === 1 && si.icons[0].src === "https://botshelfvampire.com/img/mark.jpg" && si.icons[0].mimeType === "image/jpeg"
    && fs.existsSync(path.join(root, "site", "img", "mark.jpg")), "serverInfo names one icon, and it is a file of the site");
  ok(typeof si.description === "string" && si.description.length >= 40 && /Read-only/.test(si.description) && !/official/i.test(si.description), "serverInfo has a plain description");
  ok(/list_filters/.test(x.j.result.instructions), "instructions name the fourth tool");
  eq(x.r.headers["X-BSV-Via"], "function", "the function says that it answered");
  ok(/X-BSV-Via/.test(x.r.headers["Access-Control-Expose-Headers"]), "a page on another origin may read which place answered");
  const quiet = core.create({ origin: "https://botshelfvampire.com", loadIndex: async () => ({ rows: [] }), loadText: async () => "" });
  ok(!("X-BSV-Via" in (await quiet.handle(ev(rpc(1, "ping")), "k")).headers), "no via given -> no such header");
  const odd = core.create({ origin: "https://botshelfvampire.com", via: "Edge\r\nX-Evil: 1", loadIndex: async () => ({ rows: [] }), loadText: async () => "" });
  ok(!("X-BSV-Via" in (await odd.handle(ev(rpc(1, "ping")), "k")).headers), "a via that is not one short lower-case word is not sent");
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
  eq(tools.map((t) => t.name), ["search_items", "get_item", "list_items", "list_filters"], "four tools");
  ok(tools.every((t) => typeof t.description === "string" && t.description.length > 60 && typeof t.title === "string"), "every tool has a title and a description");
  ok(tools.every((t) => Object.keys(t.inputSchema.properties).every((k) => typeof t.inputSchema.properties[k].description === "string")), "every argument is described");
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

  // --- search: whole words first, the same set as before
  const fields = (r) => [r.t, r.tj, (r.r || []).join(" "), r.c, r.kl, r.d, r.dj, r.x, r.u].filter(Boolean).map((v) => String(v).toLowerCase());
  const holds = (r, w) => fields(r).some((f) => f.indexOf(w) >= 0);
  const atStart = (r, w) => fields(r).some((f) => new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(f));
  const common = ["code", "review", "risk", "ai", "data", "test", "trading", "report", "notes", "team", "email", "search", "plan", "check", "build", "agent"];
  const pairs = [];
  for (let i = 0; i < common.length; i++) pairs.push(common[i] + " " + common[(i * 7 + 3) % common.length]);
  for (const q of ["rsi", "code review", "test", "ai", "meeting notes", "risk ai"].concat(pairs)) {
    const ws = q.split(" ");
    t = await tool("search_items", { query: q, limit: 25 });
    eq(t.data.total, rows.filter((r) => ws.every((w) => holds(r, w))).length, "search \"" + q + "\": the total is every item that holds every word");
    const whole = t.data.items.map((i) => { const r = rows.find((z) => z.u === i.id); return ws.every((w) => atStart(r, w)); });
    ok(whole.indexOf(false) < 0 || whole.slice(whole.indexOf(false)).every((v) => v === false), "search \"" + q + "\": no whole-word match comes after a match inside a longer word");
  }
  const rank = core.create({ origin: "https://botshelfvampire.com", loadText: async () => "", loadIndex: async () => ({ rows: [
    { u: "/a/", t: "PersistentAnti", d: "x", a: "open", k: "trade", r: ["MT5"] }, { u: "/b/", t: "Adaptive RSI Moving Average", d: "x", a: "open", k: "trade", r: ["MT5"] },
    { u: "/c/", t: "Other", d: "uses the rsi of the last bar", a: "open", k: "trade", r: ["MT5"] }, { u: "/d/", t: "会議のメモ", tj: "会議のメモを決定事項に", d: "x", a: "open", k: "team", r: [] }] }) });
  const rcall = async (args) => JSON.parse((await rank.handle(ev(rpc(1, "tools/call", { name: "search_items", arguments: args })), "k")).body).result.structuredContent;
  eq((await rcall({ query: "rsi" })).items.map((i) => i.id), ["/b/", "/c/", "/a/"], "a word in the title, then the word in the description, then a match inside a longer word");
  eq((await rcall({ query: "会議" })).items.map((i) => i.id), ["/d/"], "a Japanese word is found where it stands, without word boundaries");
  eq((await rcall({ query: "RSI" })).total, 3, "matching ignores case");
  const rank2 = core.create({ origin: "https://botshelfvampire.com", loadText: async () => "", loadIndex: async () => ({ rows: [
    { u: "/one/", t: "Risk overlay", d: "makes no claim", a: "open", k: "trade", r: [] }, { u: "/two/", t: "Lab", d: "ai tools for risk work", a: "open", k: "field", r: [] }] }) });
  eq(JSON.parse((await rank2.handle(ev(rpc(1, "tools/call", { name: "search_items", arguments: { query: "risk ai" } })), "k")).body).result.structuredContent.items.map((i) => i.id), ["/two/", "/one/"],
    "an item that holds both words as words comes before one that holds a word only inside another, whatever the field");
  eq((await rcall({ query: "rsi rsi RSI  rsi" })).total, 3, "a word given several times counts once");
  t = await tool("search_items", { query: "a b c d e f g h i j k l m n o p" });
  ok(t.res.isError === false, "sixteen different words are taken");
  t = await tool("search_items", { query: "a b c d e f g h i j k l m n o p q" });
  ok(t.res.isError === true && /16/.test(t.res.content[0].text), "seventeen different words are refused, with the limit named");
  let tq = Date.now();
  t = await tool("search_items", { query: "a ".repeat(98) + "zzzz" });
  ok(t.res.isError === false && t.data.total === 0 && Date.now() - tq < 60, "a 200-character query of one repeated word is cheap (" + (Date.now() - tq) + " ms)");
  tq = Date.now();
  t = await tool("search_items", { query: "ab cd ef gh ij kl mn op qr st uv wx yz ai re zz", limit: 25 });
  ok(t.res.isError === false && Date.now() - tq < 60, "sixteen different words stay cheap (" + (Date.now() - tq) + " ms)");

  // --- search: nothing holds every word
  t = await tool("search_items", { query: "code review zzzzabsentword" });
  ok(t.res.isError === false && t.data.total === 0 && t.data.items.length === 0, "a word nobody holds: still no match");
  ok(t.data.suggestions && t.data.suggestions.items.length > 0 && t.data.suggestions.items.length <= 5 && /2 of the 3 words/.test(t.data.suggestions.note), "the reply offers the items that hold two of the three words");
  ok(t.data.suggestions.items.every((i) => JSON.stringify(i.matched_words) === JSON.stringify(["code", "review"]) && holds(rows.find((r) => r.u === i.id), "code") && holds(rows.find((r) => r.u === i.id), "review")), "each suggestion names the words it holds, and holds them");
  ok(typeof t.data.hint === "string" && /list_filters/.test(t.data.hint), "and a hint names list_filters");
  eq(JSON.parse(t.res.content[0].text), t.data, "text content and structured content agree for a reply with suggestions");
  t = await tool("search_items", { query: "zzzzqqqqxxxx-nothing" });
  ok(t.data.total === 0 && t.data.suggestions === undefined && typeof t.data.hint === "string", "one word nobody holds: a hint, nothing to suggest");
  t = await tool("search_items", { query: "zzzzqq xxxxqq" });
  ok(t.data.total === 0 && t.data.suggestions === undefined, "no word held by anything: nothing to suggest");
  t = await tool("search_items", { query: "code zzzzabsentword", runs_on: "Claude Code", limit: 3 });
  ok(t.data.suggestions && t.data.suggestions.items.length <= 3 && t.data.suggestions.items.every((i) => i.runs_on.indexOf("Claude Code") >= 0), "suggestions keep to the filters and the limit");
  t = await tool("search_items", { query: "code review" });
  ok(t.data.suggestions === undefined && t.data.hint === undefined && t.data.filter_note === undefined, "a search with matches carries no suggestions, hint or note");
  const paidRow = rows.find((r) => r.a !== "open");
  t = await tool("search_items", { query: String(paidRow.t).toLowerCase().split(" ")[0] + " zzzzabsentword", access: "paid" });
  ok(!t.data.suggestions || t.data.suggestions.items.every((i) => i.text_url === null && i.access === "paid"), "a paid listing among the suggestions is a card without a text address");

  // --- a filter value nobody uses
  t = await tool("search_items", { query: "code", runs_on: "No Such Tool" });
  ok(t.data.total === 0 && /runs_on/.test(t.data.filter_note) && /list_filters/.test(t.data.filter_note), "unknown runs_on: the reply says which filter matched nothing");
  t = await tool("list_items", { kind: "nosuchkind", topic: "No Such Topic" });
  ok(t.data.total === 0 && /kind/.test(t.data.filter_note) && /topic/.test(t.data.filter_note), "unknown kind and topic are both named");
  t = await tool("list_items", { topic: "Research" });
  ok(t.data.total > 0 && t.data.filter_note === undefined, "a filter in use carries no note");
  t = await tool("list_items", { kind: "guide", runs_on: "Claude Code" });
  ok(t.data.filter_note === undefined, "two values that are both in use but never together: empty list, no note");

  // --- list_filters
  t = await tool("list_filters", {});
  const lf = t.data;
  ok(t.res.isError === false && lf.total === rows.length && lf.kind === null, "list_filters counts the whole shelf");
  eq(lf.kinds.reduce((n, k) => n + k.items, 0), rows.length, "kind counts add up to the shelf");
  ok(lf.kinds.every((k, i) => i === 0 || lf.kinds[i - 1].items >= k.items) && lf.runs_on.every((v, i) => i === 0 || lf.runs_on[i - 1].items >= v.items), "most used first");
  ok(lf.kinds.every((k) => k.items === rows.filter((r) => r.k === k.kind).length && k.types.reduce((n, y) => n + y.items, 0) === rows.filter((r) => r.k === k.kind && r.kl).length), "each kind's count and its type labels are the index's");
  ok(lf.runs_on.length > 10 && lf.runs_on.every((v) => v.items === rows.filter((r) => (r.r || []).indexOf(v.value) >= 0).length), "each where-it-runs name has its count");
  ok(lf.topics.length > 10 && lf.topics.every((v) => v.value && v.items === rows.filter((r) => r.c === v.value).length), "each topic has its count; items without a topic are not listed as one");
  eq([lf.access.open, lf.access.paid, lf.check_recorded], [rows.filter((r) => r.a === "open").length, rows.filter((r) => r.a !== "open").length, rows.filter((r) => r.v === 1).length], "open, paid and checked counts");
  for (const v of lf.runs_on.slice(0, 4).concat(lf.runs_on.slice(-2))) {
    eq((await tool("list_items", { runs_on: v.value, limit: 1 })).data.total, v.items, "the runs_on filter takes the listed value as it is: " + v.value);
  }
  for (const v of lf.topics.slice(0, 3).concat(lf.topics.slice(-2))) {
    eq((await tool("list_items", { topic: v.value, limit: 1 })).data.total, v.items, "the topic filter takes the listed value as it is: " + v.value);
  }
  for (const k of lf.kinds) eq((await tool("list_items", { kind: k.kind, limit: 1 })).data.total, k.items, "the kind filter takes the listed value as it is: " + k.kind);
  t = await tool("list_filters", { kind: "build" });
  ok(t.data.total === rows.filter((r) => r.k === "build").length && t.data.kind === "build" && t.data.kinds.length === lf.kinds.length
    && t.data.runs_on.every((v) => v.items === rows.filter((r) => r.k === "build" && (r.r || []).indexOf(v.value) >= 0).length), "with a kind: the counts are of that kind, the kinds stay those of the shelf");
  t = await tool("list_filters", { kind: "nosuchkind" });
  ok(t.res.isError === true && /team/.test(t.res.content[0].text) && /build/.test(t.res.content[0].text), "unknown kind: a tool error that lists the kinds");
  t = await tool("list_filters", { query: "x" });
  ok(t.res.isError === true, "list_filters takes no other argument");
  for (const odd of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    t = await tool("list_filters", { kind: odd });
    ok(t.res.isError === true && /The kinds are/.test(t.res.content[0].text), "a name every object inherits is not a kind: " + odd);
  }
  ok(JSON.stringify(lf).length < 20000, "the whole list stays small (" + JSON.stringify(lf).length + " characters)");

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

  // --- the body may be handed over as a function, read only when the checks before it have passed
  let asked = 0;
  const lazy = core.create({ origin: "https://botshelfvampire.com", loadIndex: async () => ({ rows: [] }), loadText: async () => "" });
  const lev = (body, headers) => ({ httpMethod: "POST", headers: Object.assign({ "content-type": "application/json" }, headers || {}), body: body });
  let lr2 = await lazy.handle(lev(async () => { asked++; return JSON.stringify(rpc(1, "ping")); }), "lz");
  eq([lr2.statusCode, JSON.parse(lr2.body).result, asked], [200, {}, 1], "a body given as a function is read and answered");
  lr2 = await lazy.handle(lev(async () => { asked++; return "{}"; }, { "content-type": "text/plain" }), "lz");
  eq([lr2.statusCode, asked], [415, 1], "wrong content type: answered without the body being read");
  lr2 = await lazy.handle(lev(async () => { asked++; return "{}"; }, { origin: "not-an-origin" }), "lz");
  eq([lr2.statusCode, asked], [403, 1], "bad Origin: answered without the body being read");
  for (let i = 0; i < core.LIMITS.perMinute; i++) await lazy.handle(lev(JSON.stringify(rpc(i, "ping"))), "lz-limited");
  lr2 = await lazy.handle(lev(async () => { asked++; return "{}"; }), "lz-limited");
  eq([lr2.statusCode, asked], [429, 1], "a caller over the limit is answered without the body being read");
  lr2 = await lazy.handle(lev(async () => { const e = new Error("slow"); e.tooSlow = true; throw e; }), "lz2");
  eq(lr2.statusCode, 408, "a body that takes too long -> 408");
  lr2 = await lazy.handle(lev(async () => { throw new Error("stream broke"); }), "lz2");
  eq([lr2.statusCode, JSON.parse(lr2.body).error.code], [400, -32700], "a body that cannot be read -> parse error");
  lr2 = await lazy.handle(lev(async () => ({ text: JSON.stringify(rpc(1, "ping")), bytes: core.LIMITS.bodyBytes + 1 })), "lz3");
  eq(lr2.statusCode, 413, "a body that says it was over the limit on the wire -> 413, whatever its text");
  lr2 = await lazy.handle(lev(async () => ({ text: JSON.stringify(rpc(1, "ping", { x: "\ufffd".repeat(11000) })), bytes: 11058 })), "lz3");
  eq(lr2.statusCode, 200, "a body within the limit on the wire is taken, though its decoded text is longer than the limit in bytes");
  lr2 = await lazy.handle(lev(async () => ({ text: "{}", bytes: "12" })), "lz3");
  eq(lr2.statusCode, 400, "a body object without a number of bytes is not taken as a body");
  let threw = null;
  try { await lazy.handle(lev(async () => { const e = new Error("x"); e.passOn = true; throw e; }), "lz2"); } catch (e) { threw = e; }
  ok(threw && threw.passOn === true, "a body error marked to be passed on leaves handle()");

  // --- where a second place stands behind this one, an unreadable file is passed on instead of answered
  const front = core.create({ origin: "https://botshelfvampire.com", passFailures: true, loadIndex: async () => ({ rows: [{ u: "/g/", t: "G", a: "open", k: "build", raw: "/g/body.md" }] }),
    loadText: async () => { throw new Error("ECONNRESET"); } });
  threw = null;
  try { await front.handle(ev(rpc(1, "tools/call", { name: "get_item", arguments: { id: "/g/" } })), "k"); } catch (e) { threw = e; }
  ok(threw && threw.passOn === true && !/ECONNRESET/.test(String(threw.message)), "passFailures: the failure leaves handle() marked, without internals");
  const frontOk = await front.handle(ev(rpc(1, "tools/call", { name: "get_item", arguments: { id: "/nope/" } })), "k");
  ok(frontOk.statusCode === 200 && JSON.parse(frontOk.body).result.isError === true, "passFailures: a wrong id is still an ordinary tool error");

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
