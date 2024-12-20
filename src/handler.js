import { fetchHentaiAtHomeData } from './e-hentai'
import prom from './prometheus'

export class HttpError extends Error {
    constructor(code, ...args) {
        super(...args)
        this.code = code
        Error.captureStackTrace(this, HttpError)
    }
}

// Override the `globalThis` env param with URL Query String
// This allows the worker to be a more generic metric exporter
async function resolveConfig(request) {
    const { searchParams } = new URL(request.url)

    console.log()

    const ipb_member_id = searchParams.get("IPB_MEMBER_ID") || globalThis.IPB_MEMBER_ID;
    const ipb_pass_hash = searchParams.get("IPB_PASS_HASH") || globalThis.IPB_PASS_HASH;

    return {
        ipb_member_id,
        ipb_pass_hash,
    }
}

async function handleMetricsJson(request) {
    const config = await resolveConfig(request)
    const data = await fetchHentaiAtHomeData(config.ipb_member_id, config.ipb_pass_hash)

    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
        },
    })
}

async function handleMetricsPrometheus(request) {
    const config = await resolveConfig(request)
    const data = await fetchHentaiAtHomeData(config.ipb_member_id, config.ipb_pass_hash)

    let metrics = []
    for (const r of data.regions) {
        const labels = { region: r.name.toLowerCase() }
        metrics.push(
            prom.Gauge({
                name: 'hath_region_load',
                help: 'region load (MB/s)',
                val: r.load,
                labels: labels,
            }),
            prom.Gauge({
                name: 'hath_region_hits_per_second',
                help: 'region hits per second',
                val: r.hits_per_sec,
                labels: labels,
            }),
            prom.Gauge({
                name: 'hath_region_hits_per_gb',
                help: 'region hits per gigabyte',
                val: r.hits_per_gb,
                labels: labels,
            }),
            prom.Gauge({
                name: 'hath_region_quality',
                help: 'region quality',
                val: r.quality,
                labels: labels,
            }),
        )
    }

    for (const c of data.clients) {
        const labels = {
            name: c.name,
            id: c.id,
            country: c.country,
        }
        metrics.push(
            prom.Gauge({
                name: 'hath_client_status',
                help: 'client status 1 online, 0 offline',
                val: c.status === 'online' ? 1 : 0,
                labels: labels,
            }),
            prom.Gauge({
                name: 'hath_client_created',
                help: 'client created time (timestamp in ms)',
                val: new Date(c.created).getTime(),
                labels: labels,
            }),
            prom.Counter({
                name: 'hath_client_file_served_total',
                help: 'client total served file',
                val: c.file_served,
                labels: labels,
            }),
            prom.Counter({
                name: 'hath_client_static_range',
                help: 'client number of static range',
                val: c.static_range,
                labels: labels,
            }),
            prom.Counter({
                name: 'hath_client_p1_range',
                help: 'client number of p1 range',
                val: c.p1_range || 0,
                labels: labels,
            }),
            prom.Counter({
                name: 'hath_client_p2_range',
                help: 'client number of p2 range',
                val: c.p2_range || 0,
                labels: labels,
            }),
            prom.Counter({
                name: 'hath_client_p3_range',
                help: 'client number of p3 range',
                val: c.p3_range || 0,
                labels: labels,
            }),
            prom.Counter({
                name: 'hath_client_p4_range',
                help: 'client number of p4 range',
                val: c.p4_range || 0,
                labels: labels,
            }),
            prom.Counter({
                name: 'hath_client_hc_range',
                help: 'client number of HC range',
                val: c.hc_range || 0,
                labels: labels,
            }),
        )

        if (c.status === 'online') {
            metrics.push(
                prom.Gauge({
                    name: 'hath_client_max_speed',
                    help: 'client max speed (KB/s)',
                    val: c.max_speed,
                    labels: labels,
                }),
                prom.Gauge({
                    name: 'hath_client_trust',
                    help: 'client trust',
                    val: c.trust,
                    labels: labels,
                }),
                prom.Gauge({
                    name: 'hath_client_quality',
                    help: 'client quality',
                    val: c.quality,
                    labels: labels,
                }),
                prom.Gauge({
                    name: 'hath_client_hit_rate',
                    help: 'client hit rate (min)',
                    val: c.hit_rate,
                    labels: labels,
                }),
                prom.Gauge({
                    name: 'hath_client_hath_rate',
                    help: 'client hath rate (day)',
                    val: c.hath_rate,
                    labels: labels,
                }),
            )
        }
    }

    return new Response(metrics.join('\n'), {
        headers: {
            'Content-Type': 'text/plain; version=0.0.4',
        },
    })
}

export async function handleRequest(request) {
    try {
        const pathname = new URL(request.url).pathname.toLowerCase()

        if (pathname === '/metrics') {
            return handleMetricsPrometheus(request)
        }
        if (pathname === '/metrics-raw') {
            return handleMetricsJson(request)
        }

        return new Response('not found', { status: 404 })
    } catch (e) {
        let opt = {
            status: 500,
        }
        if (e instanceof HttpError) {
            opt.status = e.code
            opt.statusText = e.message
        } else {
            console.log('handleRequest failed', e)
        }
        return new Response(null, opt)
    }
}
