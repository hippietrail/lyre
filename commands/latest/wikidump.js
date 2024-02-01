import { Earl } from '../../ute/earl.js';
import { domStroll } from '../../ute/dom.js';
import parse from 'html-dom-parser';

const wikidumpEarl = new Earl('https://dumps.wikimedia.org');

export async function callWikiDump() {
    wikidumpEarl.setPathname('/backup-index.html');

    try {
        const ul = domStroll('Wikidump.1', false, await wikidumpEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [1, 'div', { cls: 'lang-list-button-wrapper' }],
            [25, 'ul'],
        ]);

        const chosen = [];

        for (const [i, li] of ul.children.entries()) {
            if (i % 2 === 0) continue;
            // a ul instead of a li is a continuation of the previous li
            if (li.name === 'ul') continue;

            const info = getWikiDumpInfo(li);

            // NOTE `info.l` contains a relative link that if followed
            // NOTE will redirect to add a slash to the end

            if (info && [
                'enwiktionary',
                // 'enwiki',
                // 'thwiktionary',
                // 'wikidatawiki',
            ].includes(info.w)) {
                // do different things depending on the status
                let sdp = null;
                switch (info.s) {
                    case 'Dump in progress':
                        // status class is 'in-progress'
                        console.log(`[WikiDump] ${info.c} ${info.w}`);
                        sdp = await scrapeThisDumpsPage(info);
                        break;

                    case 'Partial dump':
                        // status class is 'partial-dump'
                        console.log(`[WikiDump] ${info.c} ${info.w}`);
                        sdp = await scrapeThisDumpsPage(info);
                        break;

                    case 'Dump complete':
                        // status class is 'done'
                        console.log(`[WikiDump] ${info.c} ${info.w}`);
                        sdp = await scrapeThisDumpsPage(info);
                        break;

                    default:
                        // unexpected status
                        // other known statuses classes are 'waiting' and 'skipped'
                        console.log(`[WikiDump] ${info.c} (${info.s}) ${info.w}`);
                }

                // for the version we use the date in the form `yyyymmdd`
                const url = new URL(wikidumpEarl.getOrigin());
                url.pathname = info.l;

                const ver = info.d.substring(0, 10).replace(/-/g, '');
                const link = url.href;
                const src = 'dumps.wikimedia.org';

                let added = 0;

                if (sdp) {
                    // if we have both pages-articles *and* pages-articles-multistream then just add once,
                    // noting that we have both, and using the more recent timestamp

                    if ('articlesdump' in sdp && sdp.articlesdump !== '' && 'articlesmultistreamdump' in sdp && sdp.articlesmultistreamdump !== '') {
                        const adTime = new Date(sdp.articlesdump);
                        const admTime = new Date(sdp.articlesmultistreamdump);
                        const timestamp = adTime > admTime ? adTime : admTime;
                        chosen.push({
                            name: `${info.w} pages-articles and pages-articles-multistream`,
                            ver,
                            link,
                            timestamp,
                            src,
                        });
                        added++;
                    } else if ('articlesdump' in sdp && sdp.articlesdump !== '') {
                        chosen.push({
                            name: `${info.w} pages-articles`,
                            ver,
                            link,
                            timestamp: new Date(sdp.articlesdump),
                            src,
                        });
                        added++;
                    } else if ('articlesmultistreamdump' in sdp && sdp.articlesmultistreamdump !== '') {
                        chosen.push({
                            name: `${info.w} pages-articles-multistream`,
                            ver,
                            link,
                            timestamp: new Date(sdp.articlesmultistreamdump),
                            src,
                        });
                        added++;
                    }
                }
                
                if (!added) {
                    chosen.push({
                        name: `${info.w} (${info.c})`,
                        ver,
                        link,
                        timestamp: new Date(info.d),
                        src,
                    });
                }
            }
        }

        return chosen;

    } catch (error) {
        console.error(`[WikiDump]`, error);
    }

    return [];
}

async function scrapeThisDumpsPage(info) {
    try {
        wikidumpEarl.setPathname(info.l);
        console.log(`[WikiDump/dump] ${wikidumpEarl.getUrlString()}`);

        // NOTE the url we got from the page has the form `wikidatawiki/20240120`
        // NOTE but it redirects to add a slash: `wikidatawiki/20240120/`

        const body = domStroll('Wikidump.2', false, await wikidumpEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
        ])

        const jsonA = domStroll('Wikidump.3', false, body.children, [
            [15, 'p'],
            [1, 'a'],
        ]);

        // TODO this link is relative to the *redirected* URL
        return await getThisDumpsJson(info.w, jsonA.attribs.href);
    } catch (error) {
        console.error(`[WikiDump]`, error);
    }
    return null;
}

// NOTE this link will be provided in the page before the JSON is published
// NOTE in the meantime it will return a tiny HTML '404 Not Found' page
async function getThisDumpsJson(wiki, jsonRelLink) {
    wikidumpEarl.setBasicPathname(`${wikidumpEarl.url.pathname}/`);
    wikidumpEarl.setLastPathSegment(`${jsonRelLink}`);

    let text
    try {
        //const jobs = (await wikidumpEarl.fetchJson()).jobs;
        text = await wikidumpEarl.fetchText();
        const jobs = JSON.parse(text);
        console.log(`wikidump ${wiki} JSON has been published`);

        const stuffs = {};

        [
            'articlesmultistreamdumprecombine',
            'articlesmultistreamdump',
            'articlesdumprecombine',
            'articlesdump'
        ].filter(key => key in jobs).forEach(key => stuffs[key] = jobs[key].updated);

        return stuffs;
    } catch (error) {
        const dom = parse(text);
        const [h1, center] = [
            domStroll('Wikidump.4', false, dom, [
                [0, 'html'],
                [3, 'body'],
                [1, 'center'],
                [0, 'h1'],
            ]),
            domStroll('Wikidump.5', false, dom, [
                [0, 'html'],
                [3, 'body'],
                [4, 'center'],
            ]),
        ];

        if (h1.children[0].data === '404 Not Found' && center.children[0].data === 'nginx/1.18.0') {
            console.log(`wikidump ${wiki} JSON not yet published - 404 Not Found html in expected place`);
        } else {
            console.error(`[WikiDump/json] ${wiki}`, error);
        }
    }
    return null;
}

// NOTE `l` will contain a relative link that looks like a file, no trailing slash
// NOTE but that link will redirect to one like a dir, with a trailing slash
function getWikiDumpInfo(li) {
    const kids = li.children;
    if (kids.length === 4) {
        return {
            w: kids[1].children[0].data,
            d: kids[0].data,
            c: kids[3].attribs.class,
            s: kids[3].children[0].data,
            l: kids[1].attribs.href,
        };
    } else {
        const dateAndName = kids[0].data;
        if (dateAndName) {
            const matt = dateAndName.match(/^(\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d) (.*) \(private data\): $/);
            return {
                w: matt[2],
                d: matt[1],
                c: kids[1].attribs.class,
                s: kids[1].children[0].data,
                l: null,
            }
        } else {
            console.log(`[WikiDump] couldn't parse info from '${kids[0].data}'`);
        }
    }
    return null;
}
