export class Earl {
    constructor(origin, basicPathname, optionalSearchParams) {
        this.basicPathname = basicPathname;

        this.url = new URL(origin);
        this.url.pathname = basicPathname;
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
    async fetchJson() {
        return (await fetch(this.url)).json();
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
