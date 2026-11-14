# Coarena for agents

> How an AI agent uses Coarena: any model through one OpenAI- or Anthropic-compatible API, free daily usage, asking for more, rating replies and reading its own requests, all by API.

Paste this to your agent, with your key in place of `<your key>`:

```text
Use Coarena's free Model API for this project.
OpenAI-compatible base URL: https://coarena.ai/api/v1
Anthropic-compatible base URL: https://coarena.ai/api
API key: <your key>
Pick any model id from https://coarena.ai/api/v1/models. Rate a reply with POST https://coarena.ai/api/v1/feedback.
```

## What you get

One key, and everything below works from code.

- Any model on Coarena, through one OpenAI- or Anthropic-compatible API.
- $5 of model use a day, free. Coarena pays.
- More when you need it: ask by API, no form.
- A thumbs up or down on any reply, by API.
- Every request you made, readable by API.

## The key

Your person creates it at [https://coarena.ai/account/api](https://coarena.ai/account/api) and gives it to you. Send it as `Authorization: Bearer` (or `x-api-key`).

## Claude Code

Two variables, then run `claude` as usual.

```sh
export ANTHROPIC_BASE_URL=https://coarena.ai/api
export ANTHROPIC_AUTH_TOKEN=$COARENA_API_KEY
```

## Codex

The key in `COARENA_API_KEY`, then this in Codex's config: it speaks the Responses API, served at the same base URL.

```toml
# ~/.codex/config.toml
model_provider = "coarena"
model = "claude-fable-5"
# Codex adds a web search tool the Model API does not run
web_search = "disabled"

[model_providers.coarena]
name = "Coarena"
base_url = "https://coarena.ai/api/v1"
env_key = "COARENA_API_KEY"
wire_api = "responses"
```

## OpenAI SDK (Python)

Any OpenAI client: the base URL and the key.

```python
import os
from openai import OpenAI
client = OpenAI(base_url="https://coarena.ai/api/v1", api_key=os.environ["COARENA_API_KEY"])
print(client.chat.completions.create(model="claude-fable-5", messages=[{"role": "user", "content": "Hello"}]).choices[0].message.content)
```

## Anthropic SDK (Python)

Any model answers here, not only Claude.

```python
import os
from anthropic import Anthropic
client = Anthropic(base_url="https://coarena.ai/api", api_key=os.environ["COARENA_API_KEY"])
message = client.messages.create(model="claude-fable-5", max_tokens=1024, messages=[{"role": "user", "content": "Hello"}])
```

## Calls

The ones an agent needs most. Every call takes the same key.

| Call | What |
| --- | --- |
| `GET /api/v1/models` | The model ids (no key needed). |
| `POST /api/v1/chat/completions` | Call a model, OpenAI-style (also /responses). |
| `POST /api/v1/messages` | Call a model, Anthropic-style. |
| `POST /api/v1/feedback` | `{"request_id": "…", "rating": "up"}` rates a reply. |
| `GET /api/v1/limits` | Today's use, your limits, any open ask. |
| `POST /api/v1/limits/requests` | `{"usd_per_day": 10, "requests_per_minute": 60, "note": "…"}`, all optional. |
| `GET /api/v1/requests` | Your requests, newest first. |

## When you hit a limit

A daily-limit 429 and a per-minute 429 carry `error.limit_increase`: the exact call that asks for more of that limit (a daily one also says if an ask is already waiting). Make that call, tell your person, and retry after the reset.

```sh
curl https://coarena.ai/api/v1/limits/requests \
  -H "Authorization: Bearer $COARENA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## More

The [Model API docs](https://coarena.ai/docs), the full [API reference](https://coarena.ai/developers) and the [OpenAPI spec](https://coarena.ai/api/openapi.json). This page as plain text: [/for-agents.md](https://coarena.ai/for-agents.md).
