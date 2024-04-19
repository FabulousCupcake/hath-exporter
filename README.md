# Hath metrics
Hentai@Home metrics with prometheus and cloudflare workers.

## Usage
You can deploy the worker to Cloudflare via `wrangler`:

```bash
# Login
npx wrangler login

# Deploy
npx wrangler deploy

# Set secrets
npx wrangler secret put IPB_MEMBER_ID
npx wrangler secret put IPB_PASS_HASH

# Test if it works
curl https://hath-exporter.my-project.workers.dev/metrics
```

Then configure prometheus or alloy to scrape it:
```yaml
 - job_name: 'hath-worker'
   scrape_interval: 30m
   scheme: https
   static_configs:
   - targets: ['hath-exporter.my-project.workers.dev:443']
```

```ini
prometheus.scrape "hath_exporter" {
  scheme = "https"
  targets = [
      {"__address__" = "hath-exporter.my-project.workers.dev"},
  ]
  forward_to = [prometheus.remote_write.metrics_service.receiver]
  scrape_interval = "30m"
}
```

## Available Metrics
| Name                          | Type    | labels          |
|-------------------------------|---------|-----------------|
| hath_region_load              | Gauge   | region          |
| hath_region_miss              | Gauge   | region          |
| hath_region_coverage          | Gauge   | region          |
| hath_region_hits              | Gauge   | region          |
| hath_region_quality           | Gauge   | region          |
| hath_client_status            | Gauge   | name,id,country |
| hath_client_created           | Gauge   | name,id,country |
| hath_client_file_served_total | Counter | name,id,country |
| hath_client_max_speed         | Gauge   | name,id,country |
| hath_client_trust             | Gauge   | name,id,country |
| hath_client_quality           | Gauge   | name,id,country |
| hath_client_hit_rate          | Gauge   | name,id,country |
| hath_client_hath_rate         | Gauge   | name,id,country |

## Development
Put `.dev.vars` file in the project root containing the forum secrets:

```sh
IPB_MEMBER_ID=12345678
IPB_PASS_HASH=0f18fd4cf40bfb1dec646807c7fa5522
```

Then use `wrangler` via `npm run dev`:
```sh
$ npm run dev
> hath-metrics-workers@0.1.0 dev
> wrangler dev

 ⛅️ wrangler 3.51.2
-------------------
Using vars defined in .dev.vars
Your worker has access to the following bindings:
- Vars:
  - IPB_MEMBER_ID: "(hidden)"
  - IPB_PASS_HASH: "(hidden)"
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

## Obtaining secrets
Head to [hentaiathome.php][1], open the console with F12, and run the following:

```js
document.cookie.match(/ipb_member_id=(\d+)/)[1];
document.cookie.match(/ipb_pass_hash=(.+?);/)[1];
```

[1]: https://e-hentai.org/hentaiathome.php