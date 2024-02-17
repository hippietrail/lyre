import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';
import { wikt } from '../ute/wikt';
import { seaLang } from '../ute/sealang';

export const data = new SlashCommandBuilder()
    .setName('thai')
    .setDescription('Check for a Thai word in thai-language.com and SEAlang')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = thai;

async function thai(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word');

        type DictTuple = [string, (word: string) => Promise<number | null>];

        const replies = await Promise.all(([
            ['thaiLang', thaiLanguage],
            ['SEAlang', () => seaLang('thai', word!)],
            ['enwiktionary', () => wikt('en', word!)],
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

// the normal search on thai-language.com uses HTTP POST and converting naïvely to GET
// doesn't work. But it turns out the advanced search has an XML prefix search!
async function thaiLanguage(word: string) {
    // http://www.thai-language.com/xml/PrefixSearch?input=%E0%B8%99%E0%B8%B2
    const thaiLangEarl = new Earl('http://www.thai-language.com', '/xml/PrefixSearch', {
        input: word,
    });
    console.log(`thaiLangEarl: ${thaiLangEarl.getUrlString()}`);

    const results = domStroll('thailang', false, await thaiLangEarl.fetchDom(), [
        [1, 'tl-xml-response'],
        [0, 'results'],
    ])!;

    // count the number of results whose 't' matches 'word'
    const matchingResults = results.children!.filter(result => {
        if (result.name === 'result' && result.children!.length > 0 && result.children![0].name === 't') {
            return result.children![0].children![0].data === word;
        }
    });

    const count = matchingResults.length;
    return count;
}
