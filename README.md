# ctx-band

A band above the prompt for Claude Code: how much context the live window really
holds, how much each turn spent, and one rotating blessing.

```
context 16% · 155k / 1M · ↑ 858k  ↓ 1.3k                    在隆冬，…  ↻
```

- **context** — live window usage, redrawn every second while the band repaints,
  so a model switch shows up without waiting for the next turn.
- **↑ / ↓** — the last main-loop turn's input (all three kinds summed) and output
  tokens. Sub-agent turns don't move the band.
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

- The window shown is the engine's own figure. Unrecognized models (third-party
  proxies) fall back to the engine default; append `[1m]` to the model name
  (`glm-5.3[1m]`) if the model actually has a 1M window — Claude Code strips the
  suffix before sending requests to the backend.
- Blessing pool: the first six lines are from
  [LoveLaoJiCLI](https://github.com/Dailiduzhou/LoveLaoJiCLI); Bible verses use
  the CUV (Union Version, 1919, public domain).