"use strict";
// FIX_3 (2026-11-18): /api/mcp — read-only MCP endpoint (Streamable HTTP, JSON responses).
// Reads two kinds of public files from this site and nothing else: the repo index, and the plain .md
// item files the index names. No store, no session, no mail, no payment code is loaded here.
var core = require("./_lib/mcpCore");
var http = require("./_lib/http");

var ORIGIN = "https://botshelfvampire.com";
var INDEX_PATH = "/data/repo-index.v20261118.json";
var INDEX_TTL = 5 * 60 * 1000, TEXT_TTL = 5 * 60 * 1000, TEXT_KEEP = 30;

var indexCache = null, textCache = {}, textOrder = [];

async function get(path) {
  var ctl = new AbortController();
  var timer = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    var res = await fetch(ORIGIN + path, { redirect: "error", signal: ctl.signal, headers: { accept: "application/json, text/plain" } });
    if (!res.ok) throw new Error("status " + res.status);
    var text = await res.text();
    if (text.length > 4000000) throw new Error("too large");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

var loader = {
  loadIndex: async function () {
    if (indexCache && Date.now() - indexCache.at < INDEX_TTL) return indexCache.value;
    try {
      var fresh = JSON.parse(await get(INDEX_PATH));
      if (!fresh || !Array.isArray(fresh.rows)) throw new Error("index has no rows"); // a broken copy never replaces a good one
      indexCache = { at: Date.now(), value: fresh };
    } catch (e) {
      if (!indexCache) throw e; // nothing to fall back to
      indexCache.at = Date.now() - INDEX_TTL + 30000; // keep serving the last good copy, look again in 30 seconds
    }
    return indexCache.value;
  },
  loadText: async function (path) {
    if (!core.safeRaw(path)) throw new Error("refused path");
    var hit = textCache[path];
    if (hit && Date.now() - hit.at < TEXT_TTL) return hit.value;
    var text = await get(path);
    if (text.length > core.LIMITS.fileChars) return text; // too long to serve: the core says so, and it is not kept
    if (!textCache[path]) {
      textOrder.push(path);
      if (textOrder.length > TEXT_KEEP) delete textCache[textOrder.shift()];
    }
    textCache[path] = { at: Date.now(), value: text };
    return text;
  }
};

// 1.1.0: /api/mcp is answered at the edge first (netlify/edge-functions/mcp-edge.js, a generated copy of the same core).
// This function stays as the second place: it answers when the edge function steps aside. "via" tells the two apart in a response header.
var server = core.create({ origin: ORIGIN, via: "function", loadIndex: function () { return loader.loadIndex(); }, loadText: function (p) { return loader.loadText(p); } });

exports.handler = async function (event) {
  try {
    // callers are told apart by the keyed hash of the address (http.ipTag, FIX_2); the count lives in memory only
    return await server.handle(event, http.ipTag(event));
  } catch (e) {
    console.error("BSV mcp error", e && e.message);
    return { statusCode: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify({ error: "Server error" }) };
  }
};
exports.INDEX_PATH = INDEX_PATH;
exports.INDEX_TTL = INDEX_TTL;
exports.ORIGIN = ORIGIN;
