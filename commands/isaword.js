import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { domStroll } from '../ute/dom.js';
import { wonda } from '../ute/riða.js';
import parse from 'html-dom-parser';

export const data = new SlashCommandBuilder()
    .setName('isaword2')
    .setDescription('Check if a word is in the dictionary')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = isaword;

async function isaword(interaction) {
    await interaction.deferReply();

    const word = interaction.options.getString('word');

    const dictionaries = [
        ['American Heritage', ahd],
        ['Cambridge', cambridge],
        ['Chambers', chambers],
        //['Collins', collins],
        ['Longman', longman],
        ['Merriam-Webster', mw],
        ['Oxford Learners', oxfordLearners],
        ['Wiktionary', wikt],
        ['Urban Dictionary', urban],
    ];

    const results = await Promise.all(dictionaries.map(d => d[1](word)));

    try {
        const ins = dictionaries.filter((d, i) => results[i] === true).map((d, i) => d[0]);
        const notins = dictionaries.filter((d, i) => results[i] === false).map((d, i) => d[0]);
        const nulls = dictionaries.filter((d, i) => results[i] === null).map((d, i) => d[0]);
        console.log(`[ISAWORD] in: ${humanFriendlyListFormatter(ins)}`);
        console.log(`[ISAWORD] not in: ${humanFriendlyListFormatter(notins)}`);
        if (nulls.length !== 0) console.log(`[ISAWORD] null (error): ${humanFriendlyListFormatter(nulls)}`);

        if (ins.length === 0) await interaction.editReply(`No sign of '${word}' in any dictionary I checked!`);
        else if (ins.length === 1) await interaction.editReply(`Hmm '${word}' is in ${ins[0]}, but not in any other dictionary!`);
        else if (ins.length === dictionaries.length) await interaction.editReply(`'${word}' is in every dictionary I checked!`);
        else if (notins.length !== 0) await interaction.editReply(`'${word}' is in ${humanFriendlyListFormatter(ins)} but not in ${humanFriendlyListFormatter(notins, 'or')}`);
        // this last case should only happen if at least one dictionary returned null rather than true or false
        else await interaction.editReply(`'${word}' is in ${humanFriendlyListFormatter(ins)} at least...`);
    } catch (error) {
        console.error(`[ISAWORD]`, error);
    }
}

async function cambridge(word) {
    // https://dictionary.cambridge.org/dictionary/english/WORD
    const earl = new Earl('https://dictionary.cambridge.org', '/dictionary/english/');
    earl.setLastPathSegment(word);
    try {
        const status = (await fetch(earl.getUrlString(), { method: 'HEAD', redirect: 'manual' })).status;
        console.log(`[ISAWORD/cambridge] ${word} status: ${status}`);
        if (status === 302) return false;
        else if (status === 200) return true;
    } catch (error) {
        console.error(`[ISAWORD/cambridge]`, error);
    }
    return null;
}

// TODO doesn't check for cases like this when I search for 'wende':
// No exact matches for wende, but the following may be helpful.
// wend verb (wended, wending) archaic or literary to go or direct (one's course). wend one's way to go steadily and purposefully on a route or journey.
async function chambers(word) {
    // https://chambers.co.uk/search/?query=WORD&title=21st
    const earl = new Earl('https://chambers.co.uk', '/search/', {
        query: word,
        title: '21st'
    });
    try {
        const html = await earl.fetchText();
        const dom = parse(html);

        const message = domStroll('cham', false, dom, [
            [8, 'html'],
            [5, 'body', { cls: 'page-template-template-search-results' }],
            [7, 'div', { id: 'wrapper' }],
            [4, 'section', { id: 'content' }],
            [1, 'div', { cls: 'row' }],
            [1, 'div', { id: 'search-results' }],
            [8, 'div', { id: 'fullsearchresults' }],
            [0, 'p', { cls: 'message' }],
        ])

        // console.log(`[ISAWORD/chambers] ${word} status: div#fullsearchresults has ${fsr.children.length} children`);
        // 4 children: <p.message> <p> <p> <p> - means the word is in Chambers
        //   actually, it can have any number of <p> after the <p.message>
        // 1 child: <p.message> - means the word is not in Chambers
        // n? children: <p.message> - means the word is not in but it's offering suggestions
        //    message kids: #text <b> #text
        //    message.kids[0] === 'No exact matches for '
        // if (fsr.children.length === 1) return false;
        // else if (fsr.children.length > 1) return true;

        console.log(`[ISAWORD/chambers] ${word} status: p.message has ${message.children.length} children`);
        if (message.children.length === 1) return true;
        else if (message.children.length === 3) return false;
    } catch (error) {
        console.error(`[ISAWORD/chambers]`, error);
    }
    return null;
}

// we should probably use the new definition API since this returns true for stubs, redirects, common misspellings, foreign words
async function wikt(word) {
    // https://en.wiktionary.org/w/api.php?action=query&format=json&titles=WORD
    const wiktEarl = new Earl(`https://en.wiktionary.org`, '/w/api.php', {
        'action': 'query',
        'format': 'json',
        'titles': word
    });
    try {
        const data = await wiktEarl.fetchJson();

        if (Object.keys(data.query.pages).length === 1) {
            const page = Object.values(data.query.pages)[0];
            console.log(`[ISAWORD/enwikt] ${word} status: ${Object.keys(page)}`);
            if ('pageid' in page) return true;
            else if ('missing' in page) return false;
        }
    } catch (error) {
        console.error(`[ISAWORD/enwikt]`, error);
    }
    return null;
}

async function urban(word) {
    // https://api.urbandictionary.com/v0/define?term=WORD
    const earl = new Earl('https://api.urbandictionary.com', '/v0/define', {
        'term': word
    }
    );
    try {
        const data = await earl.fetchJson();
        console.log(`[ISAWORD/urban] ${word} status: ${data.list.length}`);
        if (data.list.length === 0) return false;
        else if (data.list.length > 0) return true;
    } catch (error) {
        console.error(`[ISAWORD/urban]`, error);
    }
    return null;
}

async function ahd(word) {
    // https://ahdictionary.com/word/search.html?q=WORD
    const earl = new Earl('https://ahdictionary.com', '/word/search.html', {
        'q': word
    });
    try {
        const dom = parse(await earl.fetchText());
        const results = domStroll('ahd', false, dom, [
            [0, 'html'],
            [1, 'body'],
            [3, 'div', { id: 'content' }],
            [2, 'div', { cls: 'container3' }],
            [1, 'div', { id: 'results' }],
        ]);

        // false:
        // [domStroll] ahd#5 #text
        // true:
        // [domStroll] ahd#5 <table> <hr> <span.copyright> #comment
        // [domStroll] ahd#5 <table> <hr> <span.copyright> #comment <table> <hr> <span.copyright> #comment
        if (results.children.length === 1 && results.children[0].type === 'text') return false;
        else if ([4, 8].includes(results.children.length) && results.children[0].type === 'tag' && results.children[0].name === 'table') return true;
        else {
            console.log(`[ISAWORD/ahd] ${word} div#results.children.length: ${results.children.length}`);
            console.log(`[ISAWORD/ahd] ${word} div#results.children[0].type: ${results.children[0].type}`);
            console.log(`[ISAWORD/ahd] ${word} div#results.children[0].name: ${results.children[0].name}`);
        }
    } catch (error) {
        console.error(`[ISAWORD/ahd]`, error);
    }
    return null;
}

async function oxfordLearners(word) {
    // https://www.oxfordlearnersdictionaries.com/definition/english/WORD
    const earl = new Earl('https://www.oxfordlearnersdictionaries.com', '/definition/english/' + word);
    try {
        const dom = parse(await earl.fetchText());
        const oxContainer = domStroll('ox', false, dom, [
            [2, 'html'],
            [3, 'body'],
            [1, 'div', { id: 'ox-container' }],
        ]);

        const xEnglish = domStroll('ox', false, oxContainer.children, [
            [5, 'div', { cls: 'xenglish', optional: true }],
        ]);

        if (xEnglish === null) {
            console.log(`[ISAWORD/oxlearn] ${word} no 'xenglish' class`);
            return false;
        }

        const webtop = domStroll('ox', false, xEnglish.children, [
            [3, 'div', { cls: 'responsive_row' }],
            [3, 'div', { cls: 'responsive_entry_center' }],
            [1, 'div', { cls: 'responsive_entry_center_wrap' }],
            [3, 'div', { id: 'ox-wrapper' }],            
            [1, 'div', { id: 'main_column' }],
            [1, 'div', { id: 'main-container' }],
            [5, 'div', { id: 'entryContent' }],
            [0, 'div'], // id will be WORD
            [0, 'div', { cls: 'top-container' }],
            [0, 'div'], // id will be 'WORD_topg_N' }],
            [0, 'div', { cls: 'webtop' }],
        ]);

        const [pid, pppid] = [webtop.parent.attribs.id, webtop.parent.parent.parent.attribs.id];
        console.log(`[ISAWORD/oxlearn] ${word} pid: '${pid}', pppid: '${pppid}'`);
        return true;
    } catch (error) {
        console.error(`[ISAWORD/oxlearn]`, error);
    }
    return null;
}

// TODO Collins seem to be entirely built by JavaScript
// async function collins(word) {
//     // https://www.collinsdictionary.com/dictionary/english/WORD
//     const earl = new Earl('https://www.collinsdictionary.com', '/dictionary/english/');
//     earl.setLastPathSegment(word);
//     try {
//         const dom = parse(await earl.fetchText());
//         // html
//         // body.definition
//         // main
//         // div#main_content
//         // div.res_cell_center
//         // div.dc res_cell_center_content
//         const resCellCenterContent = domStroll('coll', true, dom, [
//             [1, 'html'],
//             [1, 'body', { cls: 'definition' }],
//             [11, 'main'],
//             [7, 'div', { id: 'main_content' }],
//             [1, 'div', { cls: 'res_cell_center' }],
//             [1, 'div', { cls: 'dc res_cell_center_content' }],
//         ]);
//     } catch (error) {
//         console.error(`[ISAWORD/collins]`, error);
//     }
//     return null;
// }

async function mw(word) {
    // https://www.merriam-webster.com/dictionary/WORD
    const earl = new Earl('https://www.merriam-webster.com', '/dictionary/');
    earl.setLastPathSegment(word);
    try {
        const dom = parse(await earl.fetchText());
        const body = domStroll('mw', false, dom, [
            [2, 'html'],
            [3, 'body'],
        ]);
        const bodyClasses = body.attribs.class.trim().split(/ +/);
        console.log(`[ISAWORD/mw] ${word} body class: ${bodyClasses.map(x => `'.${x}'`).join(', ')}`);
        if (bodyClasses.includes('definitions-page'))
            return true;
        else
            return false;
    } catch (error) {
        console.error(`[ISAWORD/mw]`, error);
    }
    return null;
}

async function longman(word) {
    // https://www.ldoceonline.com/dictionary/definition
    const earl = new Earl('https://www.ldoceonline.com', '/dictionary/');
    earl.setLastPathSegment(word);
    try {
        const headHasMetadata = (domStroll('ld', false, parse(await earl.fetchText()), [
            [2, 'html'],
            [1, 'head', { cls: 'metadata', optional: true }],
        ]) !== null);

        console.log(`[ISAWORD/longman] ${word} <head> ${headHasMetadata ? 'has' : 'does not have'} .metadata class`);

        return headHasMetadata;
    } catch (error) {
        console.error(`[ISAWORD/longman]`, error);
    }
    return null;
}

function humanFriendlyListFormatter(arrayOfStrings, conj = 'and') {
    if (arrayOfStrings.length === 0) return '';
    else if (arrayOfStrings.length === 1) return arrayOfStrings[0];
    else if (arrayOfStrings.length === 2) return `${arrayOfStrings[0]} ${conj} ${arrayOfStrings[1]}`;
    else return `${arrayOfStrings.slice(0, -1).join(', ')}, ${conj} ${arrayOfStrings[arrayOfStrings.length - 1]}`;
}