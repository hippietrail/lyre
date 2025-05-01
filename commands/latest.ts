import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { ago } from '../ute/ago';
import { callGithubReleases } from './latest/githubreleases';
import { callGithubTags } from './latest/githubtags';
import { callWikiDump } from './latest/wikidump';
import { callHarper } from './latest/htmlsources';
import { callNodejs } from './latest/jsonsources';

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects')
    .addStringOption(option => option
        .setName('source-choice')
        .setDescription('Source choice')
        .setRequired(true)
        .addChoices(
            { name: 'All', value: 'all' },
            { name: 'All except GitHub', value: 'all-but-github' },
            { name: 'All except GitHub Releases', value: 'all-but-githubreleases' },
            { name: 'GitHub Releases', value: 'githubreleases' },
            { name: 'GitHub Tags', value: 'githubtags' },
            { name: 'HTML', value: 'html' },
            { name: 'JSON', value: 'json' },
            { name: 'Wiki Dump', value: 'wikidump' },
        ))
    .addStringOption(option => option
        .setName('sort-by')
        .setDescription('Sort by')
        .setRequired(true)
        .addChoices(
            { name: 'Age', value: 'age' },
            { name: 'Alphabetical', value: 'alphabetical' },
        ));

export const execute = latest;

// TODO
// Obsidian
    // `https://obsidian.md/` `body > div.pt-24.sm\:pt-24.relative.overflow-hidden.bg-basalt > div.container.mb-12 > div > div.py-6.mt-4.flex.items-center.gap-6.flex-col.sm\:flex-row > a.download-button.button.button-primary.text-xl.py-4.px-6`
    // `https://obsidian.md/download`
        // `body > div > div.container.my-24 > div.flex.justify-center.sm\:pt-16.pb-12.cards.select-none > a`
        // `body > div > div.container.my-24 > div.text-center > div > a`
interface VersionInfoLoose {
    name?: string | null;
    ver?: string | null;
    link?: string | null;
    timestamp?: Date | null;
    src?: string | null;
}

interface VersionInfoTight {
    name: string;
    ver: string;
    link?: string;
    timestamp?: Date;
    src: string;
}

interface VersionInfoTightArray extends Array<VersionInfoTight> {
    toSorted(compareFn: (a: VersionInfoTight, b: VersionInfoTight) => number): VersionInfoTight[];
}

function toSorted(arr: VersionInfoTight[], compareFn: (a: VersionInfoTight, b: VersionInfoTight) => number): VersionInfoTight[] {
    const sortedArr = [...arr].sort(compareFn);
    return sortedArr;
}

async function latest(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        const sourceChoice = interaction.options.getString('source-choice');
        const sortByAge = interaction.options.getString('sort-by') === 'age';
        console.log(`[latest] sources: ${sourceChoice}, sortByAge: ${sortByAge}`);

        let [useGithubReleases, useGithubTags, useHtml, useJson, useWikiDump] = [false, false, false, false, false];
        switch (sourceChoice) {
            case 'githubreleases':
                useGithubReleases = true;
                break;
            case 'githubtags':
                useGithubTags = true;
                break;
            case 'html':
                useHtml = true;
                break;
            case 'json':
                useJson = true;
                break;
            case 'wikidump':
                useWikiDump = true;
                break;
            case 'all':
                [useGithubReleases, useGithubTags, useHtml, useJson, useWikiDump] = [true, true, true, true, true];
                break;
            case 'all-but-githubreleases':
                [useGithubTags, useHtml, useJson, useWikiDump] = [true, true, true, true];
                break;
            case 'all-but-github':
                [useHtml, useJson, useWikiDump] = [true, true, true];
                break;
        }

        const sourceNames = [
            useGithubReleases && 'GitHub Releases',
            useGithubTags && 'GitHub Tags',
            (useHtml || useWikiDump) && 'HTML',
            useJson && 'JSON'
        ].filter(Boolean);

        console.log(`[latest] sources: ${sourceNames.join(', ')}`);

        const responses: VersionInfoTight[] = [];

        async function updateReply(these: VersionInfoLoose[][], thisName: string) {
            console.log(`All ${thisName} have been fetched.`);
            sourceNames.splice(sourceNames.indexOf(thisName), 1);

            const tightenedUp: VersionInfoTight[] = these.flat()
                .filter(vi => vi.name && vi.ver)
                .map(vi => ({
                    name: vi.name!,
                    ver: vi.ver!,
                    link: vi.link as string | undefined,
                    timestamp: vi.timestamp as Date | undefined,
                    src: vi.src!
                }));

            responses.push(...tightenedUp);

            let reply = (responses as VersionInfoTightArray)
                .toSorted((a: VersionInfoTight, b: VersionInfoTight) => {
                    const ageDiff = !a.timestamp
                        ? !b.timestamp ? 0 : 2
                        : !b.timestamp ? -2 : b.timestamp.getTime() - a.timestamp.getTime();

                    return sortByAge && ageDiff
                        ? ageDiff
                        : a.name.localeCompare(b.name);
                })
                .map((vi: VersionInfoTight) => versionInfoToString(vi))
                .join('\n');

            const note = sourceNames.length !== 0
                ? `\n\n(Still waiting for: ${sourceNames.join(', ')})`
                : '';

            const initialReplyLength = reply.length + note.length;

            // if length > 2000, keep removing lines from the end until it's <= 2000
            let numRemoved = 0;
            while (reply.length + note.length > 2000) {
                reply = reply.split('\n').slice(0, -1).join('\n');
                numRemoved++;
            }

            if (sourceNames.length !== 0)
                reply = `${reply}${note}`;

            if (initialReplyLength !== reply.length)
                console.log(`[latest] trimmed ${numRemoved} lines (${initialReplyLength - reply.length} chars) from end of reply`);

            if (reply === '') reply = 'Odd. Nothing found.';

            await interaction.editReply(reply);
        }

        const sourcePromises = [];

        if (useGithubReleases)
            sourcePromises.push(callGithubReleases(false).then(async arr => await updateReply([arr], 'GitHub Releases')));

        if (useGithubTags)
            sourcePromises.push(callGithubTags(false).then(async arr => await updateReply([arr], 'GitHub Tags')));

        if (useJson) {
            sourcePromises.push(Promise.all([
                //callNodejs(), // doing it another way
            ]).then(async arr => await updateReply(arr, 'JSON')));
        }

        if (useHtml) {
            sourcePromises.push(Promise.all([
                callWikiDump(),     // actually HTML first then JSON
                callHarper(),
            ]).then(async arr => await updateReply(arr, 'HTML')));
        } else if (useWikiDump) {
            sourcePromises.push(callWikiDump().then(async arr => await updateReply([arr], 'HTML')));
        }

        await Promise.all(sourcePromises);
    } catch (error) {
        console.error('[Latest]', error);
    }
}

/**
 * Generates a string representation of a VersionInfo object.
 *
 * @param {object} vi - A VersionInfo object containing the name, version, link, timestamp, and source.
 * @param {string} vi.name - The name.
 * @param {string} vi.ver - The version.
 * @param {string} [vi.link] - The optional link.
 * @param {number} [vi.timestamp] - The optional timestamp.
 * @param {string} vi.src - The source.
 * @return {string} A string representation of the name, version, link, timestamp, and source.
 */
function versionInfoToString(vi: {
    name: string;
    ver: string;
    link?: string;
    timestamp?: Date;
    src: string;
}): string {
    const parts = [
        `${vi.name}:`,
        vi.link ? `[${vi.ver}](<${vi.link}>)` : vi.ver
    ];

    if (vi.timestamp) parts.push(`- ${ago(new Date().getTime() - vi.timestamp.getTime())}`);
    parts.push(`(${vi.src})`);
    return parts.join(' ');
}
