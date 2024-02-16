import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';
import { wikt } from '../ute/wikt';

export const data = new SlashCommandBuilder()
    .setName('lao')
    .setDescription('Check for a Lao word in and SEAlang and Wiktionary')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = lao;

async function lao(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word');

        type DictTuple = [string, (word: string) => Promise<number | null>];

        const replies = await Promise.all(([
            ['SEAlang', seaLang],
            ['enwiktionary', () => wikt('en', word!)],
            ['lowiktionary', () => wikt('lo', word!)],
            ['thwiktionary', () => wikt('th', word!)],
        ] as Array<DictTuple>).map(async ([name, func]) => {
            const reply = await func(word!);
            return reply !== null
                ? `${name}: ${reply} results.`
                : `${name}: error.`
        }));
        
        await interaction.editReply(replies.join('\n'));
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}

// SEAlang uses a self-signed certificate that throws an exception by default in fetch()
// So we turn off the NODE_TLS_REJECT_UNAUTHORIZED environment variable before and make
// sure we turn it back on afterwards no matter if the request succeeds, fails, or an exception is thrown
async function seaLang(word: string) {
    const seaEarl = new Earl('https://sealang.net', '/lao/search.pl', {
        'dict': 'lao',
        'hasFocus': 'orth',         // def, orth, phone
        'approx': '',
        'orth': word,
        'phone': '',
        'def': '',
        //'filedata': '',
        'matchEntry': 'any',
        'matchLength': 'word',      // syllable, whole, word
        'matchPosition': 'any',
        'anon': 'on',
        'ety': '',                  // Burmese, ...
        'pos': '',                  // C, ...
        'usage': '',                // imitative, ...
        'useTags': '1',
        'derivatives': 'always',    // never, ...
        'hyphenateSyls': '0',
        'redundantData': '0',
    });

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const dom = await (async () => {
        try {
            return await seaEarl.fetchDom();
        } catch (error) {
            console.error(`[LAO/sealang] ${word}:`, error);
            return null;
        }
    })();

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    if (dom) {
        const body = domStroll('sea', false, dom, [
            [4, 'html'],
            [3, 'body'],
        ])!;

        if (4 in body.children! && body.children[4].type === 'text') {
            const lines = body.children![4].data!.trim().split('\n');

            if (lines.length > 0) {
                const matt = lines[0].trim().match(/^(Nothing|(\d+) items?) found/);

                if (matt) {
                    if (matt[1] === 'Nothing') return 0;
                    return Number(matt[2]);
                }
            }
        }
    }
    return null;
}
