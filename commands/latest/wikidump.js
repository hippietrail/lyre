import { Earl } from '../../ute/earl.js';
import { domStroll } from '../../ute/dom.js';
import parse from 'html-dom-parser';

const wikidumpEarl = new Earl('https://dumps.wikimedia.org', '/backup-index.html');

export async function callWikiDump() {
    const indexDom = parse(await wikidumpEarl.fetchText());

    try {
        const ul = domStroll('Wikidump.1', false, indexDom, [
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

            if (info && [
                'enwiktionary',
                'enwiki',
                // 'thwiktionary'
            ].includes(info.w)) {
                const url = new URL(wikidumpEarl.getOrigin());
                url.pathname = info.l;

                // do different things depending on the status
                switch (info.s) {
                    case 'Dump in progress':
                        // status class is 'in-progress'
                        console.log(`[WikiDump] ${info.c} ${info.w}`);
                        await scrapeThisDumpsPage(url, info);
                        break;

                    case 'Partial dump':
                        // status class is ??? TODO...
                        console.log(`[WikiDump] ${info.c} ${info.w}`);
                        await scrapeThisDumpsPage(url, info);
                        break;

                    case 'Dump complete':
                        // status class is 'done'
                        console.log(`[WikiDump] ${info.c} ${info.w}`);
                        await scrapeThisDumpsPage(url, info);
                        break;

                    default:
                        // unexpected status
                        // other known statuses classes are 'waiting' and 'skipped'
                        console.log(`[WikiDump] ${info.c} (${info.s}) ${info.w}`);
                }

                // for the version we use the date in the form `yyyymmdd`
                chosen.push({
                    name: `${info.w} (${info.c})`,
                    ver: info.d.substring(0, 10).replace(/-/g, ''),
                    link: url.href,
                    timestamp: new Date(info.d),
                    src: 'dumps.wikimedia.org',
                });
            }
        }

        return chosen;

    } catch (error) {
        console.error(`[WikiDump]`, error);
    }

    return [];
}

async function scrapeThisDumpsPage(url, info) {
    try {
        const wikiEarl = new Earl(url.origin, url.pathname);
        console.log(`[WikiDump/dump] ${wikiEarl.getUrlString()}`);

        const wikiDom = parse(await wikiEarl.fetchText());
        const ul = domStroll('Wikidump.2', false, wikiDom, [
            [2, 'html'],
            [3, 'body'],
            [21, 'ul'],
        ]);

        for (const [i, li] of ul.children.entries()) {
            if (i % 2 === 0) continue;

            const titleSpan = domStroll('Wikidump.3', false, li.children, [
                [4, 'span', { cls: 'title' }],
            ]);

            const titleBold = domStroll('Wikidump.4', false, titleSpan.children, [
                [0, 'big', { optional: true }],
                [0, 'b', { optional: true }],
            ]);

            const title = (titleBold || titleSpan).children[0].data;

            if (title.startsWith('Articles, templates, media/file descriptions, and primary meta-pages')) {
                //console.log(`[WikiDump/dump] ART ${info.w} ${i} ${li.type} ${li.name}\n  ${li.attribs.class} : ${title}`);

                const titleUlAfterSpan = domStroll('Wikidump.5', false, li.children, [
                    [5, 'ul'],
                ]);

                const numKids = titleUlAfterSpan.children.length;

                // console.log(`[WikiDump/dump] ${numKids} kids, title len: ${title.length}, has titleBold? ${!!titleBold}`);

                // these three values go together so there should only be two possibilities
                if (title.length === 69 && titleBold) {
                    if (numKids === 1)
                        console.log(`  pages-articles.xml.bz2`);
                    else
                        console.log(`  multipart pages-articles.xml.bz2 (${(numKids + 1) / 2} archive files)`);
                } else if (title.length === 115 && !titleBold) {
                    if (numKids === 3)
                        console.log(`  pages-articles-multistream.xml.bz2 (and index)`);
                    else
                        console.log(`  multipart pages-articles-multistream.xml.bz2 (${(numKids + 1) / 4} archive+index file pairs)`);
                } else {
                    console.log(`[WikiDump/dump] failed to parse ${numKids} kids, title len: ${title.length}, has titleBold? ${!!titleBold}`);
                }
            }
        }
    } catch (error) {
        console.error(`[WikiDump]`, error);
    }
}

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
