import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';

export const data = new SlashCommandBuilder()
    .setName('ddg')
    .setDescription('Shows the top image from Deep Dream Generator')
    .addStringOption(option => option
        .setName('list')
        .setDescription('from which list?')
        .setRequired(true)
        .addChoices(
            { name: 'trending', value: 'trending' },
            { name: 'latest', value: 'latest' },
            { name: 'best/today', value: 'best/today' },
            { name: 'best/week', value: 'best/week' },
            { name: 'best/month', value: 'best/month' },
            { name: 'best/year', value: 'best/year' },
            { name: 'best/editor-choice', value: 'best/editor-choice' },
            { name: 'videos', value: 'videos' },
        )
    )
    .addIntegerOption(option => option
        .setName('index')
        .setDescription('image index')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(29)
    );    

export const execute = ddg;

async function ddg(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const ddgEarl = new Earl('https://deepdreamgenerator.com/');
    const listOpt = interaction.options.getString('list')!;
    const indexOpt = interaction.options.getInteger('index') ?? 0;

    if (listOpt !== 'trending')
        ddgEarl.setLastPathSegment(listOpt);

    let reply = 'ya broke it!!';
    try {
        const dom = await ddgEarl.fetchDom();
        const htmlIndex = dom.findIndex(child => child.name === 'html');
        const feedIndex = ['trending', 'best/editor-choice'].includes(listOpt) ? 11 : 9;

        console.log(`html index: ${htmlIndex} list: '${listOpt}' feed index: ${feedIndex}`);
        console.log(`user chosen index: ${indexOpt}`);

        const feed = domStroll('ddg', false, dom, [
            [htmlIndex, 'html'],
            [3, 'body', { cls: 'inner-page' }],     // .not-logged-in.inner-page 6
            [9, 'div', { cls: 'pageContent' }],     // .pageContent 6.3
            [1, 'div', { cls: 'pageWrap' }],        // .pageWrap 6.3.9
            [1, 'div', { cls: 'container' }],       // .container 6.3.9.1
            [feedIndex, 'div', { cls: 'feed' }],    // .feed.light-gallery.ddg-load-later 6.3.9.1.1
        ])!;

        const numIndices = (feed.children!.length - 1) / 2;
        if (indexOpt >= numIndices) {
            await interaction.editReply(`that index is too big, max is ${numIndices - 1}`);
            return;
        }

        const feedDreamTitle = domStroll('ddg', false, feed.children!, [
            [indexOpt * 2 + 1, 'div', { cls: 'feed-object' }],  // .row.feed-object 6.3.9.1.1.11.1
            [1, 'div', { cls: 'col-lg-12' }],                   // .col-lg-12 6.3.9.1.1.11.1.1
            [1, 'div', { cls: 'content' }],                     // .content.full-format. 6.3.9.1.1.11.1.1.1
            [3, 'div', { cls: 'prompt-info'}],
            [3, 'a', { cls: 'feed-dream-title'}],
        ])!;

        reply = `[${listOpt}](${feedDreamTitle.attribs!.href})`;
    } catch (error) {
        console.error('[DDG]', error);
    }
    await interaction.editReply(reply);
}
