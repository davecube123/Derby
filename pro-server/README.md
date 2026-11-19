# Derby Pro server (prototype)

The small server behind Derby's **pairing advisor**. The Claude API key lives only here, never in the Derby app, because anything inside a web app can be copied.

**How a question flows:**
1. Derby works out the exact numbers on the phone: each possible mate, the chicks' bloodline, the inbreeding % and the shared ancestors.
2. The app sends those numbers, plus the farm's own breeding rules, to `POST /api/pairing`.
3. This server checks the request and asks Claude (`claude-opus-5-5`, medium effort, structured JSON answer) to rank the mates and explain why, in English or Tagalog.
4. Before answering, the server applies hard rules: any pairing over the farm's inbreeding limit is always **Avoid**, unknown birds are dropped, and skipped birds are added back.

## Run it

```sh
cd pro-server
npm install

# Practice mode: no AI and no key needed. It ranks by inbreeding only, to test the app.
MOCK=1 ACCESS_CODES=demo npm start

# Real AI
ANTHROPIC_API_KEY=sk-ant-... ACCESS_CODES=code-for-friend-1,code-for-friend-2 npm start
```

Then in Derby go to **More → Derby Pro → Settings**, enter the server address (for example `http://localhost:8787`) and one access code.

| Setting | Meaning |
| --- | --- |
| `ANTHROPIC_API_KEY` | Your Claude API key, from console.anthropic.com. Keep it secret and never commit it. |
| `ACCESS_CODES` | Comma-separated codes, one per person. **Required.** Only people with a code can spend your AI credit. |
| `ALLOWED_ORIGINS` | Sites allowed to call the server. Default: `https://davecube123.github.io,http://localhost:8080`. |
| `HOURLY_LIMIT` | Questions per code per hour. Default 20. |
| `PORT` | Default 8787. |
| `MOCK=1` | Practice mode (no AI). |

## Put it online

Any Node 20+ host works, for example Render, Railway or Fly.io:
- **root directory:** `pro-server`
- **build:** `npm install`
- **start:** `node server.js`
- **environment variables:** set the ones in the table above

Use the host's **https** address in Derby's settings, because a page on github.io can only call an https server.

## Cost

Each question sends about 3,000–6,000 tokens and gets back about 1,000–3,000. At Claude Opus 5.5 prices ($4 / $20 per million tokens) that is roughly **$0.03–0.08, or ₱2–5, per question**. The fixed instructions are cached, which makes repeat questions a little cheaper. The server prints the real token counts for every question, so you can check.

## Privacy

Only the chosen bird and its possible mates (names, bands, bloodlines, ages, notes) and the farm rules are sent, and only when someone taps **Ask the advisor**. Derby tells users this on the advisor screen.
