import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';

const githubEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');
const nodejsEarl = new Earl('https://nodejs.org', '/dist/index.json');
const gimpEarl = new Earl('https://gitlab.gnome.org',
    '/Infrastructure/gimp-web/-/raw/testing/content/gimp_versions.json', {
    'inline': false
});

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects');

export const execute = latest;

// TODO missing, but not on GitHub
// Android Studio
// Intellij IDEA
// Kotlin
// Swift
// Xcode

const xformNameSplit = (r, n, t) => n.split(' ');

function xformSwift(r, n, t) {
    const [name, ver, which] = n.split(' ');
    return [`${name} (${which})`, ver];
}

const repos = [
    ['apple', 'swift', xformSwift],
    ['audacity', 'audacity', xformNameSplit],
    ['microsoft', 'TypeScript', (r, n, t) => [r, t]],
    ['NationalSecurityAgency', 'ghidra', xformNameSplit],
    ['nodejs', 'node', (r, n, t) => ['Node (Current)', t]],
    ['oven-sh', 'bun', xformNameSplit],
    ['rust-lang', 'rust', (r, n, t) => ['Rust', t]],
    ['ziglang', 'zig', (r, n, t) => ['Zig', t]],
];

async function latest(interaction) {
    await interaction.deferReply();
    let reply = 'An error occurred while fetching data.';
    try {
        const replies = await Promise.all([
            callGithub(),
            callNodejs(),
            callGimp(),
        ]);
        reply = replies.join('\n');
    } catch (error) {
        console.error(error);
    }
    await interaction.editReply(reply);
}

function nvltsToString(nlt) {
    if (nlt.link)
        return `${nlt.name}: [${nlt.ver}](<${nlt.link}>) - ${ago(new Date() - nlt.timestamp)} (${nlt.src})`;
    else
        return `${nlt.name}: ${nlt.ver} - ${ago(new Date() - nlt.timestamp)} (${nlt.src})`;
}

async function callGithub() {
    return (await Promise.all(repos.map(async (repo) => {
        githubEarl.setPathname(`/repos/${repo[0]}/${repo[1]}/releases/latest`);
        const ob = await githubEarl.fetchJson();
        console.log(`callGithub: owner: ${repo[0]}, repo: ${repo[1]}, ${
            'name' in ob ? `ob.name: ${ob.name}` : 'API rate limit!'
        }`);

        const nvlts = githubJsonToNVLTS(repo, ob);
        const nvltsString = nvlts ? nvltsToString(nvlts) : 'GitHub API rate limit!';
        return nvltsString;
    }))).join('\n');
}

function transformRepoNameTagVer(repo, ob) {
    const [, repoName, xform] = repo;
    const [obName, obTag] = [ob.name, ob.tag_name];

    if (xform) {
        return xform(repoName, obName, obTag);
    } else {
        // name and ver already set to '?name?' and '?ver?'
        console.log(`Unrecognized repo: ${repoName}, name: ${obName}, tag: ${obTag}`);
        return ['?name?', '?ver?'];
    }
}

function githubJsonToNVLTS(repo, ob) {
    // if ob has just the two keys "message" and "documentation_url"
    // we've hit the API limit
    if (ob.message && ob.documentation_url) return null

    const [name, version] = transformRepoNameTagVer(repo, ob);

    return {
        name,
        ver: version,
        link: ob.html_url,
        timestamp: new Date(ob.published_at),
        src: 'github',
    };
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

    const reply = nvlts.map(nvlts => nvltsToString(nvlts)).join('\n');

    return reply;
}

async function callGimp() {
    const gj = await gimpEarl.fetchJson();
    if ('STABLE' in gj) {
        if (gj.STABLE.length > 0) {
            if ('version' in gj.STABLE[0]) {
                return nvltsToString({
                    name: 'Gimp',
                    ver: gj.STABLE[0].version,
                    link: undefined,
                    timestamp: new Date(gj.STABLE[0].date),
                    src: 'gitlab',
                });
            }
        }
    }
    return '';
}
