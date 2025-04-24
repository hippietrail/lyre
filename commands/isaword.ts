import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { type DomNode, domStroll } from '../ute/dom';
import { humanFriendlyListFormatter } from '../ute/amis';
import { wikt } from '../ute/wikt';
import { etym } from '../ute/etym';

export const data = new SlashCommandBuilder()
    .setName('isaword2')
    .setDescription('Check if a word is in the dictionary')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = isaword;

async function isaword(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const word = interaction.options.getString('word');

    interface Dict {
        0: string;
        1: (word: string) => Promise<boolean | null>;
        2: boolean;
    }

    // schema: [name: string, func: (word: string) => boolean | null, anyoneCanContribute: boolean]
    const dictionaries: Dict[] = [
        // dictionaries that are professionally maintained, alphabetical order
        ['American Heritage', ahd, false],
        ['Cambridge', cambridge, false],
        ['Chambers', chambers, false],
        //['Collins', collins, false],
        ['Dictionary.com', dictCom, false],
        ['Etymonline', etymonline, false],
        ['Longman', longman, false],
        ['Merriam-Webster', mw, false],
        ['OED', oed, false],
        ['Oxford Learners', oxfordLearners, false],
        //['Scrabble', scrabble, false],
        ['Wordnet', wordNet, false],
        ['Wordnik', wordnik, false],

        // dictionaries that anyone can contribute to, in order of trustworthiness
        ['Wiktionary', (w) => wikt('en', w).then(w => w === 0 ? false : w === 1 ? true : null), true],
        ['Urban Dictionary', urban, true],
    ];

    const results = await Promise.all(dictionaries.map(d => d[1](word!)));

    try {
        const ins = dictionaries.filter((d, i) => results[i] === true).map((d, i) => d[0]);
        const notins = dictionaries.filter((d, i) => results[i] === false).map((d, i) => d[0]);
        const nulls = dictionaries.filter((d, i) => results[i] === null).map((d, i) => d[0]);
        
        const communityDictCount = dictionaries.filter((d, i) => d[2] && results[i] === true).map((d, i) => d[0]).length;
        const proDictCount = dictionaries.filter((d, i) => !d[2] && results[i] === true).map((d, i) => d[0]).length;

        console.log(`[ISAWORD] in: ${ins.length === 0 ? 'none' : humanFriendlyListFormatter(ins)}`);
        if (ins.length !== 0) console.log(`[ISAWORD] in ${proDictCount} professional dictionaries vs ${communityDictCount} community dictionaries`);
        if (notins.length !== 0) console.log(`[ISAWORD] not in: ${humanFriendlyListFormatter(notins)}`);
        if (nulls.length !== 0) console.log(`[ISAWORD] null: ${humanFriendlyListFormatter(nulls)}`);

        if (ins.length === 0) await interaction.editReply(`No sign of '${word}' in any dictionary I checked!`);
        else if (ins.length === dictionaries.length) await interaction.editReply(`'${word}' is in every dictionary I checked!`);

        // it's only in one dictionary
        else if (ins.length === 1) {
            if (proDictCount === 0) await interaction.editReply(`'${word}' is only in ${ins[0]}, not in any professionally edited dictionary!`);
            else await interaction.editReply(`Hmm '${word}' is in ${ins[0]}, but not in any other dictionary!`);
        }

        // it's in multiple dictionaries, but not all of them (or some returned errors)
        else {
            if (communityDictCount === ins.length) await interaction.editReply(`'${word}' is only in ${humanFriendlyListFormatter(ins)} but not in any professionally edited dictionary!`);
            else if (notins.length !== 0) await interaction.editReply(`'${word}' is in ${humanFriendlyListFormatter(ins)} but not in ${humanFriendlyListFormatter(notins, 'or')}`);
            // this last case should only happen if at least one dictionary returned null rather than true or false
            else await interaction.editReply(`'${word}' is in ${humanFriendlyListFormatter(ins)} at least...`);
        }
    } catch (error) {
        console.error(`[ISAWORD]`, error);
    }
}

// TODO sometimes returns 502 (bad gateway)
async function cambridge(word: string) {
    // https://dictionary.cambridge.org/dictionary/english/WORD
    const earl = new Earl('https://dictionary.cambridge.org', '/dictionary/english/');
    earl.setLastPathSegment(word);
    try {
        return !await earl.checkRedirect();
    } catch (error) {
        console.error(`[ISAWORD/cambridge]`, error);
    }
    return null;
}

async function chambers(word: string) {
    // https://chambers.co.uk/search/?query=WORD&title=21st
    const earl = new Earl('https://chambers.co.uk', '/search/', {
        query: word,
        title: '21st'
    });
    try {
        const message = domStroll('cham', false, await earl.fetchDom(), [
            [8, 'html'],
            [5, 'body', { cls: 'page-template-template-search-results' }],
            [7, 'div', { id: 'wrapper' }],
            [4, 'section', { id: 'content' }],
            [1, 'div', { cls: 'row' }],
            [1, 'div', { id: 'search-results' }],
            [8, 'div', { id: 'fullsearchresults' }],
            [0, 'p', { cls: 'message' }],
        ])!;

        console.log(`[ISAWORD/chambers] ${word} status: p.message has ${message.children!.length} children`);

        if (message.children!.length === 1) return true;
        else if (message.children!.length === 3) return false;
    } catch (error) {
        console.error(`[ISAWORD/chambers]`, error);
    }
    return null;
}

interface UrbanDictApiJson {
    list: [],
};

async function urban(word: string) {
    // https://api.urbandictionary.com/v0/define?term=WORD
    const earl = new Earl('https://api.urbandictionary.com', '/v0/define', {
        'term': word
    }
    );
    try {
        const data: UrbanDictApiJson = await earl.fetchJson() as UrbanDictApiJson;
        console.log(`[ISAWORD/urban] ${word} status: ${data.list.length}`);
        if (data.list.length === 0) return false;
        else if (data.list.length > 0) return true;
    } catch (error) {
        console.error(`[ISAWORD/urban]`, error);
    }
    return null;
}

async function ahd(word: string) {
    // https://ahdictionary.com/word/search.html?q=WORD
    const earl = new Earl('https://ahdictionary.com', '/word/search.html', {
        'q': word
    });
    try {
        const results = domStroll('ahd', false, await earl.fetchDom(), [
            [0, 'html'],
            [1, 'body'],
            [3, 'div', { id: 'content' }],
            [2, 'div', { cls: 'container3' }],
            [1, 'div', { id: 'results' }],
        ])!;

        // false:
        // [domStroll] ahd#5 #text
        // true:
        // [domStroll] ahd#5 <table> <hr> <span.copyright> #comment
        // [domStroll] ahd#5 <table> <hr> <span.copyright> #comment <table> <hr> <span.copyright> #comment
        if (results.children!.length === 1 && results.children![0].type === 'text') return false;
        else if (results.children!.length % 4 === 0 && results.children![0].type === 'tag' && results.children![0].name === 'table') return true;
        else {
            console.log(`[ISAWORD/ahd] ${word} div#results.children.length: ${results.children!.length}`);
            console.log(`[ISAWORD/ahd] ${word} div#results.children[0].type: ${results.children![0].type}`);
            console.log(`[ISAWORD/ahd] ${word} div#results.children[0].name: ${results.children![0].name}`);
        }
    } catch (error) {
        console.error(`[ISAWORD/ahd]`, error);
    }
    return null;
}

async function oxfordLearners(word: string) {
    // https://www.oxfordlearnersdictionaries.com/definition/english/WORD
    const earl = new Earl('https://www.oxfordlearnersdictionaries.com', '/definition/english/' + word);
    try {
        const oxContainer = domStroll('ox', false, await earl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [1, 'div', { id: 'ox-container' }],
        ])!;

        const xEnglish = domStroll('ox', false, oxContainer.children!, [
            [5, 'div', { cls: 'xenglish', optional: true }],
        ]);

        if (xEnglish === null) {
            console.log(`[ISAWORD/oxlearn] ${word} no 'xenglish' class`);
            return false;
        }

        const webtop = domStroll('ox', false, xEnglish.children!, [
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
        ])!;

        const [pid, pppid] = [webtop.parent.attribs!.id, webtop.parent.parent.parent.attribs!.id];
        console.log(`[ISAWORD/oxlearn] ${word} pid: '${pid}', pppid: '${pppid}'`);
        return true;
    } catch (error) {
        console.error(`[ISAWORD/oxlearn]`, error);
    }
    return null;
}

// TODO Collins seem to be entirely built by JavaScript
// async function collins(word: string) {
//     // https://www.collinsdictionary.com/dictionary/english/WORD
//     const earl = new Earl('https://www.collinsdictionary.com', '/dictionary/english/');
//     earl.setLastPathSegment(word);
//     try {
//         const resCellCenterContent = domStroll('coll', true, await earl.fetchDom(), [
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

async function mw(word: string) {
    // https://www.merriam-webster.com/dictionary/WORD
    const earl = new Earl('https://www.merriam-webster.com', '/dictionary/');
    earl.setLastPathSegment(word);
    try {
        const body = domStroll('mw', false, await earl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
        ])!;

        const bodyClasses: string[] = body.attribs!.class!.trim().split(/ +/);
        console.log(`[ISAWORD/mw] ${word} body class: ${bodyClasses.map(x => `'.${x}'`).join(', ')}`);

        if (bodyClasses.includes('definitions-page')) {
            // check for partial matches, they lack the 'redesign-container' div
            const maybeRedesignContainer = domStroll('mw', false, body.children!, [
                [17, 'div', { cls: 'outer-container' }],
                [1, 'div', { cls: 'main-container' }],
                [3, 'div', { cls: 'redesign-container', optional: true }],
            ]);

            console.log(`[ISAWORD/mw] ${word} maybeRedesignContainer: ${maybeRedesignContainer ? 'exists' : 'does not exist'}`);

            return maybeRedesignContainer !== null;
        } else {
            return false;
        }
    } catch (error) {
        console.error(`[ISAWORD/mw]`, error);
    }
    return null;
}

async function longman(word: string) {
    // https://www.ldoceonline.com/dictionary/definition
    const earl = new Earl('https://www.ldoceonline.com', '/dictionary/');
    earl.setLastPathSegment(word);
    try {
        const headHasMetadata = (domStroll('ld', false, await earl.fetchDom(), [
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

// async function scrabble(word: string) {
//     // https://scrabblechecker.collinsdictionary.com/check/api/index.php?key=WORD&isFriendly=1&nocache=1706498554793
//     const earl = new Earl('https://scrabblechecker.collinsdictionary.com', '/check/api/index.php', {
//         'key': word,
//         'isFriendly': '1',
//         'nocache': new Date().getTime().toString()
//     });
//     try {
//         const randomUserAgents = [
//             'Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/19B74 [FBAN/FBIOS;FBAV/343.1.0.53.117;FBBV/330408024;FBDV/iPhone12,5;FBMD/iPhone;FBSN/iOS;FBSV/15.1;FBSS/3;FBID/phone;FBLC/it_IT;FBOP/5;FBRV/331379382]',
//             'Mozilla/5.0 (Linux; Android 10; Infinix X657B Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.99 Mobile Safari/537.36 trill_2022009030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/20.9.3 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/RU BytedanceWebview/d8a21c6',
//             'Mozilla/5.0 (Linux; Android 10; M2006C3LI Build/QP1A.190711.020; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/94.0.4606.71 Mobile Safari/537.36 trill_2022107060 JsSdk/1.0 NetType/4G Channel/googleplay AppName/musical_ly app_version/21.7.6 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/KG BytedanceWebview/d8a21c6',
//             'Mozilla/5.0 (Linux; Android 11; RMX2002 Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/90.0.4430.210 Mobile Safari/537.36 trill_2022106050 JsSdk/1.0 NetType/MOBILE Channel/googleplay AppName/musical_ly app_version/21.6.5 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/RU BytedanceWebview/d8a21c6',
//             'Mozilla/5.0 (Linux; Android 11; SM-A025F Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.120 Mobile Safari/537.36 trill_2022102050 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/21.2.5 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/KZ BytedanceWebview/d8a21c6',
//             'Mozilla/5.0 (Linux; Android 11; SM-A105F Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/89.0.4389.90 Safari/537.36 trill_2022109040 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/21.9.4 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/RU BytedanceWebview/d8a21c6',
//             'Mozilla/5.0 (Linux; Android 11; SM-A505FM Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36 trill_220001 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musically_go app_version/22.0.1 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/RU',
//             'Mozilla/5.0 (Linux; Android 11; vivo 1906 Build/RP1A.200720.012; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36 trill_2022106050 JsSdk/1.0 NetType/WIFI Channel/vivoglobal_int AppName/musical_ly app_version/21.6.5 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/RU BytedanceWebview/d8a21c6',
//             'Mozilla/5.0 (Linux; Android 6.0.1; VFD 600) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Mobile Safari/537.36',
//             'Mozilla/5.0 (Linux; Android 6.0.1; VFD 600) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Mobile Safari/537.36',
//             'Mozilla/5.0 (Linux; Android 8.1.0; CPH1909 Build/O11019; wv) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.50 Mobile Safari/537.36',
//             'Mozilla/5.0 (Linux; Android 8.1.0; CPH1909 Build/O11019; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36 trill_2022109040 JsSdk/1.0 NetType/4G Channel/googleplay AppName/musical_ly app_version/21.9.4 ByteLocale/ru-RU ByteFullLocale/ru-RU Region/KZ BytedanceWebview/d8a21c6',
//             'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//             'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//         ];

//         const initOptions = Math.random() > 0.5 ? {
//             headers: new Headers({
//                 Accept: 'application/json',
//                 'User-Agent': randomUserAgents[Math.floor(Math.random() * randomUserAgents.length)],
//                 })
//         } : {};

//         const resp = fetch(earl.getUrlString(), initOptions);
//         const text = await (await resp).text();
//         try {
//             const json = JSON.parse(text);

//             console.log(`[ISAWORD/scrabble] '${word}'${
//                 word === json.data.word ? '' : ` ≠ '${json.data.word}'`
//             } status: ${json.status} ${json.success}\n  ${json.data.definition}`);

//             if ('success' in json) return json.success;
//         } catch (error) {
//             const dom = parse(text);
//             if (Array.isArray(dom) && dom.length !== 0 && 'type' in dom[0] && 'name' in dom[0] && dom[0].type === 'directive' && dom[0].name === '!doctype') {
//                 console.log(`[ISAWORD/scrabble] ${word} doctype: ${dom[0].data}`);
//             } else {
//                 throw error;
//             }
//         }
//     } catch (error) {
//         console.error(`[ISAWORD/scrabble]`, error);
//     }
//     return null;
// }

async function dictCom(word: string) {
    // https://www.dictionary.com/browse/captsha
    const earl = new Earl('https://www.dictionary.com', '/browse/');
    earl.setLastPathSegment(word);
    try {
        const main = domStroll('dict.com', false, await earl.fetchDom(), [
            [3, 'html'],
            [3, 'body'],
            [1, 'div', { id: 'root' }],
            [0, 'div', { cls: 'dictionary-site' }],
            [1, 'main'],
        ])!;

        if ('children' in main) {
            if (main.children!.length === 3) return false;
            else if (main.children!.length === 4) return true;
        }        
    } catch (error) {
        console.error(`[ISAWORD/dict.com]`, error);
    }
    return null;
}

async function wordNet(word: string) {
    // http://wordnetweb.princeton.edu/perl/webwn?s=WORD
    const earl = new Earl('http://wordnetweb.princeton.edu', '/perl/webwn', {
        s: word,
    });
    try {
        const body = domStroll('wordnet', false, await earl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
        ])!;
        const tagNodes = body.children!.filter(e => e.type === 'tag');
        const tagNames = tagNodes.map(e => e.name);

        if (['form', 'form', 'h3'].every((e, i) => tagNames[i] === e))
            return false;

        const classNames = tagNodes.map(e => e.attribs!['class']);
        if (['div', 'div'].every((e, i) => tagNames[i] === e) && ['header', 'form'].every((e, i) => classNames[i] === e)) {
            return true;
        }
    } catch (error) {
        console.error(`[ISAWORD/wordnet]`, error);
    }
    return null;
}

async function wordnik(word: string) {
    // https://www.wordnik.com/words/WORD
    const earl = new Earl('https://www.wordnik.com', '/words/');
    earl.setLastPathSegment(word);
    try {
        const gutsActive = domStroll('wordnik1', false, await earl.fetchDom(), [
            [2, 'html'],
            [3, 'body'], 
            [3, 'div', { cls: 'word_page' }],
            [1, 'div', { cls: 'content' }],
            [7, 'div', { cls: 'module-row' }],
            [1, 'div', { cls: 'module-2columnLeft' }],
            [1, 'div', { id: 'define' }],
            [3, 'div', { cls: 'guts' }],                // <div.guts.active>
        ])!;

        const gutsTags: string[] = gutsActive.children!.filter((e: DomNode) => e.type === 'tag').map((e: DomNode) => e.name!);
        console.log(`[ISAWORD/wordnik] ${gutsActive.children!.length} kids, ${gutsTags.length} are tags`);

        const kid1 = gutsActive.children![1];

        // check whether the children that are tags are any number of pairs of <h3> and <ul>
        if (gutsTags.every((e: string, i: number) => e === ['h3', 'ul'][i % 2]))
            return true;
        else if (gutsActive.children!.length === 3 && kid1.type === 'tag' && kid1.name === 'p' && kid1.attribs!['class'] === 'weak')
            return false;
    } catch (error) {
        console.error(`[ISAWORD/wordnik]`, error);
    }
    return null;
}

interface OedJsonData {
    count: number;
    path: string;
    name: string;
    label: string;
}
async function oed(word: string) {
    // https://www.oed.com/autocomplete/dictionary/?q=WORD
    const earl = new Earl('https://www.oed.com', '/autocomplete/dictionary/', {
        q: word
    });
    try {
        const data: OedJsonData[] = await earl.fetchJson() as OedJsonData[];
        console.log(`[ISAWORD/oed] ${word} length: ${data.length}`);

        return data.some(element => {
            // print out any wrong assumptions
            if (element.count > 12) console.log(`[ISAWORD/oed] ${word} count: ${element.count}`);
            if (element.path !== null) console.log(`[ISAWORD/oed] ${word} path: ${element.path}`);
            if (element.name !== element.label) console.log(`[ISAWORD/oed] ${word} name: ${element.name}, label: ${element.label}`);
            // any other keys we didn't expect?
            if (Object.keys(element).length !== 4) console.log(`[ISAWORD/oed] ${word} unexpected keys: ${Object.keys(element).join(', ')}`);
            if (element.name === word) return true;
            if (element.label === word) return true;
        });
    } catch (error) {
        console.error(`[ISAWORD/oed]`, error);
    }
    return null;
}

async function etymonline(word: string) {
    const result: boolean | null = (await etym(word))?.[0];
    console.log(`[ISAWORD/etymonline] ${word} result: ${result}`);
    return result;
}