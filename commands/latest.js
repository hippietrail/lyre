import { SlashCommandBuilder } from 'discord.js';
import { ago } from '../ute/ago.js';
import { callGithubReleases } from './latest/githubreleases.js';
import { callGithubTags } from './latest/githubtags.js';
import { callWikiDump } from './latest/wikidump.js';
import { callGo, callRvm, callAS, callElixir, callRuby, callIdea } from './latest/htmlsources.js';
import { callNodejs, callGimp, callXcode, callMame, callDart, callPhp } from './latest/jsonsources.js';
export const data = new SlashCommandBuilder()
    .setName('latest')
    .setDescription('Latest releases of various projects')
        .addBooleanOption(option => option
            .setName('sortbyage')
            .setDescription('Sort by most recent first')
            .setRequired(true));

export const execute = latest;

// TODO
// C standard?
// C++ standard?
// C#
// EcmaScript standard?
// Erlang
// gcc
// Groovy
// Haskell
// Java/JDK/JVM?
// Julia
// Objective C? on GitHub tags only apple-oss-distributions/objc4
// Scala
// Unicode
//  CLDR
//  ICU
//  ICU4X
// Vim

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
                .map(vi => versionInfoToString(vi))
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

        const githubPromises = callGithubReleases(false)
            .then(async arr => await reply(arr, 'GitHub', 'non-GitHub'));

        const otherPromises = Promise.all([
            //callNodejs(), // JSON - just use the GitHub one for now, which has link
            callGimp(),     // JSON
            callXcode(),    // JSON
            callGithubTags(false),
            callGo(),       // scraper
            //callMame(),   // JSON - just use the GitHub one for now, which has link and date
            callDart(),     // JSON
            callRvm(),      // scraper
            callAS(),       // scraper
            callElixir(),   // scraper
            callPhp(),      // JSON
            callRuby(),     // scraper
            callIdea(),     // scraper
            callWikiDump(), // scraper
        ]).then(async arr => await reply(arr, 'Non-GitHub', 'GitHub'));

        await Promise.all([githubPromises, otherPromises]);
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
function versionInfoToString(vi) {
    const parts = [
        `${vi.name}:`,
        vi.link ? `[${vi.ver}](<${vi.link}>)` : vi.ver
    ];

    if (vi.timestamp) parts.push(`- ${ago(new Date() - vi.timestamp)}`);
    parts.push(`(${vi.src})`);
    return parts.join(' ');
}
