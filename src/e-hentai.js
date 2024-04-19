/*

Fetches and contains parsing logic of e-hentai.org/hentaiathome.php

*/

import { HttpError } from './handler'

class TableContext {
    constructor(index) {
        this.tableIndex = index
        this.tableCount = 0
        this.tr = []
    }

    _checkTable() {
        return this.tableIndex === this.tableCount - 1
    }

    element(el) {
        if (el.tagName === 'table') {
            this.tableCount++
        }
    }

    newTr() {
        if (!this._checkTable()) {
            return
        }
        this.tr.push([])
    }

    newTd() {
        if (!this._checkTable()) {
            return
        }
        this.tr[this.tr.length - 1].push('')
    }

    appendTdText(text) {
        if (!this._checkTable()) {
            return
        }
        const tr = this.tr[this.tr.length - 1]
        const i = tr.length - 1
        tr[i] += text
    }
}

class TrHandler {
    constructor(ctx) {
        this.ctx = ctx
    }

    element(el) {
        this.ctx.newTr()
    }
}

class TdHandler {
    constructor(ctx) {
        this.ctx = ctx
    }

    element(el) {
        this.ctx.newTd()
    }

    text(t) {
        this.ctx.appendTdText(t.text)
    }
}

async function fetchHomePageData(authHeaders) {
    const resp = await fetch('https://e-hentai.org/hentaiathome.php', {
        headers: authHeaders,
        redirect: 'manual',
    })

    if (resp.status >= 400) {
        throw new HttpError(resp.status, resp.statusText)
    } else if (resp.status === 302) {
        //login page
        throw new HttpError(401, 'login failed')
    }

    const regionsCtx = new TableContext(0)
    const clientsCtx = new TableContext(0)
    const text = await new HTMLRewriter()
        .on('table', regionsCtx)
        .on('table>tr', new TrHandler(regionsCtx))
        .on('table>tr>td', new TdHandler(regionsCtx))
        .on('table#hct', clientsCtx)
        .on('table#hct>tr', new TrHandler(clientsCtx))
        .on('table#hct>tr>td', new TdHandler(clientsCtx))
        .transform(resp)
        .text()

    if (text.includes('Your IP address has been temporarily')) {
        throw new HttpError(403, text)
    }

    let regions = []
    regionsCtx.tr.shift()
    for (const tr of regionsCtx.tr) {
        const region = {
            name: tr[0],
            load: tr[3].replace(' MB/s', ''),
            hits_per_sec: tr[4],
            coverage: tr[5],
            hits_per_gb: tr[6],
            quality: tr[7],
        }
        regions.push(region)
    }

    let clients = []
    clientsCtx.tr.shift()
    for (const tr of clientsCtx.tr) {
        const client = {
            name: tr[0],
            id: tr[1],
            status: tr[2].toLowerCase(),
            created: tr[3],
            last_seen: tr[4],
            file_served: tr[5].replaceAll(',', ''),
        }

        if (client.status === 'online') {
            client.ip = tr[6]
            client.port = tr[7]
            client.version = tr[8]
            client.max_speed = tr[9].replace(' KB/s', '')
            client.trust = tr[10]
            client.quality = tr[11]
            client.hit_rate = tr[12].replace(' / min', '')
            client.hath_rate = tr[13].replace(' / day', '')
            client.country = tr[14]
        }

        clients.push(client)
    }

    return { regions, clients }
}

async function fetchClientPageData(clientId, authHeaders) {
    const url = `https://e-hentai.org/hentaiathome.php?cid=${clientId}&act=settings`
    const resp = await fetch(url, {
        headers: authHeaders,
        redirect: 'manual',
    })

    if (resp.status >= 400) {
        throw new HttpError(resp.status, resp.statusText)
    } else if (resp.status === 302) {
        //login page
        throw new HttpError(401, 'login failed')
    }

    const tableCtx = new TableContext(0)
    const text = await new HTMLRewriter()
        .on('table.infot', tableCtx)
        .on('table.infot>tr', new TrHandler(tableCtx))
        .on('table.infot>tr>td', new TdHandler(tableCtx))
        .transform(resp)
        .text()

    if (text.includes('Your IP address has been temporarily')) {
        throw new HttpError(403, text)
    }

    // Look for static range and priority ranges
    const result = {};
    const row = tableCtx.tr[9][1];
    result.static_range = row.match(/has (\d+) static /)?.[1];

    [...row.matchAll(/P(\d) = (\d+)/g)].map(p => {
        const level = p[1];
        const value = p[2];
        result[`p${level}_range`] = value;
    });

    return result;
}

export async function fetchHentaiAtHomeData(id, phash) {
    const authHeaders = { Cookie: `ipb_member_id=${id}; ipb_pass_hash=${phash};` }
    const data = await fetchHomePageData(authHeaders);

    // Augment with data from client page
    for (const [index, client] of data.clients.entries()) {
        const clientData = await fetchClientPageData(client.id, authHeaders);

        data.clients[index] = {
            ...client,
            ...clientData
        };
    }

    return data;
}