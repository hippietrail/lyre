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
    ['NationalSecurityAgency', 'ghidra'],
    ['nodejs', 'node'],
    ['oven-sh', 'bun'],
    ['ziglang', 'zig'],
    ['rust-lang', 'rust'],
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

function nameLinkAndTimestampToString(nlt) {
    if (nlt[2])
        return `${nlt[0]}: [${nlt[1]}](<${nlt[2]}>) - ${ago(new Date() - nlt[3])}`;
    else
        return `${nlt[0]}: ${nlt[1]} - ${ago(new Date() - nlt[3])}`;
}

async function callGithub() {
    return (await Promise.all(repos.map(async (repo) => {
        githubEarl.setPathname(`/repos/${repo[0]}/${repo[1]}/releases/latest`);
        const ob = await githubEarl.fetchJson();
        console.log(ob.name)
        return nameLinkAndTimestampToString(githubJsonObToNameLinkAndTimestamp(repo[1], ob));
    }))).join('\n');
}

function githubJsonObToNameLinkAndTimestamp(repoName, ob) {
    return [repoName, ob.name, ob.html_url, new Date(ob.published_at)];
}

async function callNodejs() {
    const arr = await nodejsEarl.fetchJson();
    const currentRel = arr.find(obj => obj.lts === false);
    const ltsRel = arr.find(obj => typeof obj.lts === 'string');

    const versionsTimestampsAndNames = [currentRel, ltsRel].map(obj => [
        obj.version,
        new Date(obj.date),
        obj.lts === false ? 'Current' : obj.lts
    ]);

    const namesLinksTimestamps = versionsTimestampsAndNames.map(arr => [
        'Node.js',
        `${arr[2]} ${arr[0]}`,
        undefined,
        arr[1]
    ]);

    const reply = namesLinksTimestamps.map(arr => nameLinkAndTimestampToString(arr)).join('\n');

    return reply;
}