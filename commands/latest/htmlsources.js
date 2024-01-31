import { Earl } from '../../ute/earl.js';
import { domStroll } from '../../ute/dom.js';
import parse from 'html-dom-parser';

export async function callGo() {
    const verCmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    const goEarl = new Earl('https://go.dev', '/doc/devel/release');
    try {
        const article = domStroll('Go', false, await goEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body', { cls: 'Site' }],
            [9, 'main', { id: 'main-content' }],
            [1, 'article', { cls: 'Doc' }],
        ]);

        const paras = article.children.filter(e => e.type === 'tag' && e.name === 'p');

        let biggestVer = null;
        let dateOfBiggestVer = null;

        for (const para of paras) {
            const mat = para.children[0].data.trim().match(/^go(\d+(?:\.\d+)*)\s+\(released (\d+-\d+-\d+)\)/m);
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
                timestamp: new Date(dateOfBiggestVer),
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
        ]);

        const h2s = article.children.filter(e => e.type === 'tag' && e.name === 'h2');

        for (const h2 of h2s) {
            const mat = h2.children[0]?.data?.trim().match(/^RetroVM v(\d+(?:\.\d+)*)\s+\((\d+\/\d+\/\d+)\)/m);
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
        ]);

        const posts = blog1.children.filter(e => e.type === 'tag' && e.name === 'div' && e.attribs?.class?.includes('post'));

        const chosenPostPerChannel = new Map();

        for (const post of posts) {
            const linkAnchor = domStroll('AS2b', false, post.children, [
                [1, 'h2', { cls: 'title' }],
                [1, 'a'],
            ]);

            const link = linkAnchor.attribs.href;

            const publishDate = domStroll('AS2c', false, post.children, [
                [3, 'div', { cls: 'post-header' }],
                [1, 'div', { cls: 'published' }],
                [1, 'span', { cls: 'publishdate' }],
            ]);

            const dmat = publishDate.children[0].data.trim().match(/(\w+), (\w+) (\d+), (\d+)/);

            const timestamp = dmat ? new Date(`${dmat[2]} ${dmat[3]}, ${dmat[4]}`) : null;

            const postContent = domStroll('AS2d', false, post.children, [
                [5, 'div', { cls: 'post-body' }],
                [1, 'div', { cls: 'post-content' }],
            ]);

            const script = postContent.children[1];

            if (script && script.children[0]) {
                const scriptDom = parse(script.children[0].data);

                const para = domStroll('AS2e', false, scriptDom, [
                    [1, 'p'],
                ]);

                const releaseString = para.children[0].data.trim();

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
                    console.log(`[AS] couldn't parse title/codename/version/channel from '${codenameVerChan}'`);
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
        ]);

        domStroll('Elixir2', false, releasesLI.children, [
            [1, 'h5', { id: 'Releases' }],
        ]);

        const releasesUL = domStroll('Elixir3', false, releasesLI.children, [
            [3, 'ul']
        ]);

        const releaseLIs = releasesUL.children.filter(e => e.type === 'tag' && e.name === 'li');

        for (const rli of releaseLIs) {
            const a = domStroll('Elixir4', false, rli.children, [
                [0, 'a']
            ]);

            const byline = domStroll('Elixir5', false, rli.children, [
                [2, 'span', { cls: 'byline' }],
            ]);

            // raw version text is like: `Elixir v1.13 released`
            // but also possible: `Elixir v0.13.0 released, hex.pm and ElixirConf announced`
            const version = a.children[0].data.match(/^Elixir (v\d+\.\d+) released\b/)[1];

            return [{
                name: 'Elixir',
                ver: version,
                link: `${elixirEarl.getOrigin()}${a.attribs.href}`,
                timestamp: new Date(byline.children[0].data),
                src: 'elixir-lang.org',
            }];
        }

    } catch (error) {
        console.error(`[Elixir]`, error);
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
        ]);

        const releases = [];

        relList.children.forEach(ch => {
            if (ch.type === 'tag' && ch.name === 'tr' && ch.children.filter((_c, i) => i % 2).every(c => c.type === 'tag' && c.name === 'td')) {
                const [v, d, , l] = ch.children.filter((_c, i) => i % 2);

                const rawVer = v.children[0].data;
                const rawDate = d.children[0].data;
                const relativeLink = l.children[0].attribs.href;

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
        const minsForMaj = [...new Set(releases.filter(r => r[0] === currMaj).map(r => r[1]))]
            .sort((a, b) => b - a)
            .slice(0, 2);

        const latestOfEach = minsForMaj
            .map(min => releases.find(r => r[0] === currMaj && r[1] === min));

        return latestOfEach.map(([maj, min, ver, date, relLink]) => {
            const url = new URL(rubyEarl.url);
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

export async function callIdea() {
    const ideaEarl = new Earl('https://blog.jetbrains.com', '/idea/category/releases/');

    try {
        const row = domStroll('IdeaA', false, await ideaEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [6, 'div', { id: 'wrapper' }],
            [3, 'main', { id: 'main' }],
            [3, 'section', { cls: 'tax-archive' }],
            [1, 'div', { cls: 'container' }],
            [3, 'div', { cls: 'row' }],
        ]);

        const cols = row.children.filter(e => e.type === 'tag' && e.name === 'div' && e.attribs?.class?.includes('col'));

        for (const col of cols) {
            const aLink = domStroll('IdeaB', false, col.children, [
                [1, 'a', { cls: 'card' }],
            ]);

            const headerIndex = aLink.children.findIndex(e => e.type === 'tag' && e.name === 'div' && e.attribs?.class?.includes('card__header'));

            if (headerIndex) {
                const header = aLink.children[headerIndex];
                const footer = aLink.children[headerIndex + 4];
                // card header and footer are normally children #3 and #7
                // but sometimes an image is missing so the header and footer are #1 and #5

                // if header and footer were wrong (1 and 5 instead of 3 and 7) then h4 will be at 3 instead of 1
                const h4index = 4 - headerIndex;

                const h4 = domStroll('IdeaC', false, header.children, [
                    [h4index, 'h4'],
                ]);

                const publishDate = domStroll('IdeaD', false, footer.children, [
                    [1, 'div', { cls: 'author' }],
                    [3, 'div', { cls: 'author__info' }],
                    [3, 'time', { cls: 'publish-date' }],
                ]);

                // title will be this form: IntelliJ IDEA 2023.1.4 Is Here!
                const matt = h4.children[0].data.match(/IntelliJ IDEA (\d+\.\d+(?:\.\d+)?) Is (?:Here|Out)!/);
                if (matt) {
                    return [{
                        name: 'IntelliJ IDEA',
                        ver: matt[1],
                        link: aLink.attribs.href,
                        timestamp: new Date(publishDate.attribs.datetime),
                        src: 'jetbrains.com',
                    }];
                } else {
                    console.log(`[Idea] ${col.attribs.post_id} :couldn't parse version from '${title}'`);
                }
            }
        }

    } catch (error) {
        console.error(`[Idea]`, error);
    }

    return [];
}

export async function callSdlMame() {
    const sdlMameEarl = new Earl('https://sdlmame.lngn.net', '/stable/');

    try {
        const table = domStroll('sdl', false, await sdlMameEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [3, 'table'],
        ]);

        const tr = table.children[table.children.length - 6];

        const [linkAnchor, dateTimeTD] = [
            domStroll('sdl', false, tr.children, [
                [1, 'td'],
                [0, 'a'],
            ]),
            domStroll('sdl', false, tr.children, [
                [2, 'td'],
            ]),
        ];

        const matty = linkAnchor.attribs.href.match(/^mame(\d)(\d+)-arm64.zip$/);
        if (matty) {
            const [maj, min] = [matty[1], matty[2]];

            return [{
                name: 'SDL MAME',
                ver: `${maj}.${min}`,
                link: `https://sdlmame.lngn.net/whatsnew/whatsnew_${maj}${min}.txt`,
                timestamp: new Date(dateTimeTD.children[0].data.trim()),
                src: 'sdlmame.lngn.net',
            }];
        }
    } catch (error) {
        console.error(`[SdlMame]`, error);
    }

    return [];
}