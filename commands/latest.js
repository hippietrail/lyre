import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';

const githubReleasesEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');
const nodejsEarl = new Earl('https://nodejs.org', '/dist/index.json');
const gimpEarl = new Earl('https://gitlab.gnome.org',
    '/Infrastructure/gimp-web/-/raw/testing/content/gimp_versions.json', {
    'inline': false
});
const xcodeEarl = new Earl('https://xcodereleases.com', '/data.json');
const pythonEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/tags');
const goEarl = new Earl('https://go.dev', '/dl/', { 'mode': 'json' });
const mameEarl = new Earl('https://raw.githubusercontent.com', '/Calinou/scoop-games/master/bucket/mame.json');
const dartEarl = new Earl('https://storage.googleapis.com', '/dart-archive/channels/stable/release/latest/VERSION');

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects');

export const execute = latest;

// TODO missing, but not on GitHub
// Android Studio
// Intellij IDEA

// GitHub JSON name field is 'name version'
const xformNameSplit = (_, jn, __) => jn.split(' ');

// Repo name is name, version is GitHub JSON tag
const xformRepoTag = (ron, _, jt) => [ron.split('/')[1], jt];

// Repo name capitalized is name, version is GitHub JSON tag
function xformRepoCapTag(ron, _, jt) {
    // console.log(`[xformRepoCapTag]`, ron, jt);
    const rn = ron.split('/')[1];
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
    ['oven-sh/bun', xformNameSplit],
    ['rust-lang/rust', xformRepoCapTag],
    ['ziglang/zig', xformRepoCapTag],
];

async function latest(interaction) {
    await interaction.deferReply();

    try {
        let responses = [];

        async function reply(these, thisName, thatName) {
            console.log(`All ${thisName} have been fetched. ${responses.length === 0 ? 'First.' : 'Last.'}`);

            responses.push(these.flat());

            let reply = responses.flat().toSorted().join('\n');
            
            if (responses.length === 1)
                reply = `${reply}\n\n(Just waiting for ${thatName} now)`;
            
            await interaction.editReply(reply);
        }
    
        const githubPromises = callGithub()
            .then(async arr => await reply(arr, 'GitHub', 'non-GitHub'));

        const otherPromises = Promise.all([
            callNodejs(),
            callGimp(),
            callXcode(),
            callPython(),
            callGo(),
            callMame(),
            callDart(),
        ]).then(async arr => await reply(arr, 'Non-GitHub', 'GitHub'));

        await Promise.all([githubPromises, otherPromises]);
    } catch (error) {
        console.error('[Latest]', error);
    }
}

/**
 * Generates a string representation of a name, version, link, timestamp, and source.
 *
 * @param {object} nlt - An object containing the name, version, link, timestamp, and source.
 * @param {string} nlt.name - The name.
 * @param {string} nlt.ver - The version.
 * @param {string} [nlt.link] - The optional link.
 * @param {number} [nlt.timestamp] - The optional timestamp.
 * @param {string} nlt.src - The source.
 * @return {string} A string representation of the name, version, link, timestamp, and source.
 */
function nvltsToString(nlt) {
    const parts = [
        `${nlt.name}:`,
        nlt.link ? `[${nlt.ver}](<${nlt.link}>)` : nlt.ver
    ];

    if (nlt.timestamp) parts.push(`- ${ago(new Date() - nlt.timestamp)}`);
    parts.push(`(${nlt.src})`);
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
        const nvltsString = nvlts ? nvltsToString(nvlts) : `${repoEntry[0]}: GitHub Error! (API rate limit?)`;
        result.push(nvltsString);

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
            name: `Node (${obj.lts === false ? 'Current' : `LTS ${obj.lts}`})`,
            ver: obj.version,
            link: undefined,
            timestamp: new Date(obj.date),
            src: 'nodejs.org',
        })).map(nvlts => nvltsToString(nvlts));
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
            return [
                nvltsToString({
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
                }),
            ];
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
            }].map(nvlts => nvltsToString(nvlts));
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

            if (rel) return [
                nvltsToString({
                    name: 'Python',
                    ver: rel.name,
                    link: undefined,
                    timestamp: undefined,
                    src: 'github',
                }),
            ];
        }
    } catch (error) {
        console.error(`[Python]`, error);
    }
    return [];
}
  
async function callGo() {
    try {
        const goj = await goEarl.fetchJson();

        return [
            nvltsToString({
                name: 'Go',
                ver: goj[0].version.replace(/^go/, ''),
                link: `https://go.dev/doc/devel/release#${goj[0].version}`,
                timestamp: undefined,
                src: 'go.dev',
            }),
        ];
    } catch (error) {
        console.error(`[Go]`, error);
    }
    return [];
}

async function callMame() {
    try {
        const mamej = await mameEarl.fetchJson();

        return [
            nvltsToString({
                name: 'MAME',
                ver: mamej.version,
                link: undefined,
                timestamp: undefined,
                src: 'githubusercontent.com',
            }),
        ];
    } catch (error) {
        console.error(`[MAME]`, error);
    }
    return [];
}

async function callDart() {
    try {
        const dartj = await dartEarl.fetchJson();

        return [
            nvltsToString({
                name: 'Dart',
                ver: dartj.version,
                link: `https://github.com/dart-lang/sdk/releases/tag/${dartj.version}`,
                timestamp: new Date(dartj.date),
                src: 'googleapis.com',
            })
        ];
    } catch (error) {
        console.error(`[Dart]`, error);
    }
    return [];
}
