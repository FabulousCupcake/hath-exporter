/*

This is basically an alternative and extremely lean implementation of prom-client,
since we don't actually need to keep track of and mutate the Counters or Gauges
like traditional metric exporters.

It basically boils down to a simple templater that produces [prometheus metrics][1].

[1]: https://github.com/prometheus/docs/blob/master/content/docs/instrumenting/exposition_formats.md

*/

function formatMetric(type, { name, help, val, labels }) {
    const fmt = `# HELP ${name} ${help}
# TYPE ${name} ${type}
${name}${formatLabels(labels)} ${resolveValue(val)}`
    return fmt
}

function formatLabels(labels) {
    if (!labels) {
        return ''
    }

    const entires = Object.entries(labels)
    if (entires.length === 0) {
        return ''
    }

    let s = ''
    for (const [k, v] of entires) {
        s += `${k}="${String(v).replace(/(["\n\\])/g, '\\$1')}",`
    }
    return `{${s}}`
}

function resolveValue(value) {
    if (Number.isNaN(value)) {
        return 'Nan'
    } else if (!Number.isFinite(value)) {
        if (value < 0) {
            return '-Inf'
        } else {
            return '+Inf'
        }
    } else {
        return `${value}`
    }
}

export default {
    Counter: (...args) => formatMetric('counter', ...args),
    Gauge: (...args) => formatMetric('gauge', ...args),
}
