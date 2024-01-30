import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { domStroll } from '../ute/dom.js';

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

        const content = domStroll('ddg', false, dom, [
            [htmlIndex, 'html'],
            [3, 'body', { cls: 'inner-page' }],         // .not-logged-in.inner-page 6
            [9, 'div', { cls: 'pageContent' }],         // .pageContent 6.3
            [1, 'div', { cls: 'pageWrap' }],            // .pageWrap 6.3.9
            [1, 'div', { cls: 'container' }],           // .container 6.3.9.1
            [feedIndex, 'div', { cls: 'feed' }],        // .feed.light-gallery.ddg-load-later 6.3.9.1.1
            [1, 'div', { cls: 'feed-object' }],         // .row.feed-object 6.3.9.1.1.11.1
            [1, 'div', { cls: 'col-lg-12' }],           // .col-lg-12 6.3.9.1.1.11.1.1
            [1, 'div', { cls: 'content' }],             // .content.full-format. 6.3.9.1.1.11.1.1.1
        ]);

        const [img, promptInfo] = [
            domStroll('ddg', false, content.children, [
                [1, 'div', { cls: 'image-wrapper' }],   // .image-wrapper 6.3.9.1.1.11.1.1.1.1
                [1, 'img'],                             // .light-gallery-item.fi3vw1gottu.thumb.img-responsive 6.3.9.1.1.11.1.1.1.1.1
            ]),
            domStroll('ddg', false, content.children, [
                [3, 'div', { cls: 'prompt-info' }],
            ]),
        ];

        const prompt = promptInfo.children[promptInfo.children.length - 3].data.trim();

        // NOTE discord refuses to show both the text and the image unless there is text outside the markdown, and it can't be whitespace
        // TODO the image will be displayed if it has ?v=1 or ?v=2 at the end but not otherwise
        reply = `${list}: [${prompt}](${img.attribs.src}${
            img.attribs.src.endsWith('?v=1') || img.attribs.src.endsWith('?v=2') ? '' : '?v=0'
        })`;
    } catch (error) {
        console.error('[DDG]', error);
    }
    await interaction.editReply(reply);
}
