export class Earl {
    constructor(origin, basicPathname, optionalSearchParams) {
        this.basicPathname = basicPathname;

        this.url = new URL(origin);
        this.url.pathname = basicPathname;
        if (optionalSearchParams)
            for (const [key, value] of Object.entries(optionalSearchParams))
                this.url.searchParams.set(key, value);
    }
    setLastPathSegment(segment) {
        this.url.pathname = this.basicPathname + segment;
    }
    setSearchParam(key, value) {
        this.url.searchParams.set(key, value);
    }
    getUrlString() {
        return this.url.toString();
    }
}
