# BotShelf Vampire MCP サーバー：無料のプロンプト・スキル・AIチーム

[![mcptry: live status and score](https://mcptry.com/badge/com.botshelfvampire/botshelf)](https://mcptry.com/servers/com.botshelfvampire/botshelf)
[![MCP Registry](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fregistry.modelcontextprotocol.io%2Fv0.1%2Fservers%2Fcom.botshelfvampire%252Fbotshelf%2Fversions%2Flatest&query=%24.server.version&label=MCP%20Registry)](https://registry.modelcontextprotocol.io/v0/servers?search=com.botshelfvampire)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**アドレスを1つ登録すると、AIツールから 1,295 件を検索し、無料の 1,067 件の全文を読めます。** 中身は [botshelfvampire.com](https://botshelfvampire.com/) の、
Build Library のプロンプト・指示・スキル・ワークフロー 879 件（Claude Code・Cursor・Gemini・DeepSeek・Dify・AutoGen など向け）、AIチーム 117 件、非公式の Grok Bot の道具 71 件です。
検索では、棚にあるトレードの道具・エージェント用ツールキット・ガイドも、カードとリンクで出ます。
読み取り専用。アカウントもAPIキーも要らず、インストールする物もありません。
ツール 4 つ、プロンプト 3 つ、リソース 2 つと、項目を1つ読むひな型。どのツールも、返す内容の形を名乗ります。

```
https://botshelfvampire.com/api/mcp
```

**無料。アカウントもAPIキーも要りません。** 追加先：[Claude アプリ](#claude-app) · [ChatGPT](#chatgpt) · [Claude Code](#1行で追加する) · [Cursor](https://cursor.com/en/install-mcp?name=botshelf&config=eyJ1cmwiOiJodHRwczovL2JvdHNoZWxmdmFtcGlyZS5jb20vYXBpL21jcCJ9) · [VS Code](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522botshelf%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fbotshelfvampire.com%252Fapi%252Fmcp%2522%257D) · [Cline](#1行で追加する) · [Zed](#cline-zed-stdio) · [stdio だけのクライアント](#cline-zed-stdio) · [ほかのツール](#1行で追加する)

**追加したら、たとえばこう頼みます：**

```text
BotShelf Vampire の棚から、会議メモを行動リストにするプロンプトを探して、全文を見せて。
```

```text
BotShelf Vampire で Claude Code 用のコードレビューのプロンプトを探して、何を頼む内容か3行で教えて。
```

```text
BotShelf Vampire でセキュリティレビューのプロンプトを探して、全文を見せて。
```

<sub>2026-11-20 に、Claude Code 2.1.304（モデル claude-haiku-5-5）から本番のアドレスに対して流しました。どれも、モデルが棚を検索し、`get_item` で項目を読んで答えました。2つ目は、1回目はモデルがツールを呼ばずに終わり、2回目で動きました。ほかの2つは1回ずつです。1つのクライアントでの記録で、どのモデルでも同じに動くという約束ではありません。</sub>

<p align="center"><img src="assets/session.svg" alt="記録した Claude Code のやり取り：依頼文、このサーバーへの3回のツール呼び出し（list_filters・search_items・get_item）とそれぞれが返した内容、答え" width="860"></p>

<sub>Claude Code 2.1.308 で 2026-11-19 に記録した、このサーバー（バージョン 1.1.0）とのやり取りです。依頼文、3回のツール呼び出しとそれぞれが返した内容、答えの順に出ます。クライアントが出力したイベントの記録から描いたもので、画面を写したものではありません。[同じ内容をテキストで](#実際のやり取り)。</sub>

**追加する前に、ブラウザで試せます。** **[botshelfvampire.com/mcp/?lang=ja#live](https://botshelfvampire.com/mcp/?lang=ja#live)** のフォームが、ブラウザからこのサーバーへ本物の `tools/call` を送り、
返事と、やり取りした JSON-RPC、往復にかかった時間を表示します。

<a name="claude-md-line"></a>
**頼まなくても AIツールが棚を見に行くように**、次の1行を `CLAUDE.md` に入れます。Claude Code は会話の始めに毎回このファイルを読みます。`~/.claude/CLAUDE.md` に入れれば、自分の全プロジェクトに効きます。

```text
プロンプト・スキル・指示ファイル・AIチームを頼んだときは、自分で書く前に、まず botshelf の MCP サーバーで探して（search_items のあと get_item）、いちばん合う物とそのページを見せて。
```

<sub>2026-11-21 に Claude Code 2.1.304（モデル claude-haiku-5-5、Linux）で、BotShelf Vampire の名前を出さない頼みを3つ、1回ずつ流しました（ChatGPT に貼る会議メモのプロンプト、プルリクエストのセキュリティの見直しのプロンプト、会議メモの頼みの日本語版。日本語版はこの日本語の1行で、ほかの2つは [README.md](README.md#claude-md-line) の英語の1行で）。1行が無いと、3回ともモデルは自分で書き、このサーバーの道具を1度も呼びませんでした（3回中0回）。1行があると、3回とも棚を探し、いちばん近い物を `get_item` で読み、そのページを見せてから書きました（3回中3回）。試験では4つの道具を前もって許可しました（`--allowedTools`）。許可していなければ、呼ぶ前に Claude Code が許可を求めることがあります。クライアント1つ・モデル1つ・頼み1つにつき1回の記録で、どのモデルでも同じになるという約束ではありません。この1行は、サーバーを `botshelf` と呼んでいます（下の追加の行と同じ名前）。Codex は仕事を始める前に `AGENTS.md` を読むので（全プロジェクトなら `~/.codex/AGENTS.md`）、同じ1行をそこに入れられます。Codex では流していません。出どころ：[Claude Code: How Claude remembers your project](https://code.claude.com/docs/en/memory)、[Codex: Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)（2026-11-21 に読んだもの）。</sub>

<!-- w12-data -->
**MIT の文面を、全部1つのファイルで。** 棚にある、BotShelf Vampire が書いた MIT の文面 997 件（Build Library のプロンプト・指示・スキル 809 件、
無料のAIチーム 117 件、Grok Bot の道具 71 件）を、1つの JSON Lines ファイル（2.7 MB）にもしてあります。1行に1件で、id・カードの項目・本文は、ファイルを作った 2026-11-20 に `get_item` が返したものと同じです（その後、棚で5件の文面を書き直しました）。
学習データ・評価・手元の索引に。項目の説明、入れていないもの、ライセンス：[botshelfvampire.com/data/](https://botshelfvampire.com/data/?lang=ja)

```bash
curl -O https://botshelfvampire.com/data/mit-texts.v20261120.jsonl
```

```python
import pandas as pd
df = pd.read_json("https://botshelfvampire.com/data/mit-texts.v20261120.jsonl", lines=True)  # 997 行・15 列
```
997 行のうち 280 行は、項目の名前を除くと、ほかの行と同じ文です（17 組、いちばん大きい組はスキル 127 件）。[組の一覧](https://botshelfvampire.com/data/mit-texts.v20261120.same-text.json)を使って1つの文につき1行だけ残すと、734 行になります（[そのための1行](https://botshelfvampire.com/data/?lang=ja#load)）。

同じファイルを、MLCommons の Croissant 1.1 の形で [botshelfvampire.com/data/croissant.json](https://botshelfvampire.com/data/croissant.json) に書きました（15 項目）。機械学習の道具から行として読めます：`mlcroissant.Dataset("https://botshelfvampire.com/data/croissant.json").records("texts")` は 2026-11-22 に 997 件を返しました。

サーバー 1.2.1（2026-11-22）から、MCP サーバーもこのファイルを案内します。サーバーの説明（instructions）と案内のリソース（`botshelf://shelf/guide`）にこのファイルの場所を書いたので、まとめて欲しいと頼まれた AI ツールは、項目を1つずつ読む代わりに、ここへ案内されます。
<!-- /w12-data -->

**利用者に近いネットワークの端（エッジ）で答えます。** 同じコードの写しが、すべての呼び出しに答えます。東京から測った値（2026-11-19）は、接続を開いたままの呼び出しで1回 0.09〜0.14 秒（`ping` と `search_items` を合わせて 10 回）。
エッジのコードは、棚の索引と並べて、登録なしで開けるテキストファイルがある 1,067 件の本文を持っていて、答えるあいだ、どこにもリクエストを送りません。
本文を読む呼び出しは、同じ条件で1回 0.09〜0.14 秒でした（2026-11-20、違う項目 12 件）。
どこが答えたかは、返事のヘッダー `X-BSV-Via` に出ます。測り方は「[実際に動かしたもの](#実際に動かしたもの)」に書いてあります。

[English](README.md) · [サイトの説明ページ](https://botshelfvampire.com/mcp/?lang=ja) · 方式：Streamable HTTP

> 独立したプロジェクトです。xAI・Anthropic・OpenAI をはじめ、ここに名前を挙げたクライアントの提供元の公式サービスではありません。
> 棚の項目のほとんどは **Untested** です。項目の本文は、人がコピーして使うための文面です。クライアント側は、指示ではなくデータとして扱ってください。

## 1行で追加する

| ツール | これを1回実行する |
| --- | --- |
| Claude Code | `claude mcp add --transport http botshelf https://botshelfvampire.com/api/mcp` |
| Codex | `codex mcp add botshelf --url https://botshelfvampire.com/api/mcp` |
| Gemini CLI | `gemini mcp add --transport http botshelf https://botshelfvampire.com/api/mcp` |
| Grok Build | `grok mcp add --transport http botshelf https://botshelfvampire.com/api/mcp` |
| Cline | `cline mcp add botshelf https://botshelfvampire.com/api/mcp --transport http --yes` |

導入リンクから追加することもできます。アプリが開き、このサーバーが入力された状態になります：

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=botshelf&config=eyJ1cmwiOiJodHRwczovL2JvdHNoZWxmdmFtcGlyZS5jb20vYXBpL21jcCJ9)
[![Add to VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522botshelf%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fbotshelfvampire.com%252Fapi%252Fmcp%2522%257D)
[![Add to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=botshelf&config=eyJ1cmwiOiJodHRwczovL2JvdHNoZWxmdmFtcGlyZS5jb20vYXBpL21jcCJ9)
[![Add to Kiro](https://kiro.dev/images/add-to-kiro.svg)](https://kiro.dev/launch/mcp/add?name=botshelf&config=%7B%22url%22%3A%22https%3A%2F%2Fbotshelfvampire.com%2Fapi%2Fmcp%22%7D)

Claude Code では、このリポジトリからプラグインとして入れることもできます：

```bash
claude plugin marketplace add BotShelfVampire/botshelf-mcp
claude plugin install botshelf-mcp@botshelfvampire
```

<sub>2026-11-21 に実行（Linux の Claude Code 2.1.304、空の設定フォルダから）：2行とも成功し、そのあと `claude mcp list` で `plugin:botshelf-mcp:botshelf` がつながっていると出ました。プラグインは user scope（自分の全プロジェクト）に入ります。</sub>

<details>
<summary>コマンドの代わりに、設定ファイルで書く</summary>

Claude Code の MCP 設定をプロジェクトで共有する場合（プロジェクト直下の `.mcp.json`）：

```json
{ "mcpServers": { "botshelf": { "type": "http", "url": "https://botshelfvampire.com/api/mcp" } } }
```

Cursor（`.cursor/mcp.json`。全プロジェクトで使うなら `~/.cursor/mcp.json`）：

```json
{ "mcpServers": { "botshelf": { "url": "https://botshelfvampire.com/api/mcp" } } }
```

VS Code（`.vscode/mcp.json`）：

```json
{ "servers": { "botshelf": { "type": "http", "url": "https://botshelfvampire.com/api/mcp" } } }
```

Codex（`~/.codex/config.toml`）と Grok Build（`~/.grok/config.toml`）：

```toml
[mcp_servers.botshelf]
url = "https://botshelfvampire.com/api/mcp"
```

Goose の導入リンクは、GitHub ではリンクとして表示されません。[サイトのページ](https://botshelfvampire.com/mcp/?lang=ja#add)にあります。

</details>

<a name="cline-zed-stdio"></a>
### Cline・Zed・stdio だけのクライアント

Cline の拡張機能（MCP の設定 JSON）。`"type": "streamableHttp"` は消さないでください。Cline のドキュメントによると、これが無いと Cline は古い SSE の方式で接続しますが、このサーバーは SSE を出していません。

```json
{ "mcpServers": { "botshelf": { "type": "streamableHttp", "url": "https://botshelfvampire.com/api/mcp" } } }
```

Zed（`settings.json`。または Settings → AI → MCP Servers → Add Server → Add Remote Server）。このサーバーにはサインインが無いので、ヘッダーは要りません。

```json
{ "context_servers": { "botshelf": { "url": "https://botshelfvampire.com/api/mcp" } } }
```

設定にコマンドとその引数しか書けないクライアントは、[mcp-remote](https://github.com/punkpeye/mcp-remote)（BSV ではない作者の npm パッケージ）を使えます。あなたのパソコンの Node.js で動き、やり取りを上のアドレスへ取り次ぎます：

```json
{ "mcpServers": { "botshelf": { "command": "npx", "args": ["-y", "mcp-remote@0.16.7", "https://botshelfvampire.com/api/mcp"] } } }
```

<sub>Cline と Zed の書き方は、2026-11-21 に読んだ各ドキュメントのとおりです（[Cline](https://docs.cline.bot/mcp/mcp-overview)・[Zed](https://zed.dev/docs/ai/mcp)）。どちらのクライアントも、ここでは動かしていません。mcp-remote の行は 2026-11-21 に実行しました（Linux・Node.js 24）。stdio で話しかけ、`initialize`（1.2.0）、`tools/list`（ツール4つ）、`search_items` と `get_item` の1回ずつに答えが返りました。バージョンは、実行した物に固定してあります。</sub>

<a name="claude-app"></a>
## Claude アプリ（claude.ai・Claude Desktop）

Claude アプリでは、このサーバーを「カスタムコネクタ」として追加します：

1. **Customize > Connectors** を開き、**+ Add** → **Add custom connector** を押します。
2. 名前（例：BotShelf Vampire）と `https://botshelfvampire.com/api/mcp` を入れて、**Continue** を押します。
3. Claude が読み取った認証の設定を確かめて、**Continue** を押します。**Authentication** で **No sign in** を選び、**Add** を押します。
4. チャットでは **+** → **Connectors** から有効にします。

Claude のヘルプセンターによると、カスタムコネクタは Free・Pro・Max・Ultra・Team・Enterprise の各プランで使え、Free では1つまでです。
Team と Enterprise では、Owner が Organization settings > Connectors から追加します。この手順を Claude アプリの中でこちらが実行したことはありません。
出どころ：[Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)（2026-11-20 に読んだもの）。

<a name="chatgpt"></a>
## ChatGPT（Web の chatgpt.com）

ChatGPT では、このサーバーを「カスタム MCP サーバー」として追加し、プラグインとして使います：

1. [Plugins](https://chatgpt.com/plugins) を開き、＋のボタン → **Add custom MCP server** を選びます。
2. 名前（例：BotShelf Vampire）を入れ、**Connection** に `https://botshelfvampire.com/api/mcp` を入れます。
3. 認証は **No authentication** を選びます。注意の文を読んで **I understand and want to continue** にチェックを入れ、**Create as a plugin** を選びます。
4. できたプラグインを入れてから新しい会話を始め、入力欄に **@** と打って、そのプラグインを選びます。

OpenAI のヘルプセンターによると、カスタム MCP サーバーをつなげるのは Web 版の ChatGPT で、Business と Enterprise/Edu、それに Pro（読む・取ってくる権限まで）です。スマートフォンのアプリからはつなげません。
Business のワークスペースでは、作れるのは管理者とオーナーだけです。先に Developer Mode を入れる必要はありません。Free・Go・Plus については書かれていません。
このサーバーの4つのツールには、すべて「読むだけ」の印（`readOnlyHint`）が付いています。ChatGPT は、この印の無いツールを書き込みの操作として扱います。この手順を ChatGPT の中でこちらが実行したことはありません。
出どころ：[Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)・[Add custom MCP server](https://developers.openai.com/api/docs/guides/custom-mcp-server)（2026-11-21 に読んだもの）。

## 実際のやり取り

冒頭の絵は、このやり取りです（macOS の Claude Code 2.1.308、2026-11-19、サーバーはバージョン 1.1.0）。呼び出しと引数、返ってきた内容、答えは、クライアントが出力したイベントの記録から取りました。`⎿` の行はその呼び出しが返した JSON から作った1行、答えはモデルの文です（幅に合わせて折り返し、Markdown の記号は表示していません）。依頼文はコマンドラインで渡した文、版はその晩にサーバーが名乗った版で、この2つはイベントの記録には入っていません。2026-11-21 に同じ3つの呼び出しを本番のアドレス（バージョン 1.2.0）へ送ると、同じ数が返りました。

```text
> Find a code review recipe for Claude Code on the BotShelf Vampire shelf. Use the botshelf tools:
  list_filters to learn the exact where-it-runs name, then search_items with that filter (limit
  3), then get_item for the best match (max_chars 600). Answer in three short lines: the item's
  title and id, what it does, and where it stops.

● botshelf · list_filters {}
  ⎿ 1,295 items · 7 kinds · 70 where-it-runs names · 82 topics
● botshelf · search_items {"query":"code review","runs_on":"Claude Code","limit":3}
  ⎿ 6 matches · Code Review · Diff review · Research-Reviewer Team
● botshelf · get_item {"id":"/library/claude-code/code-review/","max_chars":600}
  ⎿ the first 600 of 1,874 characters of “Code Review”

- Code Review (id: /library/claude-code/code-review/)
- What it does: A fill-in Claude Code prompt that asks it to review a change for correctness,
  maintainability and regression risk. It has you inspect the context, check entry points, tests
  and call sites, then run tests, lint and type checks.
- Where it stops: The text has unfilled placeholders ([GOAL], [INPUTS], [CONTEXT_OR_FILES],
  [CONSTRAINTS]) and I read only the first 600 of 1,874 characters, so I didn't see its full
  ending. No run is recorded for it.
```

## ツール

| ツール | 返すもの |
| --- | --- |
| `search_items` | `query` のすべての語に合う項目の短いカード。`kind`・`runs_on`・`topic`・`access`・`checked`・`limit` で絞れます。 |
| `get_item` | `id`（サイトのパス）で1件。カードと、登録なしで開けるファイルがある項目では全文。長い本文は分割して返します（`offset`・`next_offset`）。 |
| `list_items` | 棚の並び順で1ページずつ。同じ絞り込みが使えます。種類ごとの件数も返します。 |
| `list_filters` | 絞り込みに使える値（種類・実行先・分野）と、それぞれの件数。 |

4つとも読み取り専用です。どのツールも、返す内容の形（`outputSchema`）を名乗るので、クライアントは返事を使う前に形を確かめられます。検索では、どの語も単語の先頭から合っている項目を先に返します。すべての語に合う項目が無く、一部の語に合う項目があるときは、近い項目を `suggestions` に入れて返します。

1,295 件のうち、登録なしで開けるのは 1,293 件。そのうち `get_item` が全文を返すのは、テキストのファイルがある 1,067 件です（AIチーム・Build Library のレシピ・Grok Bot の道具）。
それ以外は、ページへのリンクが付いたカードを返します。2026-11-19 に棚の索引から数えた件数です。

<a name="japanese-words"></a>
**日本語の言葉でも探せます**。2026-11-21 から、各項目の題・分野・種類に合う日本語の言葉（コードレビュー・セキュリティ・議事録・テスト・営業 など）でも、項目が見つかるようにしました。英語と日本語の決まった対訳表から、項目の検索用の言葉に足したものです。試した日本語の検索 48 個のうち、項目が見つかるのは 26 個から 43 個になりました。日本語の言葉を足しても、比べた英語の検索 4,623 個の返事は変わりませんでした。項目の本文は、ほとんど英語です。

<a name="word-forms"></a>
**英語の複数形でも探せます**。2026-11-21 から、項目に出てくる英語の語の複数形（prompts・AI teams・code reviews・checklists など）と、いくつかの作業の動詞の -ing 形（testing・planning・reporting など）でも、項目が見つかるようにしました。前は「prompt」で 229 件見つかるのに、「prompts」では1件も見つかりませんでした。元の語と比べた複数形・-ing 形の検索 50 個のうち、元の語より見つかる数が少ないのは 36 個から 12 個に、1件も見つからないのは 29 個から 10 個になりました。その 10 個のうち 9 個は、元の語でも見つかりません（blog posts・commit messages・user stories など。その語に合う物が棚にありません）。

## プロンプトとリソース

バージョン 1.2.0 から、プロンプト3つとリソース2つも用意しています（表示に対応したクライアント向け）。

| プロンプト | AIツールに頼む内容 |
| --- | --- |
| `find_item` (job, runs_on) | 言葉で伝えた用件に合う項目を棚から探し、上位を比べて、いちばん合うものを読みます。 |
| `use_item` (id) | 項目を1つ全文で読み、使い方を順に説明します。 |
| `shelf_overview` | 棚に何があるかをまとめます（種類、実行先、分野、登録なしで開ける件数）。 |

Claude Code では、プロンプトはスラッシュコマンドとして出ます（サーバーを `botshelf` という名前で追加した場合は `/mcp__botshelf__find_item`）。

| リソース | 中身 |
| --- | --- |
| `botshelf://shelf/overview` | 棚に何があるかを JSON で返します（`list_filters` が返すのと同じデータ）。 |
| `botshelf://shelf/guide` | このサーバーの短い使い方（Markdown）。 |
| `botshelf://item{+id}` | ひな型です。IDを続けて書くと、その項目を1つ返します（例：`botshelf://item/library/claude-code/code-review/`）。登録なしで開けるファイルがある項目は本文を、それ以外は題・概要・ページのアドレスを数行で返します。 |

## 読むもの・残すもの・上限

- 使うデータは、サイトの公開ファイル2種類だけです：棚の索引と、索引に載っている `.md` の本文ファイル。エッジのコードは、サイトを公開するときに入れたその両方の写しを持っていて、答えるあいだ、どこにもリクエストを送りません。後ろに控える関数は、同じ2種類のファイルをサイトから読みます。
- 何も書き込まず、何も保存しません。アカウントもクッキーも無く、何を尋ねたかの記録もありません。乱用を抑えるため、呼び出しの回数を、呼び出し元ごとに1分単位で数えます。呼び出し元の区別には、ネットワークアドレスの鍵つき一方向ハッシュを使います。鍵は、エッジではインスタンスの起動時に作る乱数（そのメモリの中にだけあります）、関数ではサーバー側の秘密の値です。この数はメモリの中にだけあり、表を片付けたとき、またはサーバーのインスタンスが終わったときに消えます。
- 有料の項目は、リンクが付いたカードだけを返します。本文は出しません。
- 上限：呼び出し元ごとに1分 60 回（サーバーのインスタンスごと）、1リクエスト 32 KB、1回の結果は最大 25 件、本文は1回 60,000 文字まで。回数を超えると HTTP 429 と `Retry-After`、大きすぎるリクエストには 413、範囲外の引数にはツールのエラーが返ります。
- 対応するプロトコルの版：`2025-11-25` と `2025-06-18`。1リクエストに1メッセージ。バッチは受け付けません。

## 実際に動かしたもの

- **プロトコルのテスト** `test/mcp_test.js`（327 項目：接続の手順、4つのツール、プロンプト、リソース、並び順、提案、拒否、上限）は、Node.js 24 と bun で通っています。この中で、棚の全項目について、どのツールの返事も、そのツールが名乗る形に合っていることを確かめます。
- **エッジで答えています（2026-11-19 から）**：同じコードの写しが、利用者に近いネットワークの端（エッジ）で、すべての呼び出しに答えます。関数はそのまま残してあります。エッジが身を引いたときと、ヘッダー `X-BSV-Edge: off` で関数を指定したリクエストには、関数が答えます。切り替える前に、公開中のアドレスで両方に同じリクエスト 23 件を送り、23 件ともステータスと本文が同じであることを確かめました。その晩に東京の1台から測った時間：呼び出しのたびに新しく接続した場合（TLS を含む）の中央値は、関数が 0.93 秒、エッジが 0.41 秒（各 18 回）。接続を開いたままの場合は、エッジが1回 0.09〜0.14 秒（10 回）、関数は 10 回のうち 9 回が 0.34〜0.40 秒、最初の検索の1回が 1.93 秒でした。ある晩の測定であって、約束ではありません。
- **本文もエッジに置きました（2026-11-20 から）**：`get_item` には、エッジのコードが持っている本文から答えます。それまでは、項目を最初に読むときに、そのファイルをサイトへ取りに行っていました。エッジが本文を持っていない項目には、関数が答えます。公開中のアドレスで測った値（2026-11-20、東京の1台から、接続を開いたまま）：違う項目 12 件を `get_item` で読むと、エッジでは1回 0.09〜0.14 秒。同じ 12 件を、エッジがまだ項目のファイルを取りに行っていた 2026-11-19 に読んだときは、1回 0.41〜0.76 秒でした（最後の1件をさらに3回読んだときは、メモリに残っていたので 0.10〜0.14 秒）。関数では（2026-11-20）、12 回のうち 11 回が 0.43〜0.64 秒、いちばん遅い1回が 1.03 秒でした。測定であって、約束ではありません。`test/edge_diff.mjs` が、同じリクエスト 2,719 件をエッジのコードと関数の両方に送り、どの返事もステータス・ヘッダー・本文が同じであることを確かめます（違ってよいヘッダーは、どこが答えたかを示す `X-BSV-Via` だけです。13,061 項目。エッジが持つ 1,067 件の本文は、1件ずつ、ツールの呼び出しとリソースの両方で、両方から読み、元のファイルとも比べます。Node.js 24 と bun）。
- **公開中のアドレス**：2026-11-18 と 2026-11-19 に HTTP リクエストを直接送り、`initialize`・`tools/list`・`search_items` を確かめました。サイトのフォームからは、誰でも押して確かめられます。
- **Codex CLI 0.167.0-alpha.3.2**（macOS、2026-11-18）：アドレスを設定した状態で、ツールの一覧が出ること、`search_items`・`get_item`・`list_items` を1回ずつ呼べることを確かめました。2026-11-19 には追加の1行も実行し、上の `config.toml` の行が書き込まれることを確かめました。
- **Claude Code 2.1.308**（macOS、2026-11-19）：追加の1行でアドレスが登録され、`claude mcp list` に「接続済み」と出ました。同じアドレスを設定したセッションで、3つのツールが一覧に出ること、1回ずつ呼べることを確かめました。同じ日の2回目のセッション（バージョン 1.1.0）では、4つのツールが一覧に出て、`list_filters`・`search_items`・`get_item` を呼びました。冒頭の絵は、このセッションです。バージョン 1.2.0 を公開する前には、こちらの手元でその版を動かし、同じクライアントで確かめました（2026-11-20）：4つのツールを1回ずつ呼べること、3つのプロンプトがスラッシュコマンドとして並び、そのうちの1つ（`shelf_overview`）を実行できること、リソースの一覧と読み出し（1つはひな型経由）ができること。
- **mcp-remote 0.16.7**（stdio の橋渡し、Linux・Node.js 24）、2026-11-21：`npx -y mcp-remote@0.16.7 https://botshelfvampire.com/api/mcp` の行に stdio で話しかけ、`initialize`（1.2.0）、`tools/list`（ツール4つ）、`search_items` と `get_item` の1回ずつに答えが返りました。
- **Claude Code 2.1.304 のプラグイン**（Linux、空の設定フォルダから）、2026-11-21：`claude plugin marketplace add BotShelfVampire/botshelf-mcp` と `claude plugin install botshelf-mcp@botshelfvampire` が成功し、`claude mcp list` でプラグインのサーバーがつながっていると出ました。
- **Claude Code 2.1.304 と CLAUDE.md の1行**（モデル claude-haiku-5-5、Linux）、2026-11-21：BotShelf Vampire の名前を出さない頼みを3つ、1回ずつ。1行が無いと、このサーバーを使ったのは3回中0回。1行があると3回中3回、棚を探し、いちばん近い物を読んでページを見せました（[その1行](#claude-md-line)）。
- **日本語の検索の言葉**、2026-11-21：棚の索引に、各項目の英語の題・分野・種類に合わせた日本語の言葉を入れました（決まった対訳表 122 組から。1,295 件のうち 1,243 件）。このサーバーのコードを手元で動かしたところ、日本語の検索 48 個のうち 43 個で項目が見つかり（前の索引では 26 個）、英語の検索 4,623 個は前の索引と同じ返事でした（[日本語の言葉](#japanese-words)）。
- **英語の語形**、2026-11-21：棚の索引に、各項目に出てくる英語の語（題・種類・分野・動く場所・検索用の言葉と、説明の中で棚が名前にも使う語）の複数形と、決まった表の作業の動詞の -ing 形を足しました（1,295 件に、合わせて 14,737 語。この棚では別の意味になる複数形 news・puts・futures・shares は入れていません）。このサーバーのコードを手元で動かしたところ、英語の検索 4,597 個のうち 4,269 個は前の索引と同じ返事で、見つかる数が減ったものはありませんでした。日本語の検索 48 個も同じ返事でした（[英語の複数形](#word-forms)）。
- **5つの項目の書き直し**、2026-11-21：文面が、項目の名前を入れただけの一般的な指示だった5つの項目を、それぞれの仕事のための手順に書き直しました：[Copy Editor Skill](https://botshelfvampire.com/library/skills/copy-editor-skill/)（校正・原稿の整え）、[Acceptance Criteria Skill](https://botshelfvampire.com/library/skills/acceptance-criteria-skill/)（ユーザーストーリーと Given / When / Then の受け入れ条件）、[Localization Review Skill](https://botshelfvampire.com/library/skills/localization-review-skill/)（翻訳と、翻訳のチェック）、[Alternative Generator](https://botshelfvampire.com/library/kimi-k3/alternative-generator/)（ブレインストーミング）、[Research-to-Article Team](https://botshelfvampire.com/library/agentswarm/research-to-article-team/)（ブログ記事・記事）。検索の言葉にも、proofread・user story・translate・brainstorm・blog post と、校正・ユーザーストーリー・翻訳・ブレスト・ブログを足しました。このサーバーのコードを手元で動かしたところ、日常の頼み 60 個のうち何も見つからなかったのは、前の索引では 9 個、今は 3 個です（commit message・regex・docker。棚にまだ合う物がありません）。英語の検索 4,597 個のうち 4,555 個は前と同じ返事で、見つかる数が減ったものはありませんでした。題・説明・件数は変えていません。
- **動かしていないもの**：ChatGPT・Grok Build・Gemini CLI・Cursor・VS Code・LM Studio・Kiro・Goose・Cline・Zed。行とリンクは、2026-11-18・2026-11-19・2026-11-21 に読んだ各提供元のドキュメントをもとに書きました。VS Code・Kiro・Goose のリンクは、ドキュメントにある書式です。Cursor と LM Studio のリンクは、ドキュメントにある導入リンクと同じ設定を、それぞれの提供元の Web ページに渡すものです（この Web のアドレス自体は、ドキュメントには載っていません）。上の4つのリンクは、1回ずつ開いて応答があることだけを確かめました。アプリの中でリンクを押すところまでは確かめていません。

どの記録も、1台で1回動かしたものです。動作の約束ではありません。行やリンクがうまくいかないときは、issue で知らせてください。

どこが答えたかは、返事のヘッダー `X-BSV-Via` で分かります。確かめる行と、関数を指定する行：

```bash
curl -s -D - -o /dev/null https://botshelfvampire.com/api/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | grep -i '^x-bsv-via'
curl -s -D - -o /dev/null https://botshelfvampire.com/api/mcp -H 'Content-Type: application/json' -H 'X-BSV-Edge: off' -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | grep -i '^x-bsv-via'
```

## 公開中のサーバーを自分で確かめる

```bash
git clone https://github.com/BotShelfVampire/botshelf-mcp && node botshelf-mcp/test/live_check.mjs
```

追加で入れる物はありません。組み込みの `fetch` を使います（Node.js 18 以上、または bun）。こちらでは Node.js 24 と bun で動かしました。このスクリプトは、公開中のアドレスへリクエストを 15 件送ります。14 件は MCP クライアントが送るのと同じ JSON-RPC のメッセージ（接続の手順、ツールの一覧、各ツールの呼び出し、サーバーが断るべきもの）、1件はただの GET です（これも断られるのが正しい動きです）。検索する言葉は、棚そのものから取ります。通信に失敗したリクエストと、429 が返ったリクエストは、1回だけ送り直します。1件ごとに、HTTP ステータス、手元から測った往復の時間、どこが答えたかを表示し、最後に `PASS 22 checks`、または通らなかった項目を出します。

## このリポジトリ

| パス | 中身 |
| --- | --- |
| `server.json` | MCP Registry への登録内容（`com.botshelfvampire/botshelf`）。 |
| `.mcp.json`、`.claude-plugin/` | Claude Code（と、同じ置き方を読むクライアント）が、プラグインとしてサーバーを追加するためのファイル。 |
| `src/mcp.js`、`src/_lib/mcpCore.js` | サイトで動いている関数そのもの（Netlify の関数、Node）。読み取り専用であることを確かめられるよう、公開しています。 |
| `src/edge/mcp-edge.template.js` | 呼び出しに答えているエッジ用のファイルから、差し込む部分を抜いたもの。本番のファイルは、この文面の `/*@@CORE@@*/` に `_lib/mcpCore.js` を、`"@@INDEX@@"` に棚の索引（1つの文字列）を、`"@@TEXT_ALL@@"` に項目の本文（1つの文字列）を、`"@@TEXT_AT@@"` に各本文の位置の表を入れたものです。 |
| `test/mcp_test.js` | プロトコルのテスト（`node test/mcp_test.js <tree>`。サイトのフォルダ構成を前提にし、`fetch` を差し替えるので、ネットワークには出ません）。 |
| `test/edge_diff.mjs` | エッジ用のコードと関数の突き合わせ（`node test/edge_diff.mjs <tree>`。同じ構成に、生成したエッジ用のファイルを置いて動かします。ネットワークには出ません）。 |
| `test/live_check.mjs` | 上に書いた、公開中のアドレスの確認。ここにあるテストのうち、ネットワークを使うのはこれだけです。 |
| `assets/session.svg` | 冒頭の絵。記録したやり取りを、クライアントのイベントの記録から描いたものです。 |

サーバーは botshelfvampire.com で動いています。このリポジトリは、インストールするパッケージではありません。ビルドの手順もありません。

## ライセンス

このリポジトリのコードは MIT です（[LICENSE](LICENSE)）。棚の項目には、それぞれのライセンスがあります：https://botshelfvampire.com/open/#licenses

## 関連

- サイト：[botshelfvampire.com](https://botshelfvampire.com/)。全体を1つの索引で探せます：[Explore](https://botshelfvampire.com/explore/)
- [botshelf-ai-team-registry](https://github.com/BotShelfVampire/botshelf-ai-team-registry)：Build Library の登録内容と、無料のAIチーム（`free-ai-teams/`、MIT）
- [botshelf-grok-bot-tools](https://github.com/BotShelfVampire/botshelf-grok-bot-tools)：非公式の Grok Bot の道具（Untested、MIT）。Web 版：https://botshelfvampire.com/grok-bot/tools/
