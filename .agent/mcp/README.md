# MCP servers for this project

This folder documents which Model Context Protocol (MCP) servers to enable
inside Google Antigravity for the Sahulat repo, and **why** each one.

Antigravity supports MCP through a UI in **Settings → MCP** (and also reads
a workspace `mcp.json` file). There are two camps:

| Provider                          | What it gives the agent                                                 | Where it runs |
| --------------------------------- | ----------------------------------------------------------------------- | ------------- |
| **Supabase MCP**                  | List tables, run SQL, inspect storage, branch DBs, fetch docs           | Remote HTTPS  |
| **MCP Toolbox for Databases**     | Generic Postgres / Supabase tool-builder (`list_tables`, `execute_sql`) | Local `npx`   |
| Filesystem / Git / GitHub         | The agent can edit code & open PRs                                      | Local         |
| Sequential-Thinking + Memory      | Multi-step reasoning + scratchpad (built into Antigravity Manager)     | Local         |

For this project you only **need** Supabase MCP. Everything else is optional.

## Add Supabase MCP (recommended)

Antigravity has a UI for this — easiest path:

1. Open **Antigravity → Settings → MCP → Add MCP server**.
2. Pick **Supabase** from the store. Sign in to Supabase when prompted.
3. Choose your project (`antigravity-service-orchestrator`).
4. Restrict scope to: **Database (read-only)** + **Storage (read-only)** for
   safety. Toggle on **Development** only when you actively want the agent
   to create branches or run migrations.

That's it. The agent now has direct query access to the same `bookings`,
`traces`, `providers` tables this app uses.

### If you prefer the JSON config form

Workspace MCP config lives at `~/.antigravity/mcp.json` (global) or
`<workspace>/.agent/mcp.json` (per-project). Paste the snippet from
[`mcp.example.json`](./mcp.example.json) and substitute your values.

## Why MCP for THIS project

- **Read traces during development** — the agent can query
  `select agent, step, rationale, latency_ms from traces order by created_at
  desc limit 20` instead of asking you to copy-paste output.
- **Inspect rankings without rebooting** — query `providers` to verify
  matcher behavior changes during code edits.
- **Debug RLS / migrations** — the agent runs the SQL inside Antigravity
  rather than asking you to context-switch.

## What we deliberately do NOT add to MCP

- **Gemini API key** — handled directly via `@google/generative-ai` SDK at
  runtime; no need for a tool wrapper.
- **Google Places key** — also handled directly via `fetch`. MCP-wrapping
  Places adds latency without value.
- **Production write access** — Supabase MCP scope should be read-only on
  prod data. Use the service-role key only inside server actions, not via
  a chat tool.
