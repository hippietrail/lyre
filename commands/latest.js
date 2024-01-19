import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';
import { domStroll } from '../ute/dom.js';
import parse from 'html-dom-parser';

const githubReleasesEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');
const nodejsEarl = new Earl('https://nodejs.org', '/dist/index.json');
const gimpEarl = new Earl('https://gitlab.gnome.org',
    '/Infrastructure/gimp-web/-/raw/testing/content/gimp_versions.json', {
    'inline': false
});
const xcodeEarl = new Earl('https://xcodereleases.com', '/data.json');
const pythonEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/tags');
const goEarl = new Earl('https://go.dev', '/doc/devel/release');
const mameEarl = new Earl('https://raw.githubusercontent.com', '/Calinou/scoop-games/master/bucket/mame.json');
const dartEarl = new Earl('https://storage.googleapis.com', '/dart-archive/channels/stable/release/latest/VERSION');
const rvmEarl = new Earl('https://www.retrovirtualmachine.org', '/changelog/');
const asEarl = new Earl('https://androidstudio.googleblog.com');
const elixirEarl = new Earl('https://elixir-lang.org', '/blog/categories.html');
const phpEarl = new Earl('https://www.php.net', '/releases/index.php');

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects')
        .addBooleanOption(option => option
            .setName('sortbyage')
            .setDescription('Sort by most recent first')
            .setRequired(true));

export const execute = latest;

// TODO missing, but not on GitHub
// Intellij IDEA
// Java/JDK/JVM?
// C#

// GitHub JSON name field is 'name version'
const xformNameSplit = (_, jn, __) => jn.split(' ');

// Repo name is name, version is GitHub JSON tag
const xformRepoTag = (ro, _, jt) => [ro.split('/')[1], jt];

// Repo name capitalized is name, version is GitHub JSON tag
function xformRepoCapTag(ro, _, jt) {
    // console.log(`[xformRepoCapTag]`, ro, jt);
    const rn = ro.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt];
}

// Repo name capitalized is name, version is GitHub JSON tag with _ converted to .
function xformRepoCapTagVersionUnderscore(ro, _, jt) {
    // console.log(`[xformRepoCapTagVersionUnderscore]`, ro, jt);
    const rn = ro.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt.replace(/_/g, '.')];
}

const ownerRepos = [
    ['apple/swift', xformNameSplit],
    ['audacity/audacity', xformNameSplit],
    ['discordjs/discord.js', xformRepoCapTag],
    ['elixir-lang/elixir', xformRepoCapTag],
    ['JetBrains/kotlin', xformNameSplit],
    ['llvm/llvm-project', xformNameSplit],
    ['lua/lua', xformNameSplit],
    ['mamedev/mame', xformNameSplit],
    ['microsoft/TypeScript', xformRepoTag],
    ['NationalSecurityAgency/ghidra', xformNameSplit],
    ['nodejs/node', (_, __, jt) => ['Node (Current)', jt]],
    ['odin-lang/Odin', (_, __, jt) => ['Odin', jt]],
    ['oven-sh/bun', xformNameSplit],
    ['ruby/ruby', xformRepoCapTagVersionUnderscore],
    ['rust-lang/rust', xformRepoCapTag],
    ['ziglang/zig', xformRepoCapTag],
];

async function latest(interaction) {
    await interaction.deferReply();

    try {
        let responses = [];

        let sortByAge = interaction.options.getBoolean('sortbyage');
        console.log(`[latest] sortByAge: ${sortByAge}`);

        async function reply(these, thisName, thatName) {
            console.log(`All ${thisName} have been fetched. ${responses.length === 0 ? 'First.' : 'Last.'}`);

            responses.push(these.flat());

            let reply = responses.flat()
                .toSorted((a, b) => {
                    const ageDiff = !a.timestamp
                        ? !b.timestamp ? 0 : 2
                        : !b.timestamp ? -2 : b.timestamp - a.timestamp;

                    return sortByAge && ageDiff
                        ? ageDiff
                        : a.name.localeCompare(b.name);
                })
                .map(nvlt => nvltsToString(nvlt))
                .join('\n');

            const note = responses.length === 1
                ? `\n\n(Just waiting for ${thatName} now)`
                : '';

            const initialReplyLength = reply.length + note.length;

            // if length > 2000, keep removing lines from the end until it's <= 2000
            let numRemoved = 0;
            while (reply.length + note.length > 2000) {
                reply = reply.split('\n').slice(0, -1).join('\n');
                numRemoved++;
            }

            if (responses.length === 1)
                reply = `${reply}${note}`;

            if (initialReplyLength !== reply.length)
                console.log(`[latest] trimmed ${numRemoved} lines (${initialReplyLength - reply.length} chars) from end of reply`);

            await interaction.editReply(reply);
        }

        const githubPromises = callGithub()
            .then(async arr => await reply(arr, 'GitHub', 'non-GitHub'));

        const otherPromises = Promise.all([
            //callNodejs(), // JSON - just use the GitHub one for now, which has link
            callGimp(),     // JSON
            callXcode(),    // JSON
            callPython(),   // JSON
            callGo(),       // scraper
            //callMame(),   // JSON - just use the GitHub one for now, which has link and date
            callDart(),     // JSON
            callRvm(),      // scraper
            callAS(),       // scraper
            callElixir(),   // scraper
            callPhp(),      // JSON
        ]).then(async arr => await reply(arr, 'Non-GitHub', 'GitHub'));

        await Promise.all([githubPromises, otherPromises]);
    } catch (error) {
        console.error('[Latest]', error);
    }
}

/**
 * Generates a string representation of a name, version, link, timestamp, and source.
 *
 * @param {object} nvlts - An object containing the name, version, link, timestamp, and source.
 * @param {string} nvlts.name - The name.
 * @param {string} nvlts.ver - The version.
 * @param {string} [nvlts.link] - The optional link.
 * @param {number} [nvlts.timestamp] - The optional timestamp.
 * @param {string} nvlts.src - The source.
 * @return {string} A string representation of the name, version, link, timestamp, and source.
 */
function nvltsToString(nvlts) {
    // TODO doesn't handle being null due to github API limit
    const parts = [
        `${nvlts.name}:`,
        nvlts.link ? `[${nvlts.ver}](<${nvlts.link}>)` : nvlts.ver
    ];

    if (nvlts.timestamp) parts.push(`- ${ago(new Date() - nvlts.timestamp)}`);
    parts.push(`(${nvlts.src})`);
    return parts.join(' ');
}

async function callGithub() {
    let result = [];

    for (const [i, repoEntry] of ownerRepos.entries()) {
        // console.log(`[callGithub] i: ${i}, owner/repo: ${repoEntry[0]}`);
        githubReleasesEarl.setPathname(`/repos/${repoEntry[0]}/releases/latest`);
        const ob = await githubReleasesEarl.fetchJson();
        console.log(`GitHub [${i + 1}/${ownerRepos.length}] ${repoEntry[0]}`);
        const nvlts = githubJsonToNVLTS(repoEntry, ob);
        result.push(nvlts);

        if (i < ownerRepos.length - 1)
            await new Promise(resolve => setTimeout(resolve, 4600)); // delay for GitHub API rate limit
    }
    return result;
}

function xformRepoNameTagVer(repo, jsonOb) {
    const [githubOwnerRepo, xform] = repo;
    const [jsonName, jsonTag] = [jsonOb.name, jsonOb.tag_name];

    if (xform) {
        return xform(githubOwnerRepo, jsonName, jsonTag);
    } else {
        console.log(`Unrecognized repo: ${githubOwnerRepo}, name: ${jsonName}, tag: ${jsonTag}`);
        return ['?name?', '?ver?'];
    }
}

function githubJsonToNVLTS(repoEntry, jsonObj) {
    // if ob has just the two keys "message" and "documentation_url"
    // we've hit the API limit or some other error
    if ('message' in jsonObj && 'documentation_url' in jsonObj) {
        console.log(`GitHub releases API error: ${jsonObj.message} ${jsonObj.documentation_url}`);
    } else try {
        const [name, version] = xformRepoNameTagVer(repoEntry, jsonObj);

        return {
            name,
            ver: version,
            link: jsonObj.html_url,
            timestamp: new Date(jsonObj.published_at),
            src: 'github',
        };
    } catch (error) {
        // console.error("<<<", error);
        // console.log(JSON.stringify(ob, null, 2));
        // console.log(">>>");
    }
    return null;
}

async function callNodejs() {
    try {
        const rels = await nodejsEarl.fetchJson();

        return [
            rels.find(rel => rel.lts === false),
            rels.find(rel => typeof rel.lts === 'string')
        ].map(obj => ({
            name: `Node ${obj.lts === false ? '(Current)' : `'${obj.lts}' (LTS)`}`,
            ver: obj.version,
            link: undefined,
            timestamp: new Date(obj.date),
            src: 'nodejs.org',
        }));
    } catch (error) {
        console.error(`[Node.js]`, error);
    }
    return [];
}

async function callGimp() {
    try {
        const gj = await gimpEarl.fetchJson();

        if ('STABLE' in gj && gj.STABLE.length > 0 && 'version' in gj.STABLE[0]) {
            const ver = gj.STABLE[0].version;
            const date = new Date(gj.STABLE[0].date);
            return [{
                name: 'Gimp',
                ver: ver,
                link: `https://gitlab.gnome.org/GNOME/gimp/-/releases/GIMP_${gj.STABLE[0].version.replace(/\./g, '_')}`,
                // the day is not accurate for the news link. 2.10.36 is off by 2 days
                /*link: `https://www.gimp.org/news/${
                    date.getFullYear()
                }/${
                    date.getMonth() + 1
                }/${
                    date.getDate().toString().padStart(2, '0')
                }/gimp-${ver.replace(/\./g, '-')}-released`,*/
                timestamp: date,
                src: 'gitlab',
            }];
        }
    } catch (error) {
        console.error(`[Gimp]`, error);
    }
    return [];
}

async function callXcode() {
    try {
        const xcj = await xcodeEarl.fetchJson();

        const rel = xcj.find(obj => obj.name === 'Xcode' && obj.version.release.release === true);

        if (rel) {
            const timestamp = new Date(rel.date.year, rel.date.month - 1, rel.date.day);
            return [{
                name: 'Xcode',
                ver: rel.version.number,
                link: rel.links.notes.url,
                timestamp,
                src: 'xcodereleases.com',
            }/*, {
                name: 'Swift',
                ver: rel.compilers.swift[0].number,
                link: undefined,
                timestamp,
                src: 'xcodereleases.com',
            }*/];
        }
    } catch (error) {
        console.error(`[Xcode]`, error);
    }
    return [];
}

async function callPython() {
    pythonEarl.setPathname('/repos/python/cpython/tags');

    try {
        const pya = await pythonEarl.fetchJson();

        if (pya.message && pya.documentation_url) {
            console.log(`[Python] GitHub tags API error: 'python'${pya.message} ${pya.documentation_url}`);
        } else {
            const rel = pya.find(obj => obj.name.match(/^v(\d+)\.(\d+)\.(\d+)$/));

            // TODO if the 2nd fetch fails, use this link to the tag release:
            // TODO `https://github.com/python/cpython/releases/tag/${rel.name}`,
            // TODO but there is more human-friendly documentation at:
            // TODO https://docs.python.org/3.12/
            //
            // Note that though it mentions the full version number it only goes
            // on to cover the major/minor version: 3.12.1 vs 3.12
            //
            // > Python 3.12.1 documentation
            // > Welcome! This is the official documentation for Python 3.12.1.
            // >
            // > Parts of the documentation:
            // >
            // > What's new in Python 3.12?
            // > or all "What's new" documents since 2.0

            if (rel) {
                const url = rel.commit.url;
                const response = await fetch(url);
                const json = await response.json();

                // there is commit.author.date and commit.committer.date...
                const [authorDate, committerDate] = ["author", "committer"].map(k => new Date(json.commit[k].date));
                // print which is newer, and by how many seconds/minutes
                // in the one I checked, the committer is newer by about 15 minutes
                const [newer, older, diff, date] = committerDate > authorDate
                    ? ['committer', 'author', committerDate - authorDate, committerDate]
                    : ['author', 'committer', authorDate - committerDate, authorDate];
                console.log(`[Python] ${newer} is newer than ${older} by ${ago(diff).replace(' ago', '')}`);

                return [{
                    name: 'Python',
                    ver: rel.name,
                    link: json.html_url,
                    timestamp: date,
                    src: 'github',
                }];
            }
        }
    } catch (error) {
        console.error(`[Python]`, error);
    }
    return [];
}

async function callGo() {
    const verCmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    try {
        const dom = parse(await goEarl.fetchText());

        const article = domStroll('Go', false, dom, [
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

async function callMame() {
    try {
        const mamej = await mameEarl.fetchJson();

        return [{
            name: 'MAME',
            ver: mamej.version,
            link: undefined,
            timestamp: undefined,
            src: 'githubusercontent.com',
        }];
    } catch (error) {
        console.error(`[MAME]`, error);
    }
    return [];
}

async function callDart() {
    try {
        const dartj = await dartEarl.fetchJson();

        return [{
            name: 'Dart',
            ver: dartj.version,
            link: `https://github.com/dart-lang/sdk/releases/tag/${dartj.version}`,
            timestamp: new Date(dartj.date),
            src: 'googleapis.com',
        }];
    } catch (error) {
        console.error(`[Dart]`, error);
    }
    return [];
}

async function callRvm() {
    try {
        const dom = parse(await rvmEarl.fetchText());

        const article = domStroll('RVM', false, dom, [
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

async function callAS() {
    // note we can use a URL like
    // https://androidstudio.googleblog.com/search?updated-max=2022-12-26T10:01:00-08:00&max-results=25
    // we can use just the `max-results` param - it actually only goes up to 24 though
    try {
        asEarl.setPathname('/search');
        asEarl.setSearchParam('max-results', 24);

        const dom = parse(await asEarl.fetchText());

        const blog1 = domStroll('AS2a', false, dom, [
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

        return Array.from(chosenPostPerChannel.values());
    } catch (error) {
        console.error(`[AS]`, error);
    }
    return [];
}

async function callElixir() {
    try {
        const dom = parse(await elixirEarl.fetchText());

        const releasesLI = domStroll('Elixir', false, dom, [
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

async function callPhp() {
    phpEarl.setSearchParam('json', '');
    try {
        const phpj = await phpEarl.fetchJson();
        // we get an object with a key for each major version number, in ascending order
        const latest = Object.values(phpj).pop();
        const maj = latest.version.match(/^(\d+)\.\d+\.\d+$/)[1];
        return [{
            name: 'PHP',
            ver: latest.version,
            link: `https://www.php.net/ChangeLog-${maj}.php#${latest.version}`,
            timestamp: new Date(latest.date),
            src: 'php.net',
        }];
    } catch (error) {
        console.error(`[PHP]`, error);
    }
    return [];
}
