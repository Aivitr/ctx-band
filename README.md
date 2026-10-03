# ctx-band

A band above the prompt for Claude Code: what this turn has spent so far — tool
calls, model requests, tokens and cache hit — and one rotating blessing.

```
3 tools  ·  5 requests  ·  ↑ 98.3k  ↓ 5k  ·  cache 97%              爱你老己。  ↻
```

- **tools / requests** — this turn's tool calls and model requests, reset at
  `turn.start`. A refused or failed call adds a red `n failed` beside them.
- **↑ / ↓** — this turn's input (uncached + cache write + cache read) and output
  tokens, summed over its requests. Sub-agent steps count toward the turn too.
- **cache** — the share of that input that came from a cache read. The colour
  steps red → orange → yellow → blue → green at 20 / 40 / 60 / 80%.
- **blessing** — a rotating quote pool (LoveLaoJiCLI lines + short lines from
  world literature, philosophy and the Bible). Click `↻` to reroll; it rerolls
  itself every three turns. While the model works, it breathes behind the
  engine's accent-orange spinner.

## Install

From a clone:

```sh
claude --plugin-dir /path/to/ctx-band
```

Requires the plugin-authoring hot-reload environment (see Anthropic's docs):
a plugin folder with `hooks/register.tsx` and the engine API.

## Development

```sh
claude plugin validate .
claude plugin test .
```

## Notes

- Blessing pool: the first six lines are from
  [LoveLaoJiCLI](https://github.com/Dailiduzhou/LoveLaoJiCLI); Bible verses use
  the CUV (Union Version, 1919, public domain).
