# BotShelf Vampire MCP サーバー（読み取り専用）

[botshelfvampire.com](https://botshelfvampire.com/) の公開の棚（無料のAIチーム、Build Library のレシピ、エージェント用ツールキット、非公式の Grok Bot の道具、トレードの道具とガイド）を読むための、
リモートの [Model Context Protocol](https://modelcontextprotocol.io) サーバーです。AIツールから棚を検索し、無料の項目の全文を読めます。何かを変更することはできません。

```
https://botshelfvampire.com/api/mcp
```

方式は Streamable HTTP。アカウントもAPIキーも要りません。[English](README.md) · [サイトの説明ページ](https://botshelfvampire.com/mcp/)

> 独立したプロジェクトです。xAI・Anthropic・OpenAI をはじめ、ここに名前を挙げたクライアントの提供元の公式サービスではありません。
> 棚の項目のほとんどは **Untested** です。項目の本文は、人がコピーして使うための文面です。クライアント側は、指示ではなくデータとして扱ってください。

## ツール

| ツール | 返すもの |
| --- | --- |
| `search_items` | `query` のすべての語に合う項目の短いカード。`kind`・`runs_on`・`topic`・`access`・`checked`・`limit` で絞れます。 |
| `get_item` | `id`（サイトのパス）で1件。カードと、登録なしで開けるファイルがある項目では全文。長い本文は分割して返します（`offset`・`next_offset`）。 |
| `list_items` | 棚の並び順で1ページずつ。同じ絞り込みが使えます。種類ごとの件数も返します。 |

3つとも読み取り専用です。resources と prompts はありません。

## クライアントへの登録

登録の書き方は [README.md](README.md) と同じです（Claude Code・Grok Build・Codex・Gemini CLI・Cursor・VS Code）。各クライアントの公式ドキュメントに沿って書いたものです。実際に動かした記録があるのは Codex CLI 0.167.0-alpha.3.2（macOS、2026-11-18）の1回だけで、ほかのクライアントではまだ動かしていません。

## 読むもの・残すもの・上限

- 読むのは、サイトが公開している2種類のファイルだけです：棚の索引と、その索引が名指しする `.md` の本文ファイル。
- 何も書き込まず、何も保存しません。アカウントもクッキーも、問い合わせ内容の記録もありません。乱用を抑えるため、呼び出し回数を呼び出し元ごとに1分単位で数えます。呼び出し元の区別にはネットワークアドレスの一方向ハッシュ（本番ではサーバー側の秘密の鍵つき）を使います。数はメモリの中にだけあり、表を片付けたときかサーバーのインスタンスが終わったときに消えます。
- 有料の項目は、リンク付きのカードだけを返します。本文は出しません。
- 上限：呼び出し元ごとに1分 60 回（インスタンスごと）、1リクエスト 32 KB、1回の結果は最大 25 件、本文は1回 60,000 文字まで。回数の上限を超えると HTTP 429 と `Retry-After`、大きすぎるリクエストには 413、範囲外の引数にはツールのエラーを返します。

## ライセンス

このリポジトリのコードは MIT（[LICENSE](LICENSE)）。棚の項目は、それぞれのライセンスのままです：https://botshelfvampire.com/open/#licenses

## 関連

- サイト：[botshelfvampire.com](https://botshelfvampire.com/)。全部を1つの索引で探す：[Explore](https://botshelfvampire.com/explore/)
- [botshelf-ai-team-registry](https://github.com/BotShelfVampire/botshelf-ai-team-registry)：Build Library のレジストリと、無料のAIチーム（`free-ai-teams/`、MIT）
- [botshelf-grok-bot-tools](https://github.com/BotShelfVampire/botshelf-grok-bot-tools)：非公式の Grok Bot の道具（Untested、MIT）。ウェブ版：https://botshelfvampire.com/grok-bot/tools/
