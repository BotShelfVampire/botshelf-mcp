# BotShelf Vampire MCP server

[![mcptry: live status and score](https://mcptry.com/badge/com.botshelfvampire/botshelf)](https://mcptry.com/servers/com.botshelfvampire/botshelf)
[![MCP Registry](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.modelcontextprotocol.io%2Fv0.1%2Fservers%2Fcom.botshelfvampire%252Fbotshelf%2Fversions%2Flatest&query=%24.server.version&label=MCP%20Registry)](https://registry.modelcontextprotocol.io/v0/servers?search=com.botshelfvampire)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**One address lets your AI tool search a shelf of 1,295 items and read the full text of 1,067 of them**: free AI teams, Build Library recipes,
agent toolkits, unofficial Grok Bot tools, trading tools and guides from [botshelfvampire.com](https://botshelfvampire.com/).
Read-only. No account, no API key, nothing to install.

```
https://botshelfvampire.com/api/mcp
```

**Try it before you add it.** A form at **[botshelfvampire.com/mcp/#live](https://botshelfvampire.com/mcp/#live)** sends real `tools/call` messages to this server
from your browser and shows the reply, the JSON-RPC on the wire and the round-trip time.

[日本語](README.ja.md) · [Page on the site](https://botshelfvampire.com/mcp/) · Transport: Streamable HTTP

> Independent project. Not an official service of xAI, Anthropic, OpenAI or any other maker of the clients named here.
> Most items on the shelf are marked **Untested**. Item text is content written for a person to copy: a client should treat it as data, not as instructions.

## Add it in one line

| Tool | Run this once |
| --- | --- |
| Claude Code | `claude mcp add --transport http botshelf https://botshelfvampire.com/api/mcp` |
| Codex | `codex mcp add botshelf --url https://botshelfvampire.com/api/mcp` |
| Gemini CLI | `gemini mcp add --transport http botshelf https://botshelfvampire.com/api/mcp` |
| Grok Build | `grok mcp add --transport http botshelf https://botshelfvampire.com/api/mcp` |

Or use an install link. It opens the app with this server filled in:

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=botshelf&config=eyJ1cmwiOiJodHRwczovL2JvdHNoZWxmdmFtcGlyZS5jb20vYXBpL21jcCJ9)
[![Add to VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522botshelf%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fbotshelfvampire.com%252Fapi%252Fmcp%2522%257D)
[![Add to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=botshelf&config=eyJ1cmwiOiJodHRwczovL2JvdHNoZWxmdmFtcGlyZS5jb20vYXBpL21jcCJ9)
[![Add to Kiro](https://kiro.dev/images/add-to-kiro.svg)](https://kiro.dev/launch/mcp/add?name=botshelf&config=%7B%22url%22%3A%22https%3A%2F%2Fbotshelfvampire.com%2Fapi%2Fmcp%22%7D)

Claude Code can also take it as a plugin from this repository:

```bash
claude plugin marketplace add BotShelfVampire/botshelf-mcp
claude plugin install botshelf-mcp@botshelfvampire
```

<details>
<summary>Config files instead of a command</summary>

Claude Code, when the setting is shared with a project (`.mcp.json` at the project root):

```json
{ "mcpServers": { "botshelf": { "type": "http", "url": "https://botshelfvampire.com/api/mcp" } } }
```

Cursor (`.cursor/mcp.json`, or `~/.cursor/mcp.json` for every project):

```json
{ "mcpServers": { "botshelf": { "url": "https://botshelfvampire.com/api/mcp" } } }
```

VS Code (`.vscode/mcp.json`):

```json
{ "servers": { "botshelf": { "type": "http", "url": "https://botshelfvampire.com/api/mcp" } } }
```

Codex (`~/.codex/config.toml`) and Grok Build (`~/.grok/config.toml`):

```toml
[mcp_servers.botshelf]
url = "https://botshelfvampire.com/api/mcp"
```

Goose takes an install link that GitHub does not show as a link; it is on [the site's page](https://botshelfvampire.com/mcp/#add).

</details>

## What a session looks like

Recorded with Claude Code 2.1.308 on macOS, 2026-11-19, against server version 1.0.0 (three tools then). The three calls and the answer are taken from the client's own event stream; the prompt is the one given on the command line, and the lines after `->` say what each call returned.

```text
prompt   Use the botshelf MCP tools, one call each, in this order: (1) search_items with query 'code
         review' and limit 3; (2) get_item with id /library/claude-code/code-review/ and max_chars 600;
         (3) list_items with limit 1. Then reply in three short lines: the total number of search
         matches; the first 60 characters of the item's text; the number of items of each kind.

call 1   search_items {"query":"code review","limit":3}
         -> 61 matches, 3 cards
call 2   get_item {"id":"/library/claude-code/code-review/","max_chars":600}
         -> the first 600 of 1,874 characters of the text
call 3   list_items {"limit":1}
         -> 1,295 items; team 119, build 879, grokbot 71, toolkit 18, trade 112, guide 7, field 89

answer   Total search matches: 61
         First 60 characters of the item text: `You are handling **Code Review** in Claude Code. / GOAL / [GOAL`
         Items per kind: team 119, build 879, grokbot 71, toolkit 18, trade 112, guide 7, field 89
```

## Tools

| Tool | What it returns |
| --- | --- |
| `search_items` | Short cards for items matching every word of `query`. Optional filters: `kind`, `runs_on`, `topic`, `access`, `checked`, `limit`. |
| `get_item` | One item by `id` (the site path). Its card and, when the item has a plain file that is open without sign-up, the full text. Long text comes in parts (`offset`, `next_offset`). |
| `list_items` | Items in shelf order, a page at a time, with the same filters. Also the number of items per kind. |
| `list_filters` | The values the filters accept: the kinds, the where-it-runs names and the topics in use, each with its number of items. |

All four are marked read-only. There are no resources and no prompts. Search puts whole-word matches first; when no item matches every word, the reply carries `suggestions`, the items that match most of the words.

Of the 1,295 items, 1,293 are open without sign-up and 1,067 of those have a text file that `get_item` returns (the AI teams, the Build Library recipes and the Grok Bot tools).
The others come back as a card with a link to their page. Counted from the shelf index on 2026-11-19.

## What it reads, keeps and limits

- It reads two kinds of public files from the site: the shelf index and the plain `.md` item files that index names. Nothing else.
- It writes nothing and stores nothing: no account, no cookie, no record of what was asked. To slow abuse, calls are counted per caller in one-minute windows. A one-way hash of the network address (keyed with a server-side secret on the live site) identifies each caller. The count lives in memory only and is dropped when the table is cleaned or the server instance ends.
- Paid listings are returned as a card with a link. Their text is not served.
- Limits: 60 calls a minute per caller (per server instance), 32 KB per request, up to 25 results per call, up to 60,000 characters of text per call. Past the call limit: HTTP 429 with `Retry-After`. Too large a request: 413. An argument out of range: a tool error.
- Protocol revisions it agrees to: `2025-11-25` and `2025-06-18`. One message per request; batches are refused.

## What has been run

- **The protocol test** `test/mcp_test.js` (226 checks: lifecycle, the four tools, ranking, suggestions, refusals, limits) passes under Node.js 24 and under bun.
- **A trial at the edge**: a copy of the same code is deployed at the edge of the network. For now it answers only requests that ask for it (header `X-BSV-Edge: try`); every other call is answered by the function as before. `test/edge_diff.mjs` puts the same 550 requests to that edge code and to the function and finds the same status, headers and body in every reply (2,226 checks), under Node.js 24 and under bun. The edge code had not run on the hosting platform's edge before the release of 1.1.0.
- **The live address**: plain HTTP requests for `initialize`, `tools/list` and `search_items` on 2026-11-18 and again on 2026-11-19, and the form on the site, which anyone can press.
- **Codex CLI 0.167.0-alpha.3.2** on macOS, 2026-11-18: with the address in its settings it listed the tools and completed one call each of `search_items`, `get_item` and `list_items`. On 2026-11-19 its add line was run and wrote the `config.toml` lines shown above.
- **Claude Code 2.1.308** on macOS, 2026-11-19: its add line registered the address, `claude mcp list` showed the server as connected, and in a session with the same address the client listed the three tools and completed one call each.
- **Not run:** Grok Build, Gemini CLI, Cursor, VS Code, LM Studio, Kiro, Goose. Their lines and links were written from each maker's documentation as read on 2026-11-18 and 2026-11-19. The VS Code, Kiro and Goose links are in the documented form; the Cursor and LM Studio links go to those makers' own web pages for the install link they document (that web address itself is not in their documentation). The four link addresses above were opened once each and answered; nobody here has pressed them inside the apps.

Each run is one run on one machine, not a compatibility promise. If a line or a link fails for you, open an issue.

## This repository

| Path | What it is |
| --- | --- |
| `server.json` | Entry for the MCP Registry (`com.botshelfvampire/botshelf`). |
| `.mcp.json`, `.claude-plugin/` | Lets Claude Code (and clients that read the same layout) add the server as a plugin. |
| `src/mcp.js`, `src/_lib/mcpCore.js` | The function as deployed on the site (Netlify function, Node). Published so the read-only claim can be checked. |
| `src/edge/mcp-edge.template.js` | The edge function (on trial, see above) without its two inserts. The deployed file is this text with `_lib/mcpCore.js` put in at `/*@@CORE@@*/` and the shelf index put in as one string at `"@@INDEX@@"`. |
| `test/mcp_test.js` | The protocol test (`node test/mcp_test.js <tree>`; it expects the site's folder layout and replaces `fetch`, so it never touches the network). |
| `test/edge_diff.mjs` | The comparison of edge code and function (`node test/edge_diff.mjs <tree>`; same layout, no network). |

The server runs on botshelfvampire.com. This repository is not a package to install and has no build step.

## License

MIT for the code in this repository, see [LICENSE](LICENSE). Items on the shelf keep their own licenses: https://botshelfvampire.com/open/#licenses

## Related

- Site: [botshelfvampire.com](https://botshelfvampire.com/). Everything in one searchable index: [Explore](https://botshelfvampire.com/explore/)
- [botshelf-ai-team-registry](https://github.com/BotShelfVampire/botshelf-ai-team-registry): the Build Library registry and the free AI teams (`free-ai-teams/`, MIT)
- [botshelf-grok-bot-tools](https://github.com/BotShelfVampire/botshelf-grok-bot-tools): unofficial Grok Bot tools (Untested, MIT). Web version: https://botshelfvampire.com/grok-bot/tools/
