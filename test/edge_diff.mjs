// The edge function against the function, request by request (round 03; since round 04 the edge answers every call;
// since round 06 it holds the item texts and requests nothing).
//   node edge_diff.mjs <tree>          (also runs under bun)
// Both are loaded from the tree and get the same requests; every reply must be the same in status, headers and
// body, except for the header that says which of the two answered. Every text the edge code holds is read through
// both. Nothing leaves the machine: the function's reads of https://botshelfvampire.com/... are answered from the
// tree's files, and a request made while the edge code is at work is counted (there must be none).
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const tree = path.resolve(process.argv[2] || ".");
process.env.COMMERCE_SESSION_SECRET = "edge-diff-test-not-a-real-one";

const ORIGIN = "https://botshelfvampire.com";
let fetched = [], mdFails = false, mdHuge = false;
globalThis.fetch = async function (url) {
  const u = String(url);
  fetched.push(u);
  if (/\.md$/.test(u) && mdFails) throw new Error("network down (test)");
  if (/\.md$/.test(u) && mdHuge) return new Response("x".repeat(4000001), { status: 200 });
  if (u.indexOf(ORIGIN + "/") !== 0) throw new Error("test: request outside the site refused: " + u);
  const file = path.join(tree, "site", decodeURIComponent(u.slice(ORIGIN.length).split("?")[0]));
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("not found", { status: 404 });
  return new Response(fs.readFileSync(file), { status: 200 });
};

const fn = require(path.join(tree, "netlify", "functions", "mcp.js"));
const core = require(path.join(tree, "netlify", "functions", "_lib", "mcpCore.js"));
const edgeModule = await import(pathToFileURL(path.join(tree, "netlify", "edge-functions", "mcp-edge.js")).href);
// The edge code answers every request that does not ask for the function (header "X-BSV-Edge: off").
const edge = { config: edgeModule.config, default: function (request, context) { return edgeModule.default(request, context); } };
let unhandled = 0;
process.on("unhandledRejection", function () { unhandled++; });
const index = JSON.parse(fs.readFileSync(path.join(tree, "site", fn.INDEX_PATH), "utf8"));
const rows = index.rows;

let checks = 0, failures = 0, ipN = 0, compared = 0, edgeAsked = 0;
const ok = (c, m) => { checks++; if (!c) { failures++; if (failures <= 25) console.error("FAIL", m); } };
const freshIp = () => "198.51.100." + (++ipN % 250) + "-" + ipN;
const lower = (h) => { const o = {}; Object.keys(h || {}).forEach((k) => { o[k.toLowerCase()] = String(h[k]); }); return o; };

// one request, put to both; returns the two replies in one shape
async function both(method, headers, body, ip) {
  ip = ip || freshIp();
  const fr = await fn.handler({ httpMethod: method, headers: Object.assign({ "x-nf-client-connection-ip": ip }, headers), body: body, isBase64Encoded: false });
  const init = { method: method, headers: headers };
  if (body !== undefined && method !== "GET" && method !== "HEAD") init.body = body;
  const before = fetched.length; // the function has answered by now: what is asked for from here on, the edge code asks for
  const er = await edge.default(new Request(ORIGIN + "/api/mcp", init), { ip: ip });
  edgeAsked += fetched.length - before;
  const eh = {};
  if (er) er.headers.forEach((v, k) => { eh[k] = v; });
  return {
    f: { status: fr.statusCode, headers: lower(fr.headers), body: fr.body || "" },
    e: er ? { status: er.status, headers: eh, body: await er.text() } : null
  };
}

function same(x, label) {
  compared++;
  if (!x.e) { ok(false, label + ": the edge function stepped aside"); return; }
  const fh = Object.assign({}, x.f.headers), eh = Object.assign({}, x.e.headers);
  ok(fh["x-bsv-via"] === "function" && eh["x-bsv-via"] === "edge", label + ": each says which place answered (" + fh["x-bsv-via"] + ", " + eh["x-bsv-via"] + ")");
  delete fh["x-bsv-via"]; delete eh["x-bsv-via"]; // the one header that is meant to differ; every other header is compared
  ok(x.f.status === x.e.status, label + ": status " + x.f.status + " / " + x.e.status);
  ok(JSON.stringify(Object.keys(fh).sort().map((k) => [k, fh[k]])) === JSON.stringify(Object.keys(eh).sort().map((k) => [k, eh[k]])),
    label + ": headers differ: " + JSON.stringify(fh) + " / " + JSON.stringify(eh));
  ok(x.f.body === x.e.body, label + ": bodies differ: " + x.f.body.slice(0, 120) + " / " + x.e.body.slice(0, 120));
}

const J = { "content-type": "application/json" };
const rpc = (id, method, params) => JSON.stringify(params === undefined ? { jsonrpc: "2.0", id, method } : { jsonrpc: "2.0", id, method, params });
const call = (name, args) => rpc(7, "tools/call", { name, arguments: args });

// --- transport and lifecycle
same(await both("OPTIONS", {}, undefined), "OPTIONS");
same(await both("GET", {}, undefined), "GET");
same(await both("DELETE", {}, undefined), "DELETE");
same(await both("POST", { "content-type": "text/plain" }, "{}"), "wrong content type");
same(await both("POST", J, "{not json"), "bad JSON");
same(await both("POST", J, JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }])), "batch");
same(await both("POST", J, JSON.stringify({ id: 1, method: "ping" })), "missing jsonrpc");
same(await both("POST", J, JSON.stringify({ jsonrpc: "2.0", id: null, method: "ping" })), "null id");
same(await both("POST", J, JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })), "notification");
same(await both("POST", J, JSON.stringify({ jsonrpc: "2.0", id: 3, result: {} })), "client response");
same(await both("POST", J, "x".repeat(32769)), "oversize body");
same(await both("POST", J, JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { x: "あ".repeat(12000) } })), "oversize in bytes, not characters");
for (const id of [1.5, true, {}, [], "abc", 0, -3]) same(await both("POST", J, JSON.stringify({ jsonrpc: "2.0", id: id, method: "ping" })), "id " + JSON.stringify(id));
same(await both("POST", Object.assign({ origin: "not-an-origin" }, J), rpc(1, "ping")), "malformed Origin");
same(await both("POST", Object.assign({ origin: "https://example.com" }, J), rpc(1, "ping")), "a web origin");
same(await both("POST", Object.assign({ origin: "null" }, J), rpc(1, "ping")), "Origin null");
same(await both("POST", Object.assign({ "mcp-protocol-version": "garbage" }, J), rpc(1, "ping")), "bad protocol header");
same(await both("POST", Object.assign({ "mcp-protocol-version": "2025-06-18" }, J), rpc(1, "ping")), "good protocol header");
for (const v of ["2025-11-25", "2025-06-18", "2025-03-26", "1999-01-01"]) {
  same(await both("POST", J, rpc("a", "initialize", { protocolVersion: v, capabilities: {}, clientInfo: { name: "t", version: "0" } })), "initialize " + v);
}
same(await both("POST", J, rpc(2, "initialize", {})), "initialize without a version");
same(await both("POST", J, rpc(2, "initialize")), "initialize without params");
same(await both("POST", J, JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping", params: false })), "params not structured");
same(await both("POST", J, rpc(4, "tools/list")), "tools/list");
same(await both("POST", J, rpc(4, "resources/list")), "undeclared capability");
same(await both("POST", J, rpc(4, "prompts/list")), "undeclared capability 2");

// --- the tools, with good and bad arguments
const openRow = rows.find((r) => r.k === "build" && r.raw), paidRow = rows.find((r) => r.a !== "open"), noFile = rows.find((r) => r.a === "open" && !r.raw);
const toolCases = [
  ["search_items", { query: "code review" }], ["search_items", { query: "code review", limit: 3, runs_on: "claude code" }], ["search_items", { query: "RSI", limit: 25 }],
  ["search_items", { query: "zzzzqqqqxxxx-nothing" }], ["search_items", { query: "code review zzzzabsentword" }], ["search_items", { query: "a", limit: 26 }],
  ["search_items", { query: "y".repeat(201) }], ["search_items", {}], ["search_items", { query: "x", shell: "rm -rf" }], ["search_items", { query: 5 }],
  ["search_items", { query: "会議" }], ["search_items", { query: "code", runs_on: "No Such Tool" }], ["search_items", { query: "meeting", kind: "team", access: "open", checked: true }],
  ["search_items", { query: "  spaced   words  " }], ["search_items", { query: "code", topic: "Coding", limit: 1 }], ["search_items", { query: "switchboard", access: "paid" }],
  ["list_items", {}], ["list_items", { kind: "toolkit", limit: 5 }], ["list_items", { kind: "toolkit", limit: 5, offset: 5 }], ["list_items", { access: "paid", limit: 25 }],
  ["list_items", { offset: rows.length + 5 }], ["list_items", { kind: "nosuchkind", topic: "No Such Topic" }], ["list_items", { limit: 0 }], ["list_items", { offset: -1 }],
  ["list_items", { checked: true, limit: 3 }], ["list_items", { checked: "yes" }], ["list_items", { runs_on: "Grok Bot", topic: "Research" }],
  ["list_filters", {}], ["list_filters", { kind: "build" }], ["list_filters", { kind: "nosuchkind" }], ["list_filters", { query: "x" }],
  ["list_filters", { kind: "__proto__" }], ["list_filters", { kind: "constructor" }], ["search_items", { query: "risk ai", limit: 5 }],
  ["search_items", { query: "a ".repeat(98) + "zzzz" }], ["search_items", { query: "a b c d e f g h i j k l m n o p q" }], ["search_items", { query: "ab cd ef gh ij kl mn op qr st uv wx yz ai re zz" }],
  ["get_item", { id: openRow.u }], ["get_item", { id: ORIGIN + openRow.u + "?lang=ja" }], ["get_item", { id: openRow.u, max_chars: 500 }], ["get_item", { id: openRow.u, max_chars: 500, offset: 500 }],
  ["get_item", { id: openRow.u, max_chars: 499 }], ["get_item", { id: openRow.u, offset: 99999999 }], ["get_item", { id: paidRow.u }], ["get_item", { id: noFile.u }],
  ["get_item", { id: "/netlify/functions/_free_bodies.json" }], ["get_item", { id: "/../netlify.toml" }], ["get_item", { id: "https://example.com/x" }], ["get_item", {}],
  ["delete_everything", {}], [7, {}], [null, {}]
];
for (const [name, args] of toolCases) same(await both("POST", J, call(name, args)), "tools/call " + JSON.stringify(name) + " " + JSON.stringify(args).slice(0, 70));
same(await both("POST", J, rpc(9, "tools/call", ["search_items"])), "positional params");

// --- many searches made from the shelf's own words: the same answers, in the same order
let seed = 20261119;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const vocab = [];
rows.forEach((r) => String(r.t + " " + (r.d || "")).toLowerCase().split(/[^a-z0-9぀-ヿ一-鿿]+/).forEach((w) => { if (w.length > 1 && vocab.length < 6000) vocab.push(w); }));
const kinds = Array.from(new Set(rows.map((r) => r.k))), runs = Array.from(new Set(rows.flatMap((r) => r.r || [])));
let withHits = 0, withSuggestions = 0;
for (let i = 0; i < 400; i++) {
  const n = 1 + rnd(3), words = [];
  for (let k = 0; k < n; k++) words.push(vocab[rnd(vocab.length)]);
  const args = { query: words.join(" "), limit: 1 + rnd(25) };
  if (rnd(5) === 0) args.kind = kinds[rnd(kinds.length)];
  if (rnd(6) === 0) args.runs_on = runs[rnd(runs.length)];
  const x = await both("POST", J, call("search_items", args));
  same(x, "random search " + JSON.stringify(args));
  const d = JSON.parse(x.f.body).result.structuredContent;
  if (d.total) withHits++;
  if (d.suggestions) withSuggestions++;
}
ok(withHits > 100 && withSuggestions > 20, "the random searches covered matches (" + withHits + ") and suggestions (" + withSuggestions + ")");
for (let i = 0; i < 60; i++) {
  const r = rows[rnd(rows.length)];
  same(await both("POST", J, call("get_item", { id: r.u, max_chars: 500 + rnd(3000), offset: rnd(4) === 0 ? rnd(2000) : 0 })), "random get_item " + r.u);
}

// --- the limit of 60 calls a minute, counted per caller in each place. The clock is held here: it stands still while
// this caller makes its 61 calls, so that both places count the same minute and name the same wait in Retry-After;
// then it is moved on by hand, to see the wait get shorter and the limit end with the minute, in both places.
const ip = "198.51.100.77-limit";
let codes = [];
const realNow = Date.now;
let clock = Date.now();
Date.now = () => clock;
try {
  for (let i = 0; i < 61; i++) { const x = await both("POST", J, rpc(i, "ping"), ip); codes.push([x.f.status, x.e.status]); if (i === 60) { same(x, "call 61"); ok(x.f.headers["retry-after"] === "60" && x.e.headers["retry-after"] === "60", "call 61: both name the wait (" + x.f.headers["retry-after"] + ", " + x.e.headers["retry-after"] + ")"); } }
  clock += 1001;
  const later = await both("POST", J, rpc(61, "ping"), ip);
  same(later, "call 62, a second later");
  ok(later.f.status === 429 && later.f.headers["retry-after"] === "59" && later.e.headers["retry-after"] === "59", "a second later both still refuse, and name a wait one second shorter (" + later.f.headers["retry-after"] + ", " + later.e.headers["retry-after"] + ")");
  clock += 59000;
  const after = await both("POST", J, rpc(62, "ping"), ip);
  same(after, "the call after the minute");
  ok(after.f.status === 200 && after.e.status === 200, "once the minute is over the caller is let in again, in both places (" + after.f.status + ", " + after.e.status + ")");
} finally {
  Date.now = realNow;
}
ok(codes.slice(0, 60).every((c) => c[0] === 200 && c[1] === 200) && codes[60][0] === 429 && codes[60][1] === 429, "60 calls pass and the 61st is refused, in both places");
const other = await both("POST", J, rpc(1, "ping"));
ok(other.f.status === 200 && other.e.status === 200, "another caller is not affected");

// --- the same bytes with a byte-order mark in front: refused as JSON in both places, and counted before decoding
const bom = "\uFEFF" + rpc(1, "ping");
same(await both("POST", J, bom), "byte-order mark before the JSON");
same(await both("POST", J, "\uFEFF" + rpc(1, "ping") + " ".repeat(32769 - 3 - Buffer.byteLength(rpc(1, "ping")))), "32,769 bytes with a byte-order mark");
const fb = await fn.handler({ httpMethod: "POST", headers: Object.assign({ "x-nf-client-connection-ip": freshIp() }, J), body: Buffer.from(bom, "utf8").toString("base64"), isBase64Encoded: true });
ok(fb.statusCode === 400, "the function refuses the same bytes when they arrive base64-encoded (" + fb.statusCode + ")");

// --- a body that never ends, a caller over the limit, a body that never comes
const endless = (counter) => new ReadableStream({ pull(c) { counter.n += 65536; c.enqueue(new Uint8Array(65536).fill(32)); } });
let pulled = { n: 0 };
let r1 = await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: endless(pulled), duplex: "half" }), { ip: freshIp() });
ok(r1 && r1.status === 413 && pulled.n <= 6 * 65536, "a body without a declared length is refused at the limit, not read to its end (" + (r1 && r1.status) + ", " + pulled.n + " bytes pulled)");
const lip = "198.51.100.88-limited";
for (let i = 0; i < 60; i++) await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: rpc(i, "ping") }), { ip: lip });
pulled = { n: 0 };
let tA = performance.now();
r1 = await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: endless(pulled), duplex: "half" }), { ip: lip });
ok(r1 && r1.status === 429 && performance.now() - tA < 500 && pulled.n <= 2 * 65536, "a caller over the limit is answered at once, and its body is not read (" + (r1 && r1.status) + ", " + pulled.n + " bytes pulled)");
const realST = globalThis.setTimeout;
globalThis.setTimeout = function (f, ms) { return realST(f, ms >= 5000 ? 60 : ms); }; // the five seconds a body may take, shortened for the test
tA = performance.now();
r1 = await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: new ReadableStream({ pull() { return new Promise(() => {}); } }), duplex: "half" }), { ip: freshIp() });
globalThis.setTimeout = realST;
ok(r1 && r1.status === 408 && performance.now() - tA < 2000, "a body that never comes: 408 when the time is up (" + (r1 && r1.status) + ")");

// --- the site's files out of reach: the edge code holds the texts and still answers; the function, which reads the file, cannot
const cold = rows.filter((r) => r.k === "grokbot" && r.raw)[5];
mdFails = true;
let ex = await both("POST", J, call("get_item", { id: cold.u }));
ok(ex.e && ex.e.status === 200 && JSON.parse(ex.e.body).result.isError === false && ex.f.status === 200 && JSON.parse(ex.f.body).result.isError === true,
  "the item files out of reach: the edge code answers from the text it holds (the function, without the file, says it could not read it)");
mdFails = false;
ex = await both("POST", J, call("get_item", { id: cold.u }));
ok(ex.e && ex.e.status === 200 && JSON.parse(ex.e.body).result.isError === false && ex.f.body === ex.e.body, "and once the file can be read again, both answer with the same text");
mdHuge = true;
const cold2 = rows.filter((r) => r.k === "grokbot" && r.raw)[6];
ex = await both("POST", J, call("get_item", { id: cold2.u }));
ok(ex.e && JSON.parse(ex.e.body).result.isError === false && JSON.parse(ex.f.body).result.isError === true, "a file that comes back far too large: the edge code does not ask for it and answers; the function says it could not read it");
mdHuge = false;

// --- every text the edge code holds: read whole through both places, and held against the file itself
const src = fs.readFileSync(path.join(tree, "netlify", "edge-functions", "mcp-edge.js"), "utf8");
// where the data stand in the file: three string literals. Each is found by its declaration, which must be there once,
// and read as a literal: from its opening quote to the first quote that no backslash escapes, with no line break inside,
// and with nothing after it on its line but the end of the declaration.
function literal(open, close) {
  const a = src.indexOf(open);
  if (a < 0 || src.indexOf(open, a + 1) >= 0 || src[a + open.length] !== '"') return null;
  for (let i = a + open.length + 1; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (c === 92) { const d = src.charCodeAt(i + 1); if (!(d >= 0) || d === 10 || d === 13) return null; i++; }
    else if (c === 10 || c === 13) return null;
    else if (c === 34) return src.startsWith(close, i + 1) ? [a + open.length, i + 1] : null;
  }
  return null;
}
const idxSpan = literal("\nconst INDEX = JSON.parse(", ");\n");
const atSpan = literal("\nconst TEXT = JSON.parse(", ");\n");
const allSpan = literal("\nconst TEXT_ALL = ", ";\n");
const tableLit = atSpan ? src.slice(atSpan[0], atSpan[1]) : '"{}"';
const table = Object.assign({ at: {}, chars: -1, files: -1 }, JSON.parse(JSON.parse(tableLit)));
ok(idxSpan && atSpan && allSpan && idxSpan[1] < atSpan[0] && atSpan[1] < allSpan[0] && JSON.parse(src.slice(allSpan[0], allSpan[1])).length === table.chars,
  "the edge file holds the index, one table of texts and one string of texts, in that order, and the string is of the length the table gives (" + table.chars + " characters)");
const withText = rows.filter((r) => r.a === "open" && core.safeRaw(r.raw) && fs.existsSync(path.join(tree, "site", r.raw)));
const held = Object.keys(table.at);
ok(withText.length > 0 && held.length === withText.length && table.files === held.length && withText.every((r) => Object.prototype.hasOwnProperty.call(table.at, r.raw)),
  "the edge file holds a text for every open item that has a text file, and for nothing else (" + held.length + " held, " + withText.length + " such items)");
ok(rows.every((r) => r.a === "open" || !r.raw || !Object.prototype.hasOwnProperty.call(table.at, r.raw)), "no text of a paid listing is held");
const spans = held.map((k) => table.at[k]).sort((a, b) => a[0] - b[0]);
let end = 0, tidy = spans.every((s) => Array.isArray(s) && s.length === 2 && Number.isInteger(s[0]) && Number.isInteger(s[1]) && s[1] > 0);
for (const s of spans) { if (s[0] !== end) tidy = false; end = s[0] + s[1]; }
ok(tidy && end === table.chars, "the table of texts has no gap and no overlap, and ends where the string of texts ends (" + end + " characters)");
let parts = 0;
for (const r of withText) {
  const file = fs.readFileSync(path.join(tree, "site", r.raw), "utf8");
  // a text longer than one call returns is read on, part after part, until there is no next part
  let offset = 0, whole = "", total = -1, read = true;
  for (let n = 0; offset !== null && n < 50; n++) {
    const x = await both("POST", J, call("get_item", offset ? { id: r.u, max_chars: 60000, offset: offset } : { id: r.u, max_chars: 60000 }));
    same(x, "held text " + r.u + (offset ? " from " + offset : ""));
    parts++;
    const d = x.e ? JSON.parse(x.e.body).result.structuredContent : null;
    if (!d || typeof d.text !== "string") { read = false; break; }
    whole += d.text; total = d.total_chars; offset = d.next_offset;
  }
  ok(read && offset === null && whole === file && total === file.length, "held text " + r.u + ": the edge code returns the file's text, whole");
}

// --- bytes that are not valid UTF-8: counted as they came, in both places
const rawBytes = Buffer.concat([Buffer.from('{"jsonrpc":"2.0","id":1,"method":"ping","params":{"x":"'), Buffer.alloc(11000, 0xff), Buffer.from('"}}')]);
const fu = await fn.handler({ httpMethod: "POST", headers: Object.assign({ "x-nf-client-connection-ip": freshIp() }, J), body: rawBytes.toString("base64"), isBase64Encoded: true });
const eu = await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: rawBytes }), { ip: freshIp() });
ok(fu.statusCode === 200 && eu && eu.status === 200 && fu.body === (await eu.text()), "11,058 bytes that decode to more characters than bytes: both places count the bytes and answer alike (" + fu.statusCode + ", " + (eu && eu.status) + ")");

// --- a stream that refuses to be cancelled must not leave an unhandled rejection behind
const stubborn = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(20000)); }, cancel() { return Promise.reject(new Error("cancel failed")); } });
const sreq = new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: stubborn, duplex: "half" });
const sres = await edge.default(sreq, { ip: freshIp() });
await sreq.body.cancel().catch(() => {});
await new Promise((r) => setTimeout(r, 50));
ok(sres && sres.status === 413 && unhandled === 0, "a stream that refuses to be cancelled: 413, and no unhandled rejection (" + unhandled + ")");

// --- the way back: a request that says "X-BSV-Edge: off" is not answered at the edge, whatever its method
for (const m of ["POST", "GET", "OPTIONS"]) {
  const init = { method: m, headers: Object.assign({ "x-bsv-edge": "off" }, J) };
  if (m === "POST") init.body = rpc(1, "ping");
  ok((await edgeModule.default(new Request(ORIGIN + "/api/mcp", init), { ip: freshIp() })) === undefined, "off: " + m + " with the header goes on to the function");
}
const tried = await edgeModule.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: Object.assign({ "x-bsv-edge": "try" }, J), body: rpc(1, "ping") }), { ip: freshIp() });
ok(tried && tried.status === 200 && tried.headers.get("x-bsv-via") === "edge", "any other value of the header changes nothing: the edge answers");

// --- the edge function alone
const big = await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: Object.assign({ "content-length": "9999999" }, J), body: rpc(1, "ping") }), { ip: freshIp() });
ok(big.status === 413, "a declared length far over the limit is refused without reading the body (" + big.status + ")");
const broken = { method: "POST", headers: new Headers(J), clone() { throw new Error("stream gone"); } };
ok((await edgeModule.default(broken, { ip: freshIp() })) === undefined, "when something throws, the edge function steps aside (returns nothing) so that the function answers");
const noIp = await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: rpc(1, "ping") }), {});
ok(noIp.status === 200, "no address given: still answered");
ok(JSON.stringify(edge.config) === JSON.stringify({ path: "/api/mcp", onError: "bypass" }), "config: the one path, and errors pass the request on");
fetched = [];
await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: call("search_items", { query: "code review" }) }), { ip: freshIp() });
await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: call("list_filters", {}) }), { ip: freshIp() });
ok(fetched.length === 0, "searching and listing read no file at the edge (" + fetched.length + " requests)");
const alone = await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: call("get_item", { id: openRow.u }) }), { ip: freshIp() });
ok(alone && alone.status === 200 && JSON.parse(await alone.text()).result.structuredContent.text.length > 0 && fetched.length === 0, "get_item reads no file at the edge either: the text comes from the edge file (" + fetched.length + " requests)");
ok(edgeAsked === 0, "in every request above that was put to both, the edge code asked for nothing (" + edgeAsked + " requests)");
// the code: the whole file but for the three literals (what stands between them stays), comments included. Nothing is
// taken out before the words below are looked for: telling a comment from two slashes inside a string, a block comment
// or a template literal would take a parser, and what was taken out by mistake could hide code. The comments of the
// file do not use these words.
const code = idxSpan && atSpan && allSpan ? src.slice(0, idxSpan[0]) + src.slice(idxSpan[1], atSpan[0]) + src.slice(atSpan[1], allSpan[0]) + src.slice(allSpan[1]) : src;
const bare = code;
ok(src.indexOf("\r") < 0, "the edge file has no carriage return: its lines end the way the checks expect");
ok(code.length < 80000 && code.indexOf("\nconst INDEX = JSON.parse();\n") > 0 && code.indexOf("\nconst TEXT = JSON.parse();\nconst TEXT_ALL = ;\nconst TEXT_OK = TEXT_ALL.length === TEXT.chars;\n") > 0,
  "the edge file without its three literals is code only (" + code.length + " characters)");
ok(!/process\.env|Netlify\.env|Deno\.|require\(|import\s*\(|from\s+["']|localStorage|document\.|eval\(|new Function/.test(bare), "the edge file reads no environment value, loads no module and builds no code");
ok(/\nconst ANSWER_ALL = true;\n/.test(code) && code.indexOf('if (asked === "off" || (!ANSWER_ALL && asked !== "try")) return undefined;') > 0, "the edge file answers every call and steps aside when asked to");
ok(!/\bfetch\b|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bcaches\b|\.connect\(|\bopen\(/.test(bare), "the edge file makes no request of any kind");

// --- a text that is not held, and a string of texts of another length than its table: the edge code steps aside for the function
async function variant(change, name) {
  const text = change(src);
  const file = path.join(os.tmpdir(), "bsv-edge-" + name + "-" + process.pid + ".mjs");
  fs.writeFileSync(file, text);
  try { return { text: text, mod: await import(pathToFileURL(file).href) }; } finally { fs.unlinkSync(file); }
}
const lit = (o) => JSON.stringify(JSON.stringify(o)).replace(/[\u007f-\uffff]/g, (c) => "\\u" + ("000" + c.charCodeAt(0).toString(16)).slice(-4));
const askEdge = (mod, body) => mod.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: body }), { ip: freshIp() });
const less = JSON.parse(JSON.stringify(table));
delete less.at[cold.raw];
less.files--;
const v1 = await variant((s) => s.slice(0, atSpan[0]) + lit(less) + s.slice(atSpan[1]), "less");
fetched = [];
ok(v1.text !== src && (await askEdge(v1.mod, call("get_item", { id: cold.u }))) === undefined && fetched.length === 0, "a text the edge file does not hold: the edge code steps aside and asks for nothing");
let vr = await askEdge(v1.mod, call("get_item", { id: openRow.u }));
ok(vr && vr.status === 200 && JSON.parse(await vr.text()).result.isError === false, "and still answers for a text it holds");
const longer = JSON.parse(JSON.stringify(table));
longer.chars++;
const v2 = await variant((s) => s.slice(0, atSpan[0]) + lit(longer) + s.slice(atSpan[1]), "length");
ok(v2.text !== src && (await askEdge(v2.mod, call("get_item", { id: openRow.u }))) === undefined && (await askEdge(v2.mod, call("get_item", { id: cold.u }))) === undefined && fetched.length === 0,
  "a string of texts of another length than its table says: no text is taken from it, the edge code steps aside");
vr = await askEdge(v2.mod, call("search_items", { query: "code review" }));
const vp = await askEdge(v2.mod, call("get_item", { id: paidRow.u }));
ok(vr && vr.status === 200 && JSON.parse(await vr.text()).result.isError === false && vp && vp.status === 200 && JSON.parse(await vp.text()).result.structuredContent.text === null,
  "and it still answers what needs no text: a search, and the card of a paid listing");

// --- the switch thrown back (ANSWER_ALL false), as during the trial: only a request that asks with "X-BSV-Edge: try" is answered
const backSrc = src.replace("\nconst ANSWER_ALL = true;\n", "\nconst ANSWER_ALL = false;\n");
const backFile = path.join(os.tmpdir(), "bsv-edge-back-" + process.pid + ".mjs");
fs.writeFileSync(backFile, backSrc);
let back;
try { back = await import(pathToFileURL(backFile).href); } finally { fs.unlinkSync(backFile); }
ok(backSrc !== src && back && typeof back.default === "function", "the same file with the switch thrown back loads");
for (const m of ["POST", "GET", "OPTIONS"]) {
  const init = { method: m, headers: J };
  if (m === "POST") init.body = rpc(1, "ping");
  ok((await back.default(new Request(ORIGIN + "/api/mcp", init), { ip: freshIp() })) === undefined, "switch back: " + m + " without the header goes on to the function");
}
for (const v of ["yes", "off"]) {
  ok((await back.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: Object.assign({ "x-bsv-edge": v }, J), body: rpc(1, "ping") }), { ip: freshIp() })) === undefined, "switch back: the header value " + v + " does not ask for the edge");
}
const asked = await back.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: Object.assign({ "x-bsv-edge": "try" }, J), body: rpc(1, "ping") }), { ip: freshIp() });
ok(asked && asked.status === 200 && asked.headers.get("x-bsv-via") === "edge", "switch back: a request that asks with try is answered by the edge code");

// --- how long the work itself takes (no network in this number)
const t0 = performance.now();
for (let i = 0; i < 200; i++) await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: call("search_items", { query: vocab[rnd(vocab.length)] + " " + vocab[rnd(vocab.length)], limit: 10 }) }), { ip: "t-" + i });
const per = (performance.now() - t0) / 200;
console.log("edge handler, 200 two-word searches: " + per.toFixed(2) + " ms each on this machine (work only, no network)");
ok(per < 25, "a search costs far less than the 50 ms the edge allows");
const t1 = performance.now();
for (let i = 0; i < 200; i++) await edge.default(new Request(ORIGIN + "/api/mcp", { method: "POST", headers: J, body: call("get_item", { id: withText[rnd(withText.length)].u }) }), { ip: "g-" + i });
const perGet = (performance.now() - t1) / 200;
console.log("edge handler, 200 get_item calls for different items: " + perGet.toFixed(2) + " ms each on this machine (work only, no network)");
ok(perGet < 25, "reading an item costs far less than the 50 ms the edge allows");
ok(parts >= withText.length, "every held text was read to its end (" + parts + " parts for " + withText.length + " texts)");

console.log(failures ? "FAILED " + failures + " of " + checks : "PASS " + checks + " checks, " + compared + " requests compared");
if (failures) process.exit(1);
