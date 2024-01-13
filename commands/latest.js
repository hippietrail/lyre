import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';
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

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects')
        .addBooleanOption(option => option
            .setName('sortbyage')
            .setDescription('Sort by most recent first')
            .setRequired(true));

export const execute = latest;

// TODO missing, but not on GitHub
// Android Studio
// Intellij IDEA

// GitHub JSON name field is 'name version'
const xformNameSplit = (_, jn, __) => jn.split(' ');

// Repo name is name, version is GitHub JSON tag
const xformRepoTag = (ro, _, jt) => [ro.split('/')[1], jt];

// Repo name capitalized is name, version is GitHub JSON tag
function xformRepoCapTag(ro, _, jt) {
    // console.log(`[xformRepoCapTag]`, ron, jt);
    const rn = ro.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt];
}

const ownerRepos = [
    ['apple/swift', xformNameSplit],
    ['audacity/audacity', xformNameSplit],
    ['discordjs/discord.js', xformRepoCapTag],
    ['JetBrains/kotlin', xformNameSplit],
    ['mamedev/mame', xformNameSplit],
    ['microsoft/TypeScript', xformRepoTag],
    ['NationalSecurityAgency/ghidra', xformNameSplit],
    ['nodejs/node', (_, __, jt) => ['Node (Current)', jt]],
    ['odin-lang/Odin', (_, __, jt) => ['Odin', jt]],
    ['oven-sh/bun', xformNameSplit],
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
                    const ageDiff = a.timestamp === undefined
                        ? b.timestamp === undefined ? 0 : 2
                        : b.timestamp === undefined ? -2 : b.timestamp - a.timestamp;

                    return sortByAge && ageDiff
                        ? ageDiff
                        : a.name.localeCompare(b.name);
                })
                .map(nvlt => nvltsToString(nvlt))
                .join('\n');

            if (responses.length === 1)
                reply = `${reply}\n\n(Just waiting for ${thatName} now)`;

            await interaction.editReply(reply);
        }

        const githubPromises = callGithub()
            .then(async arr => await reply(arr, 'GitHub', 'non-GitHub'));

        const otherPromises = Promise.all([
            //callNodejs(), // just use the GitHub one for now, which has link
            callGimp(),
            callXcode(),
            callPython(),
            callGo(),
            //callMame(),   // just use the GitHub one for now, which has link and date
            callDart(),
            callRvm(),
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
            await new Promise(resolve => setTimeout(resolve, 4500)); // delay for GitHub API rate limit
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
            }, {
                name: 'Swift',
                ver: rel.compilers.swift[0].number,
                link: undefined,
                timestamp,
                src: 'xcodereleases.com',
            }];
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

        const html = dom[2];
        if (!html || html.type !== 'tag' || html.name !== 'html')
            throw new Error('html not found');
        const body = html.children[3];
        if (!body || body.type !== 'tag' || body.name !== 'body')
            throw new Error('body not found');
        const main = body.children[9];
        if (!main || main.type !== 'tag' || main.name !== 'main')
            throw new Error('main not found');
        const article = main.children[1];
        if (!article || article.type !== 'tag' || article.name !== 'article')
            throw new Error('article not found');

        const paras = article.children.filter(e => e.type === 'tag' && e.name === 'p');

        let biggestVer = null;
        let dateOfBiggestVer = null;

        for (const [i, para] of paras.entries()) {
            const data = para.children[0].data.trim();
            const mat = data.match(/^go(\d+(?:\.\d+)*)\s+\(released (\d+-\d+-\d+)\)/m);
            const ver = mat ? mat[1] : undefined;

            if (mat && (biggestVer === null || verCmp(ver, biggestVer) > 0)) {
                biggestVer = ver;
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

        const html = dom[2];
        if (!html || html.type !== 'tag' || html.name !== 'html')
            throw new Error('html not found');
        const body = html.children[1];
        if (!body || body.type !== 'tag' || body.name !== 'body')
            throw new Error('body not found');
        const mainContent = body.children[2];
        if (!mainContent || mainContent.type !== 'tag' || mainContent.name !== 'div' || !mainContent.attribs?.class?.includes('mainContent'))
            throw new Error('mainContent not found');
        const article = mainContent.children[3];
        if (!article || article.type !== 'tag' || article.name !== 'article')
            throw new Error('article not found');

        const h2s = article.children.filter(e => e.type === 'tag' && e.name === 'h2');
        
        for (const [i, h2] of h2s.entries()) {
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
