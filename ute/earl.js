import { config } from 'dotenv';

export class Earl {
    constructor(origin, optionalBasicPathname, optionalSearchParams) {
        this.basicPathname = optionalBasicPathname || '/';

        this.url = new URL(origin);
        this.url.pathname = this.basicPathname;
        if (optionalSearchParams)
            for (const [key, value] of Object.entries(optionalSearchParams))
                this.url.searchParams.set(key, value);
    }
    setPathname(pathname) {
        this.url.pathname = pathname;
    }
    setLastPathSegment(segment) {
        this.url.pathname = this.basicPathname + segment;
    }
    setSearchParam(key, value) {
        this.url.searchParams.set(key, value);
    }
    // handy since the URL encodes spaces etc for us
    getUrlString() {
        return this.url.toString();
    }
    async fetchJson() {
        return (await fetch(this.url)).json();
    }
    // sometimes we want the HTML (scraping, debugging when JSON is broken)
    async fetchText() {
        return (await fetch(this.url)).text();
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
    setUserName(username) {
        this.setPathname(`/users/${username}/events/public`)
    }
    setPerPage(perPage) {
        this.setSearchParam('per_page', perPage);
    }
}

// fetch the "playlist" which is actually all the channel's videos
export class YoutubeVidsEarl extends Earl {
    constructor() {
        config();

        super('https://www.googleapis.com', '/youtube/v3/playlistItems', {
            part: 'snippet',
            order: 'date',
            key: process.env.YT_API_KEY,
        });
    }
    setMaxResults(maxResults) {
        this.url.searchParams.set('maxResults', maxResults);
    }
    setPlaylistId(playlistId) {
        this.url.searchParams.set('playlistId', playlistId);
    }
}
