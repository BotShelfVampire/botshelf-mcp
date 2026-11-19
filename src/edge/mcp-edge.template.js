// /api/mcp answered at the edge, close to the caller.
//
// GENERATED FILE. Made by world1/steps/w03.py from netlify/functions/_lib/mcpCore.js (the same code the function
// runs) and site/data/@@INDEX_NAME@@ (the shelf index, held here so that no file has to be fetched to search).
// Do not edit it by hand: change the core or the index and generate it again.
//
// It reads nothing but that index and the plain .md item files the index names. It writes nothing, stores nothing,
// reads no environment value and no secret. If anything in here throws, the request goes on to the function in
// netlify/functions/mcp.js, which answers the same way (onError: "bypass" below, and the catch in the handler).
//
// TRIAL. This code has run under Node.js and bun, not yet on the platform's edge runtime. While ANSWER_ALL is false it
// answers only the requests that ask for it with the header "X-BSV-Edge: try"; every other request goes on to the
// function, exactly as before this file existed.
const ANSWER_ALL = false;

const core = (function () {
  const module = { exports: {} };
  // the core measures a request in bytes with Buffer.byteLength; here that is a TextEncoder. It never gets a base64 body here.
  const Buffer = {
    byteLength: function (s) { return new TextEncoder().encode(String(s)).length; },
    from: function () { throw new Error("no base64 body at the edge"); }
  };
  (function (module, exports, Buffer) {
/*@@CORE@@*/
  })(module, module.exports, Buffer);
  return module.exports;
})();

const ORIGIN = "https://botshelfvampire.com";
const INDEX = JSON.parse("@@INDEX@@");
const TEXT_TTL = 5 * 60 * 1000, TEXT_KEEP = 30;
const BODY_MS = 5000; // how long a request body may take to arrive
const textCache = new Map();

// The only requests this file makes: one plain .md file of this site, named by the index, when get_item asks for it.
async function loadText(path) {
  if (!core.safeRaw(path)) throw new Error("refused path");
  const hit = textCache.get(path);
  if (hit && Date.now() - hit.at < TEXT_TTL) return hit.value;
  const ctl = new AbortController();
  const timer = setTimeout(function () { ctl.abort(); }, 8000);
  let text;
  try {
    const res = await fetch(ORIGIN + path, { redirect: "error", signal: ctl.signal, headers: { accept: "text/plain" } });
    if (!res.ok) throw new Error("status " + res.status);
    text = await res.text();
    if (text.length > 4000000) throw new Error("too large"); // the same ceiling as in the function
  } finally {
    clearTimeout(timer);
  }
  if (text.length > core.LIMITS.fileChars) return text; // too long to serve: the core says so, and it is not kept
  if (!textCache.has(path) && textCache.size >= TEXT_KEEP) textCache.delete(textCache.keys().next().value);
  textCache.set(path, { at: Date.now(), value: text });
  return text;
}

// passFailures: a file that cannot be read here is not answered with an error; the request goes on to the function instead
const server = core.create({ origin: ORIGIN, via: "edge", passFailures: true, loadIndex: async function () { return INDEX; }, loadText: loadText });

// The request body as { text, bytes }, read from a copy of the stream (the request itself stays unread, in case it has
// to go on to the function). bytes is the size on the wire; the core holds that against its limit and answers 413 when
// it is over. Reading stops at the first byte over the limit and after BODY_MS. The core calls this only after the
// caller's count and the headers have passed, so a caller who is being limited is answered without the body being read.
function stop(reader) {
  try { reader.cancel().catch(function () {}); } catch (e) {} // a stream that refuses to be cancelled must not surface as an error of its own
}
async function readBody(request) {
  const stream = request.clone().body;
  if (!stream) return { text: "", bytes: 0 };
  const reader = stream.getReader();
  const parts = [];
  let total = 0, timer = null;
  const late = new Promise(function (resolve) { timer = setTimeout(function () { resolve("late"); }, BODY_MS); });
  try {
    for (;;) {
      const step = await Promise.race([reader.read(), late]);
      if (step === "late") {
        stop(reader);
        const slow = new Error("body too slow");
        slow.tooSlow = true;
        throw slow;
      }
      if (step.done) break;
      total += step.value.byteLength;
      if (total > core.LIMITS.bodyBytes) {
        stop(reader);
        return { text: "", bytes: total };
      }
      parts.push(step.value);
    }
  } finally {
    clearTimeout(timer);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (let i = 0; i < parts.length; i++) { all.set(parts[i], at); at += parts[i].byteLength; }
  // a byte-order mark stays in the text and fails as JSON, as it does in the function
  return { text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(all), bytes: total };
}

// Callers are told apart by a keyed hash of their address. The key is random, made when this instance starts,
// exists only in its memory and is never written anywhere; neither is the hash or the count kept per caller.
let keyPromise = null;
function tagKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey("raw", crypto.getRandomValues(new Uint8Array(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  return keyPromise;
}
async function callerTag(ip) {
  if (!ip) return "";
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await tagKey(), new TextEncoder().encode(String(ip).toLowerCase())));
  let hex = "";
  for (let i = 0; i < 16; i++) hex += (sig[i] < 16 ? "0" : "") + sig[i].toString(16);
  return "e1_" + hex;
}

export default async function handler(request, context) {
  try {
    if (!ANSWER_ALL && request.headers.get("x-bsv-edge") !== "try") return undefined;
    const method = String(request.method || "").toUpperCase();
    const headers = {};
    request.headers.forEach(function (value, name) { headers[name] = value; });
    let body = "";
    if (method === "POST") {
      // a body that declares itself over the limit is not read at all; any other is read when the core asks for it
      const declared = Number(request.headers.get("content-length") || "0");
      body = function () {
        if (declared > core.LIMITS.bodyBytes) return Promise.resolve({ text: "", bytes: declared });
        return readBody(request).catch(function (e) {
          if (e && e.tooSlow) throw e; // the core answers 408
          const pass = new Error("body not read here"); // anything else: let the function read it
          pass.passOn = true;
          throw pass;
        });
      };
    }
    const out = await server.handle({ httpMethod: method, headers: headers, body: body, isBase64Encoded: false }, await callerTag(context && context.ip));
    const text = out.body || "";
    return new Response(text === "" ? null : text, { status: out.statusCode, headers: out.headers || {} });
  } catch (e) {
    return undefined; // step aside: the request goes on to the function
  }
}

export const config = { path: "/api/mcp", onError: "bypass" };
