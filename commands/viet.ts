import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { wikt } from '../ute/wikt';
import { seaLang } from '../ute/sealang';

export const data = new SlashCommandBuilder()
    .setName('viet')
    .setDescription('Check for a Vietnamese word in and SEAlang and Wiktionary')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = viet;

async function viet(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word');

        type DictTuple = [string, (word: string) => Promise<number | null>];

        const replies = await Promise.all(([
            ['SEAlang', () => seaLang('vietnamese', word!)],
            ['enwiktionary', () => wikt('en', word!)],
            ['viwiktionary', () => wikt('vi', word!)],
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