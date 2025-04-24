import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { wikt } from '../ute/wikt';
import { seaLang } from '../ute/sealang';

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
            ['SEAlang', () => seaLang('lao', word!)],
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