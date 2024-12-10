import { Earl } from '../../ute/earl';
import { domStroll, DomNode } from '../../ute/dom';
import parse from 'html-dom-parser';

export async function callGo() {
    const verCmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    const goEarl = new Earl('https://go.dev', '/doc/devel/release');
    try {
        const article = domStroll('Go', false, await goEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body', { cls: 'Site' }],
            [9, 'main', { id: 'main-content' }],
            [1, 'article', { cls: 'Doc' }],
        ])!;

        const elements = article.children!.filter(e => e.type === 'tag' && ['h2', 'p'].includes(e.name!));

        let biggestVer: string | null = null;
        let dateOfBiggestVer: string | null = null;

        for (const element of elements) {
            const mat = element.children![0].data!.trim().match(/^go(\d+(?:\.\d+)*)\s+\(released (\d+-\d+-\d+)\)/m);
            if (mat && (biggestVer === null || verCmp(mat[1], biggestVer) > 0)) {
                biggestVer = mat[1];
                dateOfBiggestVer = mat[2];
            }
        }

        if (biggestVer) {
            return [{
                name: 'Go',
                ver: biggestVer,
                link: `https://go.dev/doc/devel/release#go${biggestVer}`,
                timestamp: new Date(dateOfBiggestVer!),
                src: 'go.dev',
            }];
        }
    } catch (error) {
        console.error(`[Go]`, error);
    }
    return [];
}

export async function callRvm() {
    const rvmEarl = new Earl('https://www.retrovirtualmachine.org', '/changelog/');
    try {
        const article = domStroll('RVM', false, await rvmEarl.fetchDom(), [
            [2, 'html'],
            [1, 'body'],
            [2, 'div', { cls: 'mainContent' }],
            [3, 'article', { cls: 'content' }],
        ])!;

        const h2s = article.children!.filter(e => e.type === 'tag' && e.name === 'h2');

        for (const h2 of h2s) {
            const mat = h2.children![0]?.data?.trim().match(/^RetroVM v(\d+(?:\.\d+)*)\s+\((\d+\/\d+\/\d+)\)/m);
            if (mat) {
                const date = mat[2]?.split('/')?.reverse()?.join('-');

                return [{
                    name: 'Retro Virtual Machine',
                    ver: mat[1],
                    link: 'https://www.retrovirtualmachine.org/changelog/',
                    timestamp: date ? new Date(date) : undefined,
                    src: 'retrovirtualmachine.org',
                }];
            }
        }
    } catch (error) {
        console.error(`[RVM]`, error);
    }
    return [];
}

export async function callAS() {
    // note we can use a URL like
    // https://androidstudio.googleblog.com/search?updated-max=2022-12-26T10:01:00-08:00&max-results=25
    // we can use just the `max-results` param - it actually only goes up to 24 though
    const asEarl = new Earl('https://androidstudio.googleblog.com', '/search', {
        'max-results': 24,
    });

    try {
        const blog1 = domStroll('AS2a', false, await asEarl.fetchDom(), [
           [2, 'html', { cls: 'v2' }],
           [3, 'body'],
           [15, 'div', { cls: 'cols-wrapper' }],
           [1, 'div', { cls: 'col-main-wrapper' }],
           [3, 'div', { cls: 'col-main' }],
           [3, 'div', { id: 'main' }],
           [0, 'div', { id: 'Blog1' }],
        ])!;

        const posts = blog1.children!.filter(e => e.type === 'tag' && e.name === 'div' && e.attribs?.class?.includes('post'));

        const chosenPostPerChannel = new Map();

        for (const post of posts) {
            const linkAnchor = domStroll('AS2b', false, post.children!, [
                [1, 'h2', { cls: 'title' }],
                [1, 'a'],
            ])!;

            const link = linkAnchor.attribs!.href;

            const publishDate = domStroll('AS2c', false, post.children!, [
                [3, 'div', { cls: 'post-header' }],
                [1, 'div', { cls: 'published' }],
                [1, 'span', { cls: 'publishdate' }],
            ])!;

            const dmat = publishDate.children![0].data!.trim().match(/(\w+), (\w+) (\d+), (\d+)/);

            const timestamp = dmat ? new Date(`${dmat[2]} ${dmat[3]}, ${dmat[4]}`) : null;

            const postContent = domStroll('AS2d', false, post.children!, [
                [5, 'div', { cls: 'post-body' }],
                [1, 'div', { cls: 'post-content' }],
            ])!;

            const script = postContent.children![1];

            if (script && script.children![0]) {
                const scriptDom = parse(script.children![0].data!) as DomNode[];

                const para = domStroll('AS2e', false, scriptDom, [
                    [1, 'p'],
                ])!;

                const releaseString = para.children![0].data!.trim();

                const mack = releaseString.match(/^Android Studio (\w+) \| (\d\d\d\d\.\d\.\d) (?:(\w+) (\d+) )?is now available in the (\w+) channel\.$/);
                if (mack) {
                    const channel = mack[5];

                    if (!chosenPostPerChannel.has(channel)) {
                        chosenPostPerChannel.set(channel, {
                            name: `Android Studio ${mack[1]}`,
                            ver: mack.slice(2, 5).filter(Boolean).join(' '),
                            link,
                            timestamp,
                            src: 'androidstudio.googleblog.com',
                        });
                    }
                } else {
                    console.log(`[AS] couldn't parse title/codename/version/channel from '${releaseString}'`);
                }
            }
        }

        return Array.from(chosenPostPerChannel.entries()).filter(e => [
            // 'Canary',    // Canary builds are the bleeding edge, released about weekly. While these builds do get tested, they are still subject to bugs, as we want people to see what's new as soon as possible. This is not recommended for production development.
            // 'Dev',       // Dev builds are hand-picked older canary builds that survived the test of time. It should be updated roughly bi-weekly or monthly.
            // 'Beta',      // When we reach a beta milestone for the next version of Android Studio, we post the beta builds here. When the version is stable, the beta channel contains the stable version until the next version's beta.
            'Stable',       // Contains the most recent stable version of Android Studio.
        ].includes(e[0])).map(e => e[1]);

    } catch (error) {
        console.error(`[AS]`, error);
    }
    return [];
}

export async function callElixir() {
    const elixirEarl = new Earl('https://elixir-lang.org', '/blog/categories.html');
    try {
        const releasesLI = domStroll('Elixir', false, await elixirEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body', { cls: 'blog' }],
            [1, 'div', { id: 'container' }],
            [1, 'div', { cls: 'wrap' }],
            [3, 'div', { id: 'main' }],
            [1, 'div', { id: 'content' }],
            [1, 'div', { cls: 'hcat' }],
            [3, 'ul'],
            [7, 'li'],
        ])!;

        domStroll('Elixir2', false, releasesLI.children!, [
            [1, 'h5', { id: 'Releases' }],
        ]);

        const releasesUL = domStroll('Elixir3', false, releasesLI.children!, [
            [3, 'ul']
        ])!;

        const releaseLIs = releasesUL.children!.filter(e => e.type === 'tag' && e.name === 'li');

        for (const rli of releaseLIs) {
            const a = domStroll('Elixir4', false, rli.children!, [
                [0, 'a']
            ])!;

            const byline = domStroll('Elixir5', false, rli.children!, [
                [2, 'span', { cls: 'byline' }],
            ])!;

            // raw version text is like: `Elixir v1.13 released`
            // but also possible: `Elixir v0.13.0 released, hex.pm and ElixirConf announced`
            const version = a.children![0].data!.match(/^Elixir (v\d+\.\d+) released\b/)![1];

            return [{
                name: 'Elixir',
                ver: version,
                link: `${elixirEarl.getOrigin()}${a.attribs!.href}`,
                timestamp: new Date(byline.children![0].data!),
                src: 'elixir-lang.org',
            }];
        }

    } catch (error) {
        console.error(`[Elixir]`, error);
    }
    return [];
}

export async function callExifTool() {
    const exifEarl = new Earl('https://exiftool.org', '/history.html');
    try {
        const body = domStroll('Exif1', false, await exifEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
        ])!

        let latestDevRelease = null;
        let latestProdRelease = null;

        const anchors = body.children!.filter(e => e.type === 'tag' && e.name === 'a' && 'name' in e.attribs!);
        for (const a of anchors) {
            const dateAndVer = a.children![0].children![0].data!.split(' - ');
            const timestamp = new Date(dateAndVer[0]);
            const ver = dateAndVer[1].slice(7);

            let isProdRelease = false;

            if (a.next && a.next.type === 'text') {
                if (a.next.next && a.next.next.type === 'tag' && a.next.next.name === 'span') {
                    if (a.next.next.attribs?.class === 'grn' && a.next.next.children![0].data === '(production release)') {
                        isProdRelease = true;
                    }
                }
            }
            
            if (isProdRelease) {
                if (latestProdRelease === null) {
                    latestProdRelease = {
                        name: 'ExifTool (production)',
                        ver,
                        link: `${exifEarl.getUrlString()}`,
                        timestamp,
                        src: 'exiftool.org',
                    };
                }
            } else {
                if (latestDevRelease === null) {
                    latestDevRelease = {
                        name: 'ExifTool (development)',
                        ver,
                        link: `${exifEarl.getUrlString()}`,
                        timestamp,
                        src: 'exiftool.org',
                    };
                }
            }
            if (latestProdRelease !== null && latestDevRelease !== null) break;
        }

        const results = [];
        if (latestProdRelease !== null) results.push(latestProdRelease);
        if (latestDevRelease !== null) results.push(latestDevRelease);
        return results;
    } catch (error) {
        console.error(`[Exif]`, error);
    }
    return [];
}

export async function callRuby() {
    const rubyEarl = new Earl('https://www.ruby-lang.org', '/en/downloads/releases/');
    try {
        const relList = domStroll('Ruby', false, await rubyEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [3, 'div', { id: 'page' }],
            [1, 'div', { id: 'main-wrapper' }],
            [1, 'div', { id: 'main' }],
            [1, 'div', { id: 'content-wrapper' }],
            [3, 'div', { id: 'content' }],
            [9, 'table', { cls: 'release-list' }],
        ])!;

        type Release = [number, number, string, string, string];

        const releases: Release[] = [];

        relList.children!.forEach(ch => {
            if (ch.type === 'tag' && ch.name === 'tr' && ch.children!.filter((_c, i) => i % 2).every(c => c.type === 'tag' && c.name === 'td')) {
                const [v, d, , l] = ch.children!.filter((_c, i) => i % 2);

                const rawVer = v.children![0].data!;
                const rawDate = d.children![0].data!;
                const relativeLink = l.children![0].attribs!.href!;

                // ignore release candidates and previews
                const ver = rawVer.includes('-') ? null : rawVer.replace(/^Ruby /, '');

                if (ver) {
                    const [maj, min] = ver.split('.').map(v => Number(v));

                    releases.push([maj, min, ver, rawDate, relativeLink]);
                }
            }
        })

        const currMaj = Math.max(...releases.map(r => r[0]));

        // let's just get the two latest minor versions
        const minsForMaj: number[] = [...new Set(releases.filter(r => r[0] === currMaj).map(r => r[1]))]
            .sort((a, b) => b - a)
            .slice(0, 2);

        const latestOfEach = minsForMaj
            .map(min => releases.find(r => r[0] === currMaj && r[1] === min)) as Release[];

        return latestOfEach.map(([maj, min, ver, date, relLink]) => {
            const url = new URL(rubyEarl.url.href);
            url.pathname = relLink;

            return {
                name: `Ruby ${maj}.${min}`,
                ver,
                link: url.href,
                timestamp: new Date(date),
                src: 'ruby-lang.org',
            }
        });

    } catch (error) {
        console.error(`[Ruby]`, error);
    }
    return [];
}

// generalized function to work with both IntelliJ IDEA and RustRover
async function callIntelliJ(debugName: string, linkName: string, regex: RegExp, returnName: string) {
    const ijEarl = new Earl('https://blog.jetbrains.com', `${linkName}/category/releases/`);

    try {
        const container = domStroll(`${debugName}a`, false, await ijEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [6, 'div', { id: 'wrapper' }],
            [3, 'main', { id: 'main' }],
            [3, 'section', { cls: 'tax-archive' }],
            [1, 'div', { cls: 'container' }],
            [3, 'div', { cls: 'tax-archive__wrapper' }],    // added < 2024-03-09
        ])!;

        // ignore all the text and comment child nodes, find the first div node with row class
        const row = container.children!.find(e => e.type === 'tag' && e.name === 'div' && e.attribs?.class?.includes('row'))!;

        const cols = row.children!.filter(e => e.type === 'tag' && e.name === 'div' && e.attribs?.class?.includes('col'));

        for (const col of cols) {
            const aLink = domStroll(`${debugName}b`, false, col.children!, [
                [1, 'a', { cls: 'card' }],
            ])!;

            const headerIndex = aLink.children!.findIndex(e => e.type === 'tag' && e.name === 'div' && e.attribs?.class?.includes('card__header'));

            if (headerIndex) {
                const header = aLink.children![headerIndex];
                const footer = aLink.children![headerIndex + 4];
                // card header and footer are normally children #3 and #7
                // but sometimes an image is missing so the header and footer are #1 and #5

                // if header and footer were wrong (1 and 5 instead of 3 and 7) then h4 will be at 3 instead of 1
                const h4index = 4 - headerIndex;

                const h4 = domStroll(`${debugName}c`, false, header.children!, [
                    [h4index, 'h4'],
                ])!;

                const publishDate = domStroll(`${debugName}d`, false, footer.children!, [
                    [1, 'div', { cls: 'author' }],
                    [3, 'div', { cls: 'author__info' }],
                    [3, 'time', { cls: 'publish-date' }],
                ])!;

                const title = h4.children![0].data!;
                const matt = title.match(regex);
                if (matt) {
                    const pubDateAttribs = publishDate.attribs as { datetime?: string };

                    return [{
                        name: returnName,
                        ver: matt[1],
                        link: aLink.attribs!.href,
                        timestamp: new Date(pubDateAttribs.datetime!),
                        src: 'jetbrains.com',
                    }];
                } else {
                    const colAttribs = col.attribs as { post_id?: string };
                    console.log(`[${debugName}] ${colAttribs.post_id!} :couldn't parse version from '${title}'`);
                }
            }
        }

    } catch (error) {
        console.error(`[${debugName}]`, error);
    }

    return [];
}

export async function callIdea() {
    return await callIntelliJ('Idea', 'idea', /IntelliJ IDEA (\d+\.\d+(?:\.\d+)?)/, 'IntelliJ IDEA');
}

export async function callRustRover() {
    return await callIntelliJ('RR', 'rust', /IntelliJ Rust for (\d+\.\d+(?:\.\d+)?)/, 'RustRover');
}

export async function callSdlMame() {
    const sdlMameEarl = new Earl('https://sdlmame.lngn.net', '/stable/');

    try {
        const table = domStroll('sdl', false, await sdlMameEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [3, 'table'],
        ])!;

        // odd numbered children are whitespace text nodes
        // last child (-2) is just an <hr>
        // we want the last one that matches (formerly hardcoded to -6)
        for (let i = 0; i < table.children!.length - 2; i += 2) {
            const tr = table.children![table.children!.length - 2 - i];

            // <hr> entry has only 1 child node
            if (tr.children!.length === 1) continue;

            // for now, file entries have 5 child nodes
            const [linkAnchor, dateTimeTD] = [
                domStroll('sdl', false, tr.children!, [
                    [1, 'td'],
                    [0, 'a'],
                ])!,
                domStroll('sdl', false, tr.children!, [
                    [2, 'td'],
                ])!,
            ];

            const matty = linkAnchor.attribs!.href!.match(/^mame(\d)(\d+)-arm64.zip$/);
            if (matty) {
                const [maj, min] = [matty[1], matty[2]];

                return [{
                    name: 'SDL MAME',
                    ver: `${maj}.${min}`,
                    link: `https://sdlmame.lngn.net/whatsnew/whatsnew_${maj}${min}.txt`,
                    timestamp: new Date(dateTimeTD.children![0].data!.trim()),
                    src: 'sdlmame.lngn.net',
                }];
            }
        }
    } catch (error) {
        console.error(`[SdlMame]`, error);
    }

    return [];
}

export async function callSublime() {
    // https://www.sublimetext.com/download
    const sublimeEarl = new Earl('https://www.sublimetext.com', '/download');

    try {
        const current = domStroll('sublime', false, await sublimeEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [3, 'main'],
            [1, 'section'],
            [3, 'div', { cls: 'primary' }],
            [3, 'section', { id: 'changelog' }],
            [3, 'article', { cls: 'current' }],
        ])!;

        const [h3, releaseDate] = [
            domStroll('sublime2', false, current.children!, [
                [1, 'h3'],
            ])!,
            domStroll('sublime3', false, current.children!, [
                [3, 'div', { cls: 'release-date' }],
            ])!
        ];

        const ver = h3.children![0].data!.match(/Build (\d+)/);
        const date = releaseDate.children![0].data!.trim();

        if (ver && date) {
            return [{
                name: 'Sublime Text',
                ver: ver[1],
                link: 'https://www.sublimetext.com/download',
                timestamp: new Date(date),
                src: 'sublimetext.com',
            }];
        }
    } catch (error) {
        console.error(`[Sublime]`, error);
    }

    return [];
}

export async function callPython() {
    // https://www.python.org/
    const pyEarl = new Earl('https://www.python.org');
    try {
        const section = domStroll('python', false, await pyEarl.fetchDom(), [
            [9, 'html', { cls: 'no-js' }],
            [5, 'body', { id: 'homepage' }],
            [1, 'div', { id: 'touchnav-wrapper' }],
            [13, 'div', { id: 'content' }],
            [3, 'div', { cls: 'container' }],
            [1, 'section', { cls: 'main-content' }],
        ])!;

        // Check for both the old and new structure of the div containing the row
        // 'row' was section.div(1) but changes to sectionary.div(3) if there's a 'notification-bar'
        const rowDiv = section.children!.find(child => child.attribs?.class?.includes('row'))!;

        const latestA = domStroll('python', false, rowDiv.children!, [
            [3, 'div', { cls: 'download-widget' }], // also .small-widget
            [5, 'p'],
            [1, 'a'],
        ])!;

        const [aVerText, aHref] = [latestA.children![0].data!.trim(), latestA.attribs!.href!.trim()];

        pyEarl.setPathname(aHref);
        const releaseDateP = domStroll('python', false, await pyEarl.fetchDom(), [
            [9, 'html', { cls: 'no-js' }],
            [5, 'body'],
            [1, 'div', { id: 'touchnav-wrapper' }],
            [13, 'div', { id: 'content' }],
            [3, 'div', { cls: 'container' }],
            [1, 'section', { cls: 'main-content' }],
			[3, 'article', { cls: 'text' }],
			[3, 'p'],
        ])!;

        return [{
            name: 'Python',
            ver: aVerText,
            link: pyEarl.getUrlString(),
            timestamp: new Date(releaseDateP.children![1].data!.trim()),
            src: 'python.org',
        }];
    } catch (error) {
        console.error(`[Python]`, error);
    }
    return [];
}


export async function callD() {
    // https://dlang.org/changelog/
    const dEarl = new Earl('https://dlang.org', '/changelog/');
    try {
        const secondLi = domStroll('d', false, await dEarl.fetchDom(), [
            [3, 'html'],
            [5, 'body'],
            [5, 'div', { cls: 'container' }],
            [5, 'div', { id: 'content' }],
            [7, 'ul'],
            [7, 'li']
        ])!;

        const [a, span] = [
            domStroll('d', false, secondLi.children!, [
                [0, 'a'],
            ])!,
            domStroll('d', false, secondLi.children!, [
                [1, 'span']
            ])!
        ];

        const [ver, relLink] = [
            a.attribs!.id,
            a.attribs!.href!
        ];

        let date = span.children![0].data!;

        const timestamp = (date.startsWith(' (') && date[date.length - 1] === ')')
            ? new Date(date.substring(2, date.length - 1))
            : null;

        return [{
            name: 'D',
            ver,
            link: new URL(relLink, dEarl.getUrlString()).href,
            timestamp,
            src: 'dlang.org',
        }];
    } catch (error) {
        console.error(`[D]`, error);
    }
    return [];
}

// TODO only has version number, not date
export async function callC3() {
    // https://c3-lang.org/
    const c3Earl = new Earl('https://c3-lang.org');
    try {
        // not <html> tag, divs don't have useful ids or classes, mostly style rather than semantic
        const versionSpan = domStroll('c3', false, await c3Earl.fetchDom(), [
            [3, 'body'],
            [1, 'div'],
            [5, 'div'],
            [1, 'div'],
            [7, 'div'],
            [3, 'span']
        ])!;
        const version = versionSpan.children![0].data!.trim();

        return [{
            name: 'C3',
            ver: version,
            link: c3Earl.getUrlString(),
            timestamp: null,
            src: 'c3-lang.org',
        }];
    } catch (error) {
        console.error(`[C3]`, error);
    }
    return [];
}

export async function callEclipse() {
    const eclipseEarl = new Earl('https://download.eclipse.org', '/eclipse/downloads/');
    try {
        const tr = domStroll('eclipse', false, await eclipseEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body', { id: 'body_solstice' } ],
            [5, 'main' ],
            [1, 'div', { id: 'novaContent' }, ],
            [15, 'table', { cls: 'downloads'} ],
            [3, 'tr' ],
        ])!;
        const verAnchor = domStroll('eclipse', false, tr.children!, [
            [1, 'td', { cls: 'name' } ],
            [1, 'a' ],
        ])!;
        const dateTd = domStroll('eclipse', false, tr.children!, [
            [5, 'td', { cls: 'date' } ],
        ])!;
        const rawDateStr = dateTd.children![0].data!.trim();
        const [datePart, timePart] = rawDateStr.split(' -- ');
        const [timeStr, tzStr] = timePart.split(' ');
        const tz = tzStr.substring(1, tzStr.length - 1);
            
        return [{
            name: 'Eclipse',
            ver: verAnchor.children![0].data!.trim(),
            link: new URL(verAnchor.attribs!.href!, eclipseEarl.getUrlString()).href,
            timestamp: new Date(`${datePart} ${timeStr} ${tz}`),            
            src: 'eclipse.org',
        }]
    } catch (error) {
        console.error(`[Eclipse]`, error);
    }
    return [];
}