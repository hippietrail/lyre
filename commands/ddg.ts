//@ts-nocheck
import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { domStroll } from '../ute/dom.js';
import parse from 'html-dom-parser';

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
        )
    );

export const execute = ddg;

async function ddg(interaction) {
    await interaction.deferReply();
    const ddgEarl = new Earl('https://deepdreamgenerator.com/');
    const list = interaction.options.getString('list');

    if (list !== 'trending')
        ddgEarl.setLastPathSegment(list);

    let reply = 'ya broke it!!';
    try {
        const dom = await ddgEarl.fetchDom();
        const htmlIndex = dom.findIndex(child => child.name === 'html');
        const feedIndex = ['trending', 'best/editor-choice'].includes(list) ? 11 : 9;

        console.log(`html index: ${htmlIndex} list: '${list}' feed index: ${feedIndex}`);

        const img = domStroll('ddg', false, dom, [
            [htmlIndex, 'html'],
            [3, 'body', { cls: 'inner-page' }],     // .not-logged-in.inner-page 6
            [9, 'div', { cls: 'pageContent' }],     // .pageContent 6.3
            [1, 'div', { cls: 'pageWrap' }],        // .pageWrap 6.3.9
            [1, 'div', { cls: 'container' }],       // .container 6.3.9.1
            [feedIndex, 'div', { cls: 'feed' }],    // .feed.light-gallery.ddg-load-later 6.3.9.1.1
            [1, 'div', { cls: 'feed-object' }],     // .row.feed-object 6.3.9.1.1.11.1
            [1, 'div', { cls: 'col-lg-12' }],       // .col-lg-12 6.3.9.1.1.11.1.1
            [1, 'div', { cls: 'content' }],         // .content.full-format. 6.3.9.1.1.11.1.1.1
            [1, 'div', { cls: 'image-wrapper' }],   // .image-wrapper 6.3.9.1.1.11.1.1.1.1
            [1, 'img'],                             // .light-gallery-item.fi3vw1gottu.thumb.img-responsive 6.3.9.1.1.11.1.1.1.1.1
        ]);

        if ('data-sub-html' in img.attribs) {
            try {
                const dom = parse(img.attribs['data-sub-html']);
                const a = dom[0];

                reply = `[${list}](${a.attribs.href})`
            } catch (error) {
                console.error(`[DDG] error parsing data-sub-html`, error);
            }
        }
    } catch (error) {
        console.error('[DDG]', error);
    }
    await interaction.editReply(reply);
}
