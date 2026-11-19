// Check the live server from your own machine. No dependency, nothing to install:
//   node test/live_check.mjs            (Node.js 18 or newer, or bun)
//   node test/live_check.mjs <address>  (another address that runs the same server)
// It puts 15 plain requests to the address: 14 JSON-RPC messages of the kind an MCP client sends (the handshake, the
// list of tools, a call of each tool, things the server has to refuse) and one GET. The word it searches for is
// taken from the shelf itself, so the check keeps working when the shelf changes. It prints one line per request
// with the HTTP status, the time the round trip took from this machine and the place that answered (the X-BSV-Via
// header), and ends with PASS or FAIL. A request that fails on the network is sent once more; so is one that is
// answered with 429 (too many calls), after the wait the server names. It writes nothing and reads no file.
const URL_ = process.argv[2] || "https://botshelfvampire.com/api/mcp";
const TOOLS = ["search_items", "get_item", "list_items", "list_filters"];
const PROTOCOLS = ["2025-11-25", "2025-06-18"];
const TIMEOUT_MS = 20000;                 // one request
const DEADLINE = Date.now() + 150000;     // the whole check: after two and a half minutes nothing more is sent

let checks = 0, failures = 0, skipped = 0;
const rows = [];
function ok(cond, what) {
  checks++;
  if (!cond) { failures++; console.log("  FAIL  " + what); }
  return !!cond;
}
function skip(n, why) { checks += n; skipped += n; console.log("  not looked at (" + n + "): " + why); }
const left = () => DEADLINE - Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, Math.min(ms, left()))));
const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

// One request. A network fault is tried once more after two seconds. A 429 (the limit of calls a minute) is waited
// out once, for as long as Retry-After says, and then tried again. Both stay inside the time the whole check has.
async function send(label, body, opts) {
  opts = opts || {};
  const headers = Object.assign({ "Content-Type": "application/json", "Accept": "application/json, text/event-stream", "User-Agent": "botshelf-live-check" }, opts.headers || {});
  const none = { status: 0, json: null, text: "", headers: new Headers() };
  const gone = (why, ms) => { rows.push({ label, status: 0, ms, via: "-" }); console.log("ERR " + "".padStart(8) + "  " + label + ": " + why); return none; };
  let faults = 0, waits = 0;
  for (;;) {
    if (left() <= 0) return gone("out of time, not sent", 0);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.min(TIMEOUT_MS, left()));
    const t0 = performance.now();
    try {
      const init = { method: opts.method || "POST", headers, signal: ctl.signal };
      if (init.method === "POST") init.body = typeof body === "string" ? body : JSON.stringify(body);
      const res = await fetch(URL_, init);
      const text = await res.text();
      const ms = performance.now() - t0;
      if (res.status === 429 && waits < 1) {
        const wait = Math.min(Math.max(parseInt(res.headers.get("retry-after") || "5", 10) || 5, 1), 65);
        if (left() > wait * 1000 + 5000) {
          waits++;
          console.log("429 " + "".padStart(8) + "  " + label + ": over the limit of calls a minute; waiting " + wait + " s, then once more");
          await sleep(wait * 1000);
          continue;
        }
      }
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
      const via = res.headers.get("x-bsv-via") || "-";
      rows.push({ label, status: res.status, ms, via });
      console.log(String(res.status).padEnd(4) + (ms.toFixed(0) + " ms").padStart(8) + "  via " + via.padEnd(9) + label);
      return { status: res.status, json, text, headers: res.headers };
    } catch (e) {
      if (faults >= 1 || left() <= 2000) return gone((e && e.message) || "no reply", performance.now() - t0);
      faults++;
      await sleep(2000);
    } finally {
      clearTimeout(timer);
    }
  }
}
const rpc = (id, method, params) => (params === undefined ? { jsonrpc: "2.0", id, method } : { jsonrpc: "2.0", id, method, params });
const call = (id, name, args) => rpc(id, "tools/call", { name, arguments: args });
// a JSON-RPC reply to the request with this id: version 2.0, the same id, and either a result or an error
const reply = (r, id) => { const j = r.json; return obj(j) && j.jsonrpc === "2.0" && j.id === id && (("result" in j) !== ("error" in j)); };
// a tool call that worked: HTTP 200, a result that is not an error, whose content is one piece of text holding the
// same JSON as the structured content
function worked(r, id) {
  const res = r.json && r.json.result;
  if (!(r.status === 200 && reply(r, id) && obj(res) && res.isError !== true && obj(res.structuredContent))) return false;
  const c = arr(res.content);
  if (c.length !== 1 || !obj(c[0]) || c[0].type !== "text" || typeof c[0].text !== "string") return false;
  try { return JSON.stringify(JSON.parse(c[0].text)) === JSON.stringify(res.structuredContent); } catch (e) { return false; }
}
const data = (r) => r.json.result.structuredContent;
const isCard = (i) => obj(i) && typeof i.id === "string" && i.id.startsWith("/") && typeof i.title === "string";

console.log("live check of " + URL_ + "   " + new Date().toISOString());

// --- the handshake
let r = await send("initialize", rpc(1, "initialize", { protocolVersion: PROTOCOLS[0], capabilities: {}, clientInfo: { name: "botshelf-live-check", version: "1" } }));
const init = reply(r, 1) && obj(r.json.result) ? r.json.result : null;
ok(r.status === 200 && init, "initialize answers with a result");
ok(init && PROTOCOLS.includes(init.protocolVersion), "it agrees to a protocol revision this check knows (" + (init && init.protocolVersion) + ")");
ok(init && obj(init.serverInfo) && typeof init.serverInfo.name === "string" && /^\d+\.\d+\.\d+$/.test(String(init.serverInfo.version || "")), "it names itself and its version (" + (init && obj(init.serverInfo) && init.serverInfo.version) + ")");
ok(init && obj(init.capabilities) && obj(init.capabilities.tools), "it declares tools");
r = await send("notifications/initialized", { jsonrpc: "2.0", method: "notifications/initialized" });
ok(r.status === 202 && r.text === "", "a notification gets an empty 202");
r = await send("ping", rpc(2, "ping"));
ok(r.status === 200 && reply(r, 2) && obj(r.json.result) && Object.keys(r.json.result).length === 0, "ping gets an empty result");

// --- the tools
r = await send("tools/list", rpc(3, "tools/list"));
const tools = r.status === 200 && reply(r, 3) && obj(r.json.result) ? arr(r.json.result.tools) : [];
const whole = tools.length > 0 && tools.every((t) => obj(t) && typeof t.name === "string");
ok(whole && TOOLS.every((n) => tools.some((t) => t.name === n)), "the four tools are listed (" + tools.map((t) => (obj(t) ? t.name : String(t))).join(", ") + ")");
ok(whole && tools.every((t) => typeof t.description === "string" && t.description && obj(t.inputSchema) && t.inputSchema.type === "object"), "every tool has a description and an input schema");
ok(whole && tools.every((t) => obj(t.annotations) && t.annotations.readOnlyHint === true), "every tool is marked read-only");

r = await send("list_filters", call(4, "list_filters", {}));
const filters = worked(r, 4) ? data(r) : null;
ok(filters && filters.total > 0 && arr(filters.kinds).length > 0 && arr(filters.kinds).every((k) => obj(k) && typeof k.kind === "string" && k.items > 0), "list_filters returns the kinds and a total");

// the kind that holds the most items, as list_filters counts them: list_items has to count the same
const biggest = arr(filters && filters.kinds).slice().sort((a, b) => b.items - a.items)[0];
r = await send("list_items", call(5, "list_items", biggest ? { kind: biggest.kind, limit: 5 } : { limit: 5 }));
const page = worked(r, 5) ? data(r) : null;
const listed = arr(page && page.items);
ok(page && biggest && page.total === biggest.items && listed.length === Math.min(5, biggest.items) && listed.every(isCard),
  "list_items counts the largest kind as list_filters does (" + (biggest && biggest.kind) + ": " + (page && page.total) + "), with an id and a title on every card");

// a word of the shelf itself to search for: the longest run of letters or digits in the titles just listed (at most
// 40 characters of it; a search finds parts of words too)
const runs = listed.filter(isCard).flatMap((i) => i.title.match(/[\p{L}\p{N}]+/gu) || []).sort((a, b) => b.length - a.length);
const word = (runs[0] || (listed.filter(isCard)[0] || { title: "" }).title.trim() || "a").slice(0, 40).toLowerCase();
r = await send("search_items", call(6, "search_items", { query: word, limit: 3 }));
const found = worked(r, 6) ? data(r) : null;
const cards = arr(found && found.items);
ok(found && found.total > 0 && cards.length > 0 && cards.length <= 3 && cards.length <= found.total, "search_items finds items for a word of the shelf (“" + word + "”) and keeps to the limit");
ok(cards.length > 0 && cards.every(isCard), "every card has an id and a title");

r = await send("search_items (with a filter)", call(7, "search_items", { query: word, access: "open", limit: 25 }));
const open = worked(r, 7) ? data(r) : null;
const openCards = arr(open && open.items);
ok(open && open.total > 0 && openCards.length > 0 && openCards.length <= 25 && openCards.every((i) => isCard(i) && i.access === "open"), "the same search kept to items that are open: every card says so");
const readable = openCards.filter((i) => isCard(i) && typeof i.text_url === "string" && i.text_url)[0];
if (readable) {
  r = await send("get_item", call(8, "get_item", { id: readable.id, max_chars: 500 }));
  const got = worked(r, 8) ? data(r) : null;
  ok(got && obj(got.item) && got.item.id === readable.id, "get_item returns the item that was asked for");
  ok(got && typeof got.text === "string" && Number.isInteger(got.total_chars) && got.text.length === Math.min(500, got.total_chars), "with its text, cut at max_chars");
} else {
  const any = openCards.filter(isCard)[0] || cards.filter(isCard)[0] || listed.filter(isCard)[0];
  r = await send("get_item", call(8, "get_item", { id: any ? any.id : "/" }));
  ok(any && worked(r, 8) && obj(data(r).item) && data(r).item.id === any.id, "get_item returns the item that was asked for");
  skip(1, "no item with a text file among the open results, so no text was read");
}

const absent = "zz" + Date.now().toString(36) + "qxj";
r = await send("search_items (no match)", call(9, "search_items", { query: word + " " + absent }));
const none = worked(r, 9) ? data(r) : null;
ok(none && none.total === 0 && Array.isArray(none.items) && none.items.length === 0 && obj(none.suggestions) && arr(none.suggestions.items).length > 0 && arr(none.suggestions.items).every(isCard),
  "a word nobody holds beside one that many hold: no match, and suggestions");

// --- what it refuses
r = await send("unknown tool", call(10, "delete_everything", {}));
ok(r.status === 200 && reply(r, 10) && ((obj(r.json.result) && r.json.result.isError === true) || obj(r.json.error)), "a tool that does not exist is refused");
r = await send("argument out of range", call(11, "search_items", { query: word, limit: 1000 }));
ok(r.status === 200 && reply(r, 11) && obj(r.json.result) && r.json.result.isError === true, "an argument out of range comes back as a tool error");
r = await send("unknown method", rpc(12, "resources/subscribe", {}));
ok(r.status === 200 && reply(r, 12) && obj(r.json.error) && r.json.error.code === -32601, "a method it does not have: error -32601");
r = await send("batch", JSON.stringify([rpc(13, "ping"), rpc(14, "ping")]));
ok(r.status === 400, "a batch is refused with 400");
r = await send("GET", null, { method: "GET" });
ok(r.status === 405, "GET is refused with 405");

// --- the result
const answered = rows.filter((x) => x.status > 0);
const times = answered.map((x) => x.ms).sort((a, b) => a - b);
const median = times.length ? (times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2) : 0;
const places = {};
answered.forEach((x) => { places[x.via] = (places[x.via] || 0) + 1; });
console.log("requests: " + rows.length + "   median round trip: " + median.toFixed(0) + " ms   answered by: " + Object.keys(places).sort().map((k) => k + " " + places[k]).join(", "));
console.log(failures ? "FAIL " + failures + " of " + checks + " checks" : "PASS " + checks + " checks" + (skipped ? " (" + skipped + " not looked at)" : ""));
process.exit(failures ? 1 : 0);
