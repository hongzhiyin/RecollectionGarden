# CLI and MCP

From the project root:

```sh
node bin/recollection-garden.mjs serve
node bin/recollection-garden.mjs sessions
node bin/recollection-garden.mjs call context.get --input @request.json
```

The service binds `127.0.0.1:4320`. Connect the desired reader window using the UI. CLI reads the local `.runtime/bridge.json` configuration; never print or publish its token. `RG_BRIDGE_CONFIG` can select a separate configuration for an isolated test.

JSON input contains `sessionId`, `bookId`, `contextVersion`, optional `requestId`, and `params`. Get IDs and the current version from `sessions`; get a fresh source and draft from `context.get`. `reader.open` needs an explicit book ID; re-list sessions until that book is open and context is ready.

| Operation | Parameters / result |
|---|---|
| `books.list` | Book metadata in the explicitly chosen window |
| `context.get` | Current location, main location, selected original text and separate edited draft |
| `page.read` | `page`: one physical PDF page, maximum 40,000 characters; no silent truncation |
| `draft.get` | Current local question draft, or null |
| `citations.list` | Current book's saved source anchors |
| `citation.create` | `source` from the returned context or current draft, `intent`, optional `editedText`; returns verified citation including `id` |
| `citation.locate` | `citationId`; temporary text or page-level location |
| `reader.navigate` | `page`, optional `zoom` (`fit-width` or percent 25–300) |
| `reader.return` / `reader.continue` | Return to the main location / explicitly continue at the inspected location |
| `conversation.publish` | `conversationId`, `messageId`, increasing `sequence`, `text`, `status`, `citationIds`, `sourceLabel`, optional `role` |
| `conversation.list` | Messages previously received for the explicitly specified book |
| `requests.get` | `targetRequestId`; pending, complete, uncertain or unknown result |
| `notes.create` | `kind`: quote / answer / page; quote takes a verified `citationId` or `source`; answer takes `conversationId`, `messageId`, `expectedSequence`, optional `questionMessageId` and fallback `page`; page takes `page`. Optional `title`, `userContent`. Returns `{created,note}` |
| `notes.list` / `notes.get` | Explicit book; metadata list / one record by `noteId` |
| `notes.update` | `noteId`, `expectedRevision`, `title`, `userContent`; immutable original and AI snapshots |
| `notes.delete` | `noteId`, `expectedRevision`, `confirmed`; explicit user request and confirmation required |
| `notes.search` | `query` ≤200 characters, optional `kind`, `sort`: created_desc/created_asc/page_asc, `offset`, `limit` 1–100 (default 50), subsequent pages carry `expectedResultVersion`; returns metadata, matched fields, ≤160-character source snippet, total, hasMore, resultVersion |
| `notes.locate` | `noteId`, optional `sourceIndex` (default 0); opens the book if needed, then temporarily locates its saved source or note page; returns page, precision, preview and fallback reason |
| `notes.export` | Optional query/kind/sort (default page_asc), `chunkIndex` default 0, subsequent chunks require `expectedContentHash`; returns content/hash, chunk index/count, note count, filename and MIME type; export includes all matches, not only one search page |

Every operation returns `{ok:true,data}` or `{ok:false,error:{code,message}}`. Reads must not be described as successful when `ok` is false. Terminal message statuses are `complete`, `cancelled`, or `error`; unfinished updates use `streaming`. Message text is plain text, with references supplied as actual citation IDs. Do not invent page numbers or cite another book.

MCP launches `node bridge/mcp.mjs` as a stdio server. Tool names map mechanically: `context.get` → `rg_context_get`, `conversation.publish` → `rg_conversation_publish`. Tools use the same JSON fields and parameters as CLI. MCP does not start the bridge or a model; start the bridge separately and connect a reader window. The package pins MCP SDK 1.32.1 for the v1 compatibility line; client/server versions must be negotiated by the SDK.

V0.6.0 supplies 23 tools including eight `rg_notes_*` tools. List/get/search/export/update/delete and saved-citation or answer creation do not require an open PDF; a raw selection must be verified against its open source PDF. `notes.list` contains no private note body; search adds only authorized short snippets. A repeated answer returns `created:false`; do not treat that as an edit or overwrite personal content. `VERSION_CONFLICT` retains the old draft; `MESSAGE_NOT_COMPLETE` and `MESSAGE_CHANGED` require checking the actual source again.

Search is literal, NFKC/case/whitespace normalized, with all whitespace-separated terms required across saved fields. It never searches the entire PDF or unsaved chat. `RESULT_CHANGED` requires restarting pagination. Export is UTF-8 Markdown of saved notes, with separate original/AI/personal sections. Each chunk is ≤64KiB; concatenate without inserted separators and verify the full contentHash. `EXPORT_CHANGED` rejects mixed versions; save only after all chunks pass. Notes locate preserves main progress and rejects dirty drafts, missing PDFs, invalid pages or mismatched file hashes. Refresh the host's MCP connection after tool-definition changes.
