import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';

export const data = new SlashCommandBuilder()
    .setName('etym')
    .setDescription('Check if a word in in Etymonline')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = etym;

async function etym(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const earl = new Earl('https://etymonline.com', '/word/');
        const word = interaction.options.getString('word');
        earl.setLastPathSegment(word!);

        const lg17 = domStroll('etym', false, await earl.fetchDom(), [
            [3, 'html'],
            [3, 'body'],
            [1, 'div', { id: 'root' }],
            [0, 'div'],                                 // TODO: 'data-role' attribute - add att feature to domStroll opts?
            [0, 'div', { cls: 'container--1mazc' }],
            [1, 'div', { cls: 'main' }],                // TODO: attK: 'data-role', attV: 'content-main'
            [0, 'div', { cls: 'ant-row-flex' }],
            [0, 'div', { cls: 'ant-col-lg-17' }],
        ])!;

        // if the children are [h2, p, p] then the word is not in etymonline
        if (['h2', 'p', 'p'].every((tagName, i) => lg17.children![i].name === tagName)) {
            await interaction.editReply('Not in Etymonline');
        } else {
            const wordNodes = lg17.children!.filter(node => node.name === 'div' && node.attribs?.class?.includes('word--C9UPa'));

            const [verb, suffix] = wordNodes.length === 1 ? ['is', ''] : ['are', 's'];
            let reply = `[there ${verb} ${wordNodes.length} word section${suffix}.](${earl.getUrlString()})`;

            const words = [...new Set(wordNodes
                .map(node => node.children![0].children![0])
                .map(node => node.children!.find(child => child.attribs?.class?.includes('word__name--TTbAA')))
                .map(node => node!.children![0].data))];

            // is at least one of the words a case-insensitive match?
            if (words.some(w => w!.toLowerCase() === word!.toLowerCase())) {
                if (words.length !== 1) {
                    reply += `\nat least one of ${words.map(node => `'${node}'`).join(', ')} matches '${word}'.`;
                }
            } else {
                if (words.length === 1) {
                    reply += `\nbut '${words[0]}' does not match '${word}'!`;
                } else {
                    reply += `\nbut none of ${words.map(node => `'${node}'`).join(', ')} match '${word}'!`;
                }
            }

            await interaction.editReply(reply);
        }
    } catch (e) {
        console.error(e);
        await interaction.editReply('An error occurred while fetching data.');
    }
}  
