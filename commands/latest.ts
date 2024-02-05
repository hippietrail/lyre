////@ts-nocheck
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { ago } from '../ute/ago.js';
import { callGithubReleases } from './latest/githubreleases.js';
import { callGithubTags } from './latest/githubtags.js';
import { callWikiDump } from './latest/wikidump.js';
import { callGo, callRvm, callAS, callElixir, callRuby, callIdea, callSdlMame, callSublime } from './latest/htmlsources.js';
import { callNodejs, callGimp, callXcode, callMame, callDart, callPhp } from './latest/jsonsources.js';

export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects')
    .addStringOption(option => option
        .setName('source-choice')
        .setDescription('Source choice')
        .setRequired(true)
        .addChoices(
            { name: 'GitHub Releases', value: 'githubreleases' },
            { name: 'GitHub Tags', value: 'githubtags' },
            { name: 'HTML', value: 'html' },
            { name: 'JSON', value: 'json' },
            { name: 'Wiki Dump', value: 'wikidump' },
            { name: 'All', value: 'all' },
            { name: 'All except GitHub Releases', value: 'all-but-githubreleases' },
            { name: 'All except GitHub', value: 'all-but-github' },
        ))
    .addStringOption(option => option
        .setName('sortby')
        .setDescription('Sort by')
        .setRequired(true)
        .addChoices(
            { name: 'Age', value: 'age' },
            { name: 'Alphabetical', value: 'alphabetical' },
        ));

export const execute = latest;

// TODO
// C standard?
// C++ standard?
// C#
// CC-CEDICT
// EcmaScript standard?
// Erlang
// gcc
// Groovy
// Haskell
// Java/JDK/JVM?
// Objective C? on GitHub tags only apple-oss-distributions/objc4
// Unicode
//  CLDR
//  ICU
//  ICU4X
// Vim

async function latest(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        let responses: any[] = []; // TODO fix 'any' type

        const sourceChoice = interaction.options.getString('source-choice');
        const sortByAge = interaction.options.getString('sortby') === 'age';
        console.log(`[latest] sources: ${sourceChoice}, sortBy: ${sortByAge}`);

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

        // TODO fix 'any' type
        async function updateReply(these: any[], thisName: string) {
            console.log(`All ${thisName} have been fetched.`);
            sourceNames.splice(sourceNames.indexOf(thisName), 1);

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
                .map(vi => versionInfoToString(vi))
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

            // empty updated replies are now possible due to the way we skip sources
            // if (reply === '')
            //     console.log(`[latest] empty reply, not updating.`);
            // else
            await interaction.editReply(reply);
        }

        const sourcePromises = [];

        if (useGithubReleases)
            sourcePromises.push(callGithubReleases(false).then(async arr => await updateReply(arr, 'GitHub Releases')));

        if (useGithubTags)
            sourcePromises.push(callGithubTags(false).then(async arr => await updateReply(arr, 'GitHub Tags')));
        
        if (useJson) {
            sourcePromises.push(Promise.all([
                //callNodejs(),
                callGimp(),
                callXcode(),
                //callMame(),
                callDart(),
                callPhp(),
            ]).then(async arr => await updateReply(arr, 'JSON')));
        }

        if (useHtml) {
            sourcePromises.push(Promise.all([
                callGo(),
                callRvm(),
                callAS(),
                callElixir(),
                callRuby(),
                callIdea(),
                callWikiDump(), // actually HTML first then JSON
                callSdlMame(),
                callSublime(),
            ]).then(async arr => await updateReply(arr, 'HTML')));
        } else if (useWikiDump) {
            sourcePromises.push(callWikiDump().then(async arr => await updateReply(arr, 'HTML')));
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
    timestamp?: number;
    src: string;}): string {
    const parts = [
        `${vi.name}:`,
        vi.link ? `[${vi.ver}](<${vi.link}>)` : vi.ver
    ];

    if (vi.timestamp) parts.push(`- ${ago(new Date().getTime() - vi.timestamp)}`);
    parts.push(`(${vi.src})`);
    return parts.join(' ');
}
