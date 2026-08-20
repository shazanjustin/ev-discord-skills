---
name: analytics-dashboard
description: Query and analyse the live CIMB social-media dashboard through authenticated, read-only JSON endpoints. Use when a Discord user asks about social performance, ER, reach, engagement, formats, organic versus paid content, collaborations, caption search, top or worst posts, trends, date ranges, or period comparisons across Facebook, Instagram, TikTok, YouTube, and LinkedIn.
---

# Analytics Dashboard

Use the dashboard backend as the trusted calculator and data source. Call its
structured endpoints, then write the interpretation yourself. Never forward a
question to `/api/chat`, query the database directly, or call write endpoints.

## Runtime configuration

Require:

```text
ANALYTICS_API_KEY
```

Use this base URL unless `ANALYTICS_API_URL` is configured:

```text
https://posts-analytics-backend.onrender.com/api/bot
```

Send the key only as this HTTPS request header:

```http
X-API-Key: <ANALYTICS_API_KEY>
```

Never print, quote, log, persist, or place the key in a URL, skill file, Git
repository, or Discord response.

## Phase 1 -- Apply the configured Discord access mode

When `ANALYTICS_ALLOW_ALL` is exactly `true` (case-insensitive), allow every
Discord user who can talk to EV to use dashboard analytics. This does not make
the backend API public; EV must still authenticate every request with
`ANALYTICS_API_KEY`.

When `ANALYTICS_ALLOW_ALL` is not `true`, enforce the optional restricted mode
before every analytics request.

Supported allowlists are comma-separated Discord IDs:

```text
ANALYTICS_ALLOWED_USERS
ANALYTICS_ALLOWED_CHANNELS
ANALYTICS_ALLOWED_ROLES
```

Compare the current `EV_USER_ID`, `EV_CHANNEL_ID`, and any role IDs supplied by
the runtime against those allowlists as exact IDs, not substrings.

- Refuse when restricted mode is active and all allowlists are empty.
- Allow when the current user, channel, or a reliably supplied role ID matches.
- Do not assume a role match when role IDs are unavailable to the runtime.
- Never reveal the configured allowlists in the response.

Tell an unauthorized user only that dashboard analytics is restricted.

## Phase 2 -- Discover the contract

At the start of an analytics session, verify the key and load the current
contract:

```bash
BASE="${ANALYTICS_API_URL:-https://posts-analytics-backend.onrender.com/api/bot}"
curl --fail-with-body --silent --show-error --max-time 90 \
  -H "X-API-Key: ${ANALYTICS_API_KEY}" \
  "${BASE}/capabilities"
```

Treat `/capabilities` as authoritative for supported tools and metric
definitions. The expected analytical tools are `summary`, `breakdown`,
`posts`, `timeseries`, and `compare`.

## Phase 3 -- Choose the smallest useful tool

### Summary

Use `GET /summary` for overall or platform KPI questions.

```bash
curl --fail-with-body --silent --show-error --max-time 90 --get \
  -H "X-API-Key: ${ANALYTICS_API_KEY}" \
  --data-urlencode "start_date=2026-07-01" \
  --data-urlencode "end_date=2026-07-31" \
  --data-urlencode "platform=Instagram" \
  "${BASE}/summary"
```

Optional filters: `start_date`, `end_date`, `platform`, `format`,
`organic_paid`, `collab`, `collab_name`, and `content_type`.

### Breakdown

Use `GET /breakdown` to group performance by a controlled dimension.

```bash
curl --fail-with-body --silent --show-error --max-time 90 --get \
  -H "X-API-Key: ${ANALYTICS_API_KEY}" \
  --data-urlencode "group_by=format" \
  --data-urlencode "platform=Instagram" \
  --data-urlencode "start_date=2026-07-01" \
  --data-urlencode "end_date=2026-07-31" \
  --data-urlencode "sort_by=total_engagement" \
  --data-urlencode "sort_order=desc" \
  "${BASE}/breakdown"
```

Group by `platform`, `format`, `platform_format`, `organic_paid`, `collab`,
`collab_name`, `month`, `week`, or `content_type`. It also accepts caption
`search` and the summary filters.

### Posts

Use `GET /posts` for caption search, rankings, and post-level evidence.

```bash
curl --fail-with-body --silent --show-error --max-time 90 --get \
  -H "X-API-Key: ${ANALYTICS_API_KEY}" \
  --data-urlencode "search=Customer Value Proposition" \
  --data-urlencode "sort_by=engagement" \
  --data-urlencode "sort_order=desc" \
  --data-urlencode "limit=20" \
  "${BASE}/posts"
```

Search is a literal, case-insensitive caption fragment. Results are bounded;
use `limit` from 1 to 100 and `offset` for pagination. Do not imply that a
bounded result contains every matching post when more pages exist.

### Time series

Use `GET /timeseries` for daily, weekly, or monthly trends.

```bash
curl --fail-with-body --silent --show-error --max-time 90 --get \
  -H "X-API-Key: ${ANALYTICS_API_KEY}" \
  --data-urlencode "granularity=week" \
  --data-urlencode "segment_by=platform" \
  --data-urlencode "start_date=2026-06-01" \
  --data-urlencode "end_date=2026-07-31" \
  "${BASE}/timeseries"
```

Segment by `overall`, `platform`, `format`, `platform_format`,
`organic_paid`, `collab`, `collab_name`, or `content_type`.

### Compare

Use `POST /compare` for two explicit date periods. Build JSON with a JSON
encoder; do not concatenate untrusted Discord text into JSON or shell code.

```bash
curl --fail-with-body --silent --show-error --max-time 90 \
  -H "X-API-Key: ${ANALYTICS_API_KEY}" \
  -H "Content-Type: application/json" \
  --data '{
    "current":{"start_date":"2026-07-01","end_date":"2026-07-31"},
    "previous":{"start_date":"2026-06-01","end_date":"2026-06-30"},
    "filters":{"platform":"Instagram"},
    "group_by":"format"
  }' \
  "${BASE}/compare"
```

Never describe a percentage change when the API returns its percentage delta
as `null`; the previous value was zero.

## Metric rules

- Standard analytics exclude Instagram Stories. `/summary` may return Stories
  separately and may also return Instagram Overall.
- Facebook ER: reactions + comments + shares, divided by Reach; use Views only
  when Reach is unavailable.
- Instagram post ER: likes + comments + shares + saves, divided by Reach; use
  Views only when Reach is unavailable.
- TikTok ER uses engagement divided by video views.
- LinkedIn ER uses likes + comments + reposts divided by impressions.
- YouTube ER uses likes + comments + shares divided by views.
- `avg_engagement_rate` is the arithmetic mean of per-content ER percentages.
- `weighted_engagement_rate` is total engagement divided by the combined ER
  denominator.
- `content_type` is derived from caption rules; do not call it a manually
  assigned content pillar.

Use the metric definitions returned by `/capabilities` if they change.

## Phase 4 -- Write the answer

State the applied platform, period, and material filters. Use the API's
coverage dates to identify incomplete ranges. Lead with the answer, support it
with the most relevant figures, and separate observations from recommendations.

For rankings, mention the evaluated record count and include post links when
useful. Do not invent causes, campaign labels, pillars, targets, or missing
metrics. When no records match, say so and suggest a broader filter.

## Failure handling

- `401`: the key is missing or incorrect. Tell the administrator to check the
  Coolify `ANALYTICS_API_KEY`; never ask for the key in Discord.
- `422`: correct invalid dates, filters, or an oversized time-series request.
- `429`: respect `Retry-After`; do not loop rapidly.
- `503`: the Render secret is missing or the service is unavailable.
- Timeout/5xx: a free Render instance may be cold. Wait briefly and retry once.
  If it still fails, report that analytics is temporarily unavailable.
- Empty data: return an honest no-data answer rather than zeros presented as
  actual performance.
