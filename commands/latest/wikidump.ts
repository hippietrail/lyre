import { Earl } from '../../ute/earl.js';
import { domStroll, DomNode } from '../../ute/dom.js';
import parse from 'html-dom-parser';

const wikidumpEarl = new Earl('https://dumps.wikimedia.org');

interface Info {
    wiki: string;
    date: string;
    stat: string;
    link?: string;
};

// stores four datestrings from the JSON, 2 we use, 2 are optional but may provide useful information at some point
// articlesdump                     pages-articles
// articlesmultistreamdump          pages-articles-multistream
// articlesdumprecombine            not yet used
// articlesmultistreamdumprecombine not yet used
interface DumpPageInfo {
    [key: string]: string | undefined;
}

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

        for (const [i, li] of ul!.children!.entries()) {
            if (i % 2 === 0) continue;
            // a ul instead of a li is a continuation of the previous li
            if (li.name === 'ul') continue;

            const info = getWikiDumpInfo(li!);

            // NOTE `info.l` contains a relative link that if followed
            // NOTE will redirect to add a slash to the end

            if (info && [
                'enwiktionary',
                // 'enwiki',
                // 'thwiktionary',
                // 'wikidatawiki',
            ].includes(info.wiki)) {
                // do different things depending on the status
                let dumpPageInfo: DumpPageInfo | null = null;
                switch (info.stat) {
                    case 'in-progress':
                    case 'partial-dump':
                    case 'done':
                        console.log(`[WikiDump] ${info.stat} ${info.wiki}`);
                        dumpPageInfo = await scrapeThisDumpsPage(info);
                        break;

                    default:
                        // unexpected status
                        // other known statuses classes are 'waiting' and 'skipped'
                        console.log(`[WikiDump] ${info.stat} ${info.wiki}`);
                }

                // for the version we use the date in the form `yyyymmdd`
                const url = new URL(wikidumpEarl.getOrigin());
                if (info.link) url.pathname = info.link;

                const ver = info.date.substring(0, 10).replace(/-/g, '');
                const link = url.href;
                const src = 'dumps.wikimedia.org';

                let added = 0;

                if (dumpPageInfo) {
                    // if we have both pages-articles *and* pages-articles-multistream then just add once,
                    // noting that we have both, and using the more recent timestamp

                    if ('articlesdump' in dumpPageInfo && dumpPageInfo.articlesdump !== '' && 'articlesmultistreamdump' in dumpPageInfo && dumpPageInfo.articlesmultistreamdump !== '') {
                        const adTime = new Date(dumpPageInfo.articlesdump!);
                        const admTime = new Date(dumpPageInfo.articlesmultistreamdump!);
                        const timestamp = adTime > admTime ? adTime : admTime;
                        chosen.push({
                            name: `${info.wiki} pages-articles and pages-articles-multistream`,
                            ver,
                            link,
                            timestamp,
                            src,
                        });
                        added++;
                    } else if ('articlesdump' in dumpPageInfo && dumpPageInfo.articlesdump !== '') {
                        chosen.push({
                            name: `${info.wiki} pages-articles`,
                            ver,
                            link,
                            timestamp: new Date(dumpPageInfo.articlesdump!),
                            src,
                        });
                        added++;
                    } else if ('articlesmultistreamdump' in dumpPageInfo && dumpPageInfo.articlesmultistreamdump !== '') {
                        chosen.push({
                            name: `${info.wiki} pages-articles-multistream`,
                            ver,
                            link,
                            timestamp: new Date(dumpPageInfo.articlesmultistreamdump!),
                            src,
                        });
                        added++;
                    }
                }
                
                if (!added) {
                    console.log(`[WikiDump] no 'articlesdump' or 'articlesmultistreamdump' in ${info.wiki}`);
                    chosen.push({
                        name: `${info.wiki} (${info.stat})`,
                        ver,
                        link,
                        timestamp: new Date(info.date),
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

async function scrapeThisDumpsPage(info: Info): Promise<DumpPageInfo | null> {
    try {
        wikidumpEarl.setPathname(info.link!);
        console.log(`[WikiDump/dump] ${wikidumpEarl.getUrlString()}`);

        // NOTE the url we got from the page has the form `wikidatawiki/20240120`
        // NOTE but it redirects to add a slash: `wikidatawiki/20240120/`

        const body = domStroll('Wikidump.2', false, await wikidumpEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
        ])!;

        const jsonA = domStroll('Wikidump.3', false, body.children!, [
            [15, 'p'],
            [1, 'a'],
        ])!;

        // TODO this link is relative to the *redirected* URL
        return await getThisDumpsJson(info.wiki, jsonA.attribs!.href!);
    } catch (error) {
        console.error(`[WikiDump]`, error);
    }
    return null;
}

interface Job {
    updated: string;
}

// NOTE this link will be provided in the page before the JSON is published
// NOTE in the meantime it will return a tiny HTML '404 Not Found' page
async function getThisDumpsJson(wiki: string, jsonRelLink: string): Promise<DumpPageInfo | null> {
    wikidumpEarl.setBasicPathname(`${wikidumpEarl.getPathname()}/`);
    wikidumpEarl.setLastPathSegment(`${jsonRelLink}`);

    let text: string = '';
    try {
        text = await wikidumpEarl.fetchText();
        const jobs = JSON.parse(text).jobs;
        console.log(`wikidump ${wiki} JSON has been published`);

        const archives: DumpPageInfo = {};

        // get these four date fields, we only use the last two for now
        [
            'articlesmultistreamdumprecombine',
            'articlesmultistreamdump',
            'articlesdumprecombine',
            'articlesdump'
        ].filter(key => key in jobs).forEach(key => archives[key] = jobs[key].updated);

        return archives;
    } catch (error) {
        const dom = parse(text) as DomNode[];
        const [h1, center] = [
            domStroll('Wikidump.4', false, dom, [
                [0, 'html'],
                [3, 'body'],
                [1, 'center'],
                [0, 'h1'],
            ])!,
            domStroll('Wikidump.5', false, dom, [
                [0, 'html'],
                [3, 'body'],
                [4, 'center'],
            ])!,
        ];

        if (h1.children![0].data === '404 Not Found' && center.children![0].data === 'nginx/1.18.0') {
            console.log(`wikidump ${wiki} JSON not yet published - 404 Not Found html in expected place`);
        } else {
            console.error(`[WikiDump/json] ${wiki}`, error);
        }
    }
    return null;
}

interface ListItem {
    children: any[] // TODO fix 'any' type
}

// NOTE `l` will contain a relative link that looks like a file, no trailing slash
// NOTE but that link will redirect to one like a dir, with a trailing slash
function getWikiDumpInfo(li: DomNode): Info | null {
    const kids = li.children!;
    if (kids.length === 4) {
        return {
            wiki: kids[1].children![0].data!,
            date: kids[0].data!,
            stat: kids[3].attribs!.class!,
            link: kids[1].attribs!.href,
        };
    } else {
        const dateAndName = kids[0].data;
        if (dateAndName) {
            const matt = dateAndName.match(/^(\d\d\d\d-\d\d-\d\d \d\d:\d\d:\d\d) (.*) \(private data\): $/);
            if (matt) return {
                wiki: matt[2],
                date: matt[1],
                stat: kids[1].attribs!.class!,
            }
        } else {
            console.log(`[WikiDump] couldn't parse info from '${kids[0].data}'`);
        }
    }
    return null;
}
