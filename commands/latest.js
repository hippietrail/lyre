import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';

const githubEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');
const nodejsEarl = new Earl('https://nodejs.org', '/dist/index.json');

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects');

export const execute = latest;

const repos = [
    ['audacity', 'audacity'],
    ['microsoft', 'TypeScript'],
    ['NationalSecurityAgency', 'ghidra'],
    ['nodejs', 'node'],
    ['oven-sh', 'bun'],
    ['rust-lang', 'rust'],
    ['ziglang', 'zig'],
];

async function latest(interaction) {
    await interaction.deferReply();
    let reply = 'An error occurred while fetching data.';
    try {
        const [githubReply, nodejsReply] = await Promise.all([callGithub(), callNodejs()]);
        reply = `${githubReply}\n${nodejsReply}`;
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
        console.log(`callGithub:ob.name: ${ob.name}`);

        const nvlts = githubJsonToNameVerLinkTimestampSrc(repo, ob);
        const nvltsString = nvlts ? nvltsToString(nvlts) : 'GitHub API rate limit!';
        return nvltsString;
    }))).join('\n');
}

function convertObNameAndTagToNameAndVersion(repo, ob) {
    const repoName = repo[1];
    const [obName, obTag] = [ob.name, ob.tag_name];

    let [name, ver] = ['?name?', '?ver?'];
    switch (repoName) {
        case 'audacity':
            [name, ver] = obName.split(' ');
            break;
        case 'bun':
            [name, ver] = obName.split(' ');
            break;
        case 'ghidra':
            [name, ver] = obName.split(' ');
            break;
        case 'node':
            [name, ver] = ['Node (Current)', obTag]
            break;
        case 'rust':
            [name, ver] = ['Rust', obTag];
            break;
        case 'TypeScript':
            [name, ver] = ['TypeScript', obTag];
            break;
        case 'zig':
            [name, ver] = ['Zig', obTag];
            break;
        default:
            // name and ver already set to '?name?' and '?ver?'
            console.log(`Unrecognized repo: ${repoName}, name: ${obName}, tag: ${obTag}`);
    }
    return [name, ver];
}

function githubJsonToNameVerLinkTimestampSrc(repo, ob) {
    console.log(`${repo[1]}, json name: ${ob.name}, json tag: ${ob.tag_name}`);
    console.log("repo", JSON.stringify(repo, null, 2));
    console.log("ob", JSON.stringify(ob, null, 2));

    // if ob has just the two keys "message" and "documentation_url"
    // i've hit the api limit
    if (ob.message && ob.documentation_url) return null

    const [name, version] = convertObNameAndTagToNameAndVersion(repo, ob);

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

    const reply = nvlts.map(arr => nvltsToString(arr)).join('\n');

    return reply;
}