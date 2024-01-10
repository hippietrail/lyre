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

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects');

export const execute = latest;

// TODO missing, but not on GitHub
// Android Studio
// Dart
// Intellij IDEA
// Kotlin

const xformNameSplit = (r, n, t) => n.split(' ');

const xformCapitalizeRepo = (r, n, t) => [r.charAt(0).toUpperCase() + r.slice(1), t];

function xformSwift(r, n, t) {
    const [name, ver, which] = n.split(' ');
    //return [`${name} (${which})`, ver];
    return [name, ver];
}

const githubRepos = [
    ['apple', 'swift', xformSwift],
    ['audacity', 'audacity', xformNameSplit],
    ['discordjs', 'discord.js', xformCapitalizeRepo],
    ['microsoft', 'TypeScript', (r, n, t) => [r, t]],
    ['NationalSecurityAgency', 'ghidra', xformNameSplit],
    ['nodejs', 'node', (r, n, t) => ['Node (Current)', t]],
    ['oven-sh', 'bun', xformNameSplit],
    ['rust-lang', 'rust', xformCapitalizeRepo],
    ['ziglang', 'zig', xformCapitalizeRepo],
];

async function latest(interaction) {
    await interaction.deferReply();
    try {
        let fromGithub = [];
        let fromOthers = [];
        const otherPromises = Promise.all([
            callNodejs(),
            callGimp(),
            callXcode(),
            callPython(),
            callGo(),
        ]).then(async oArr => {
            console.log("Others (not GitHub) have been fetched.");
            fromOthers = oArr.flat();
            const initialReply = `${fromOthers.sort().join('\n')}\n\n(Just waiting for GitHub now)`;
            await interaction.editReply(initialReply);
        });
        const githubPromises = callGithub().then(async gArr => {
            console.log("GitHub has been fetched.");
            fromGithub = gArr.flat();
            await interaction.editReply([...fromOthers, ...fromGithub].sort().join('\n'));
        });

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
    for (const repo of githubRepos) {
        githubReleasesEarl.setPathname(`/repos/${repo[0]}/${repo[1]}/releases/latest`);
        const ob = await githubReleasesEarl.fetchJson();
        const nvlts = githubJsonToNVLTS(repo, ob);
        const nvltsString = nvlts ? nvltsToString(nvlts) : `${repo[1]}: GitHub Error! (API rate limit?)`;
        result.push(nvltsString);
        if (githubRepos.indexOf(repo) < githubRepos.length - 1)
            await new Promise(resolve => setTimeout(resolve, 4500)); // delay for GitHub API rate limit
    }
    return result;
}
  
function transformRepoNameTagVer(repo, ob) {
    const [, repoName, xform] = repo;
    const [obName, obTag] = [ob.name, ob.tag_name];

    if (xform) {
        return xform(repoName, obName, obTag);
    } else {
        console.log(`Unrecognized repo: ${repoName}, name: ${obName}, tag: ${obTag}`);
        return ['?name?', '?ver?'];
    }
}

function githubJsonToNVLTS(repo, ob) {
    // if ob has just the two keys "message" and "documentation_url"
    // we've hit the API limit or some other error
    if (ob.message && ob.documentation_url) {
        console.log(`GitHub releases API error: ${ob.message} ${ob.documentation_url}`);
        return null;
    }

    try {
        const nameVersion = transformRepoNameTagVer(repo, ob);
        const [name, version] = nameVersion;

        return {
            name,
            ver: version,
            link: ob.html_url,
            timestamp: new Date(ob.published_at),
            src: 'github',
        };
    } catch (error) {
        // console.error("<<<", error);
        // console.log(JSON.stringify(ob, null, 2));
        // console.log(">>>");
        return null;
    }
}

async function callNodejs() {
    const rels = await nodejsEarl.fetchJson();
    const curRel = rels.find(rel => rel.lts === false);
    const ltsRel = rels.find(rel => typeof rel.lts === 'string');

    const nvlts = [curRel, ltsRel].map(obj => {
        return {
            name: `Node (${obj.lts === false ? 'Current' : `LTS ${obj.lts}`})`,
            ver: obj.version,
            link: undefined,
            timestamp: new Date(obj.date),
            src: 'nodejs.org',
        };
    });

    return nvlts.map(nvlts => nvltsToString(nvlts));
}
  
async function callGimp() {
    const gj = await gimpEarl.fetchJson();
    if ('STABLE' in gj) {
        if (gj.STABLE.length > 0) {
            if ('version' in gj.STABLE[0]) {
                return [
                    nvltsToString({
                        name: 'Gimp',
                        ver: gj.STABLE[0].version,
                        link: undefined,
                        timestamp: new Date(gj.STABLE[0].date),
                        src: 'gitlab',
                    }),
                ];
            }
        }
    }
    return [];
}
  
async function callXcode() {
    const xcj = await xcodeEarl.fetchJson();
    const rel = xcj.find(obj => obj.name === 'Xcode' && obj.version.release.release === true);
    if (rel) {
        const timestamp = new Date(rel.date.year, rel.date.month - 1, rel.date.day);
        return [
            nvltsToString({
                name: 'Xcode',
                ver: rel.version.number,
                link: rel.links.notes.url,
                timestamp,
                src: 'xcodereleases.com',
            }),
            nvltsToString({
                name: 'Swift',
                ver: rel.compilers.swift[0].number,
                link: rel.links.notes.url,
                timestamp,
                src: 'xcodereleases.com',
            }),
        ];
    }
    return [];
}
  
async function callPython() {
    pythonEarl.setPathname('/repos/python/cpython/tags');
    const pya = await pythonEarl.fetchJson();
    if (pya.message && pya.documentation_url) {
        console.log(`GitHub tags API error: 'python'${pya.message} ${pya.documentation_url}`);
        return [];
    }
    const rel = pya.find(obj => obj.name.match(/^v(\d+)\.(\d+)\.(\d+)$/));
    if (rel) {
        return [
            nvltsToString({
                name: 'Python',
                ver: rel.name,
                link: undefined,
                timestamp: undefined,
                src: 'github',
            }),
        ];
    }
    return [];
}
  
async function callGo() {
    const goj = await goEarl.fetchJson();
    return [
        nvltsToString({
            name: 'Go',
            ver: goj[0].version.replace(/^go/, ''),
            link: undefined,
            timestamp: undefined,
            src: 'go.dev',
        }),
    ];
}
