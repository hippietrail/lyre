import { config } from 'dotenv';
import type { DomNode } from './dom';
import parse from 'html-dom-parser';

export type IsRedirect = boolean | undefined;

export class Earl {
    url: import("url").URL;
    basicPathname?: string;
    constructor(origin: string, optionalBasicPathname?: string, optionalSearchParams?: Record<string, string | number>) {
        this.basicPathname = optionalBasicPathname || '/';

        this.url = new URL(origin);
        this.url.pathname = this.basicPathname;
        if (optionalSearchParams)
            for (const [key, value] of Object.entries(optionalSearchParams))
                this.url.searchParams.set(key, value.toString());
    }
    setBasicPathname(basicPathname: string) {
        this.basicPathname = basicPathname;
    }
    setPathname(pathname: string) {
        this.url.pathname = pathname;
    }
    getPathname() {
        return this.url.pathname;
    }
    setLastPathSegment(segment: string) {
        this.url.pathname = this.basicPathname + segment;
    }
    setSearchParam(key: string, value: string) {
        this.url.searchParams.set(key, value);
    }
    // handy for relative hrefs
    getOrigin() {
        return this.url.origin;
    }
    // handy since the URL encodes spaces etc for us
    getUrlString() {
        return this.url.toString();
    }
    async fetchJson() {
        return (await fetch(this.url)).json();
    }
    async fetchDom() {
        return parse(await this.fetchText()) as DomNode[];
    }
    // sometimes we want the HTML (scraping, debugging when JSON is broken)
    async fetchText() {
        return (await fetch(this.url)).text();
    }
    async checkRedirect(): Promise<IsRedirect> {
        // using a closure so we can report the correct URL in case of an error
        return (async function(link: string) {
            try {
                return Math.floor((await fetch(link, { method: 'HEAD', redirect: 'manual' })).status / 100) === 3;
            } catch (error: any) {
                // ignore the most common, timeout, short message for somehwat common, long message for others
                if (['UND_ERR_SOCKET', 'ECONNRESET'].includes(error.cause.code))
                    console.log(`!!${link}!!`, error.cause.code);
                else if (error.cause.code !== 'UND_ERR_CONNECT_TIMEOUT')
                    console.log(`!!${link}!!`, JSON.stringify(error, null, 2));
                // NOTE: ENOTFOUND is also occasionally returned
                // neither true nor false
                return undefined;
            }
        })(this.url.href);
    }

    // apilayer.com that we use for currency exchange rates is sometimes broken
    async fetchJsonWithError() {
        const r = await fetch(this.url);
        if (r.headers.get('content-type') !== 'application/json') {
            console.log(typeof r);
            console.log(r);
            console.log(Object.keys(r));
            // how can we access files of an object which are Symbols?
            console.log(Object.getOwnPropertySymbols(r));
            console.log(JSON.stringify(r, null, 2));
            return null;
        }
        return await r.json();
    }
}

// https://docs.github.com/en/rest/activity/events?apiVersion=2022-11-28#list-public-events-for-a-user
export class GithubEarl extends Earl {
    constructor() {
        super('https://api.github.com', '/users/USER/events/public');
    }
    setUserName(username: string) {
        this.setPathname(`/users/${username}/events/public`)
    }
    setPerPage(perPage: number) {
        this.setSearchParam('per_page', perPage.toString());
    }
}

// fetch the "playlist" which is actually all the channel's videos
export class YoutubeVidsEarl extends Earl {
    constructor() {
        config();

        if (!process.env.YT_API_KEY) {
            throw new Error(`[YouTubeVidsEarl] missing YT_API_KEY`);
        }

        super('https://www.googleapis.com', '/youtube/v3/playlistItems', {
            part: 'snippet',
            order: 'date',
            key: process.env.YT_API_KEY,
        });
    }
    setMaxResults(maxResults: number) {
        this.url.searchParams.set('maxResults', maxResults.toString());
    }
    setPlaylistId(playlistId: string) {
        this.url.searchParams.set('playlistId', playlistId);
    }
    fetchPlaylistById(playlistId: string) {
        this.setPlaylistId(playlistId);
        return this.fetchJson();
    }
}
