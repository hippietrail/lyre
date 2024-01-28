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
        ['Cambridge', cambridge],
        ['Chambers', chambers],
        ['Wiktionary', wikt],
    ];

    // let's put the promise for each in element [2] and the result of each in element [3] of the dictionaries tuple
    const proms = dictionaries.map(d => d[1](word));
    const results = await Promise.all(proms);

    try {
        const ins = dictionaries.filter((d, i) => results[i] === true).map((d, i) => d[0]);
        const notins = dictionaries.filter((d, i) => results[i] === false).map((d, i) => d[0]);
        const nulls = dictionaries.filter((d, i) => results[i] === null).map((d, i) => d[0]);
        console.log(`[ISAWORD] in ${ins.join(', ')}`);
        console.log(`[ISAWORD] not in ${notins.join(', ')}`);
        console.log(`[ISAWORD] null (error): ${nulls.join(', ')}`);

        if (ins.length === 0) await interaction.editReply(`No sign of '${word}' in any dictionary I checked!`);
        else if (ins.length === 1) await interaction.editReply(`Hmm '${word}' is in ${ins[0]}, but not in any other dictionary!`);
        else if (ins.length === dictionaries.length) await interaction.editReply(`'${word}' is in every dictionary I checked!`);
        else if (notins.length !== 0) await interaction.editReply(`'${word}' is in ${humanFriendlyListFormatter(ins)} but not in ${humanFriendlyListFormatter(notins)}`);
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

async function chambers(word) {
    // https://chambers.co.uk/search/?query=WORD&title=21st
    const earl = new Earl('https://chambers.co.uk', '/search/', {
        query: word,
        title: '21st'
    });
    try {
        const html = await earl.fetchText();
        const dom = parse(html);

        const fsr = domStroll('cham', false, dom, [
            [8, 'html'],
            [5, 'body', { cls: 'page-template-template-search-results' }],
            [7, 'div', { id: 'wrapper' }],
            [4, 'section', { id: 'content' }],
            [1, 'div', { cls: 'row' }],
            [1, 'div', { id: 'search-results' }],
            [8, 'div', { id: 'fullsearchresults' }],
        ])

        console.log(`[ISAWORD/chambers] ${word} status: div#fullsearchresults has ${fsr.children.length} children`);
        // 4 children: <p.message> <p> <p> <p> - means the word is in Chambers
        //   actually, it can have any number of <p> after the <p.message>
        // 1 child: <p.message> - means the word is not in Chambers
        if (fsr.children.length === 1) return false;
        else if (fsr.children.length > 1) return true;
    } catch (error) {
        console.error(`[ISAWORD/chambers]`, error);
    }
    return null;
}

// we should probably use the new definition API since this returns true for stubs, redirects, common misspellings, foreign words
async function wikt(word) {
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

function humanFriendlyListFormatter(arrayOfStrings) {
    if (arrayOfStrings.length === 0) return '';
    else if (arrayOfStrings.length === 1) return arrayOfStrings[0];
    else if (arrayOfStrings.length === 2) return `${arrayOfStrings[0]} and ${arrayOfStrings[1]}`;
    else return `${arrayOfStrings.slice(0, -1).join(', ')}, and ${arrayOfStrings[arrayOfStrings.length - 1]}`;
}