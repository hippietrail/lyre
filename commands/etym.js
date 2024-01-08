import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import parse from 'html-dom-parser';

export const data = new SlashCommandBuilder()
    .setName('etym')
    .setDescription('Check if a word in in Etymonline')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = etym;

async function etym(interaction) {
    await interaction.deferReply();
    try {
        const earl = new Earl('https://etymonline.com', '/word/');
        const word = interaction.options.getString('word');
        earl.setLastPathSegment(word);
        const dom = parse(await earl.fetchText());

        const html = dom[3];
        if (!html || html.type !== 'tag' || html.name !== 'html')
            throw new Error('html not found');
        const body = html.children[3];
        if (!body || body.type !== 'tag' || body.name !== 'body')
            throw new Error('body not found');
        const root = body.children[1];
        if (!root || root.type !== 'tag' || root.name !== 'div' || root.attribs?.id !== 'root')
            throw new Error('root not found');
        const reactRoot = root.children[0];
        if (!reactRoot || reactRoot.type !== 'tag' || reactRoot.name !== 'div' || !('data-reactroot' in reactRoot.attribs))
            throw new Error('reactRoot not found');
        const container1mazc = reactRoot.children[0];
        if (!container1mazc || container1mazc.type !== 'tag' || container1mazc.name !== 'div' || !container1mazc.attribs?.class?.includes('container--1mazc'))
            throw new Error('container1mazc not found');
        const main = container1mazc.children[1];
        if (!main || main.type !== 'tag' || main.name !== 'div' || !('data-role' in main.attribs) || main.attribs['data-role'] !== 'content-main')
            throw new Error('contnet-main not found');
        const antRow = main.children[0];
        if (!antRow || antRow.type !== 'tag' || antRow.name !== 'div' || !antRow.attribs?.class?.startsWith('ant-row'))
            throw new Error('ant-row not found');
        const lg17 = antRow.children[0];
        if (!lg17 || lg17.type !== 'tag' || lg17.name !== 'div' || !lg17.attribs?.class?.includes('ant-col-lg-17'))
            throw new Error('ant-col-lg-17 not found');

        // if the children are [h2, p, p] then the word is not in etymonline
        if (lg17.children[0].name === 'h2' && lg17.children[1].name === 'p' && lg17.children[2].name === 'p') {
            await interaction.editReply('Not in Etymonline');
        } else {
            const wordNodes = lg17.children.filter(node => node.name === 'div' && node.attribs?.class?.includes('word--C9UPa'));

            let reply = `[there are ${wordNodes.length} word sections.](${earl.getUrlString()})`;

            const words = [...new Set(wordNodes
                .map(node => node.children[0].children[0])
                .map(node => node.children.find(child => child.attribs?.class?.includes('word__name--TTbAA')))
                .map(node => node.children[0].data))];

            // is at least one of the words a case-insensitive match?
            if (words.some(w => w.toLowerCase() === word.toLowerCase())) {
                if (words.length === 1) {
                    reply += `\n'${words[0]}' matches '${word}.`;
                } else {
                    reply += `\nat least one of ${words.map(node => `'${node}'`).join(', ')} matches '${word}.`;
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
