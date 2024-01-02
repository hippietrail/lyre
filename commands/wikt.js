import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { htmlToText } from 'html-to-text';

class ActionQueryEarl extends Earl {
    constructor(searchParams = {}) {
        super('https://en.wiktionary.org', '/w/api.php', {
            action: 'query',
            format: 'json',
            ...searchParams
        });
    }
}

class ListRandomEarl extends ActionQueryEarl {
    constructor() {
        super({
            list: 'random',
            rnnamespace: '0',
        });
    }
    setLimit(limit) {
        this.setSearchParam('rnlimit', limit);
    }
}

class IsAWordEarl extends ActionQueryEarl {
    constructor() {
        super()
    }
    setTitles(titles) {
        this.setSearchParam('titles', titles.join('|'));
    }
}

class RestDefinitionsEarl extends Earl {
    constructor() {
        super('https://en.wiktionary.org', '/api/rest_v1/page/definition/');
    }
    setTerm(term) {
        this.setLastPathSegment(term);
    }
}

// we modify the global URLs each time rather than constructing new ones
const wiktRandomlEarl = new ListRandomEarl();   // setLimit()
const wiktIsAWordEarl = new IsAWordEarl();      // setTitles()
const wiktXEarl = new RestDefinitionsEarl();    // setTerm()

export const data = new SlashCommandBuilder()
    .setName('wikt')
    .setDescription('Random words from Wiktionary')
    .addIntegerOption(option => option.setName('number').setDescription('number of random words').setRequired(false));

export const execute = random;

export const data2 = new SlashCommandBuilder()
    .setName('isaword')
    .setDescription('Is a word in Wiktionary?')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute2 = isaword;

export const data3 = new SlashCommandBuilder()
    .setName('wiktx')
    .setDescription('Something magic from Wiktionary');

export const execute3 = wiktx;

async function random(interaction) {
    console.log("random")
    await interaction.deferReply();
    try {
        const number = interaction.options.getInteger('number') ?? 1;
        console.log(`wikt number: '${number}'`);
        if (number > 0) {
            wiktRandomlEarl.setLimit(number);

            const rando = (await (await fetch(wiktRandomlEarl.getUrlString())).json()).query.random;
            const mappo = rando.map(r => r.title);
            await interaction.editReply(`${mappo.join(', ')}`);
        } else {
            await interaction.editReply('technically, that would not be very random');
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}

async function isaword(interaction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word');
        console.log(`isaword: '${word}'`);
        
        const lower = word.toLowerCase();

        const uniqVariants = Array.from(new Set([
            word,
            lower,
            word.toUpperCase(),
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        ]));

        // if word consists only of unaccented English letters, hyphen, fullstop, apostrophes, and spaces
        const regex = /^[a-z\-.' ]+$/;
        if (regex.test(lower)) {
            console.log(`word '${word}' consists only of unaccented English letters, hyphen, fullstop, apostrophes, and spaces`);
            const ar = Array.from(lower);
            const d1 = ar.join('.');
            const d2 = ar.join('. ');
            uniqVariants.push(
                lower,
                lower.toUpperCase(),
                d1,
                d2,
                d1.toUpperCase(),
                d2.toUpperCase(),
                `${d1}.`,
                `${d2}.`,
                `${d1.toUpperCase()}.`,
                `${d2.toUpperCase()}.`,
            );
        } else {
            console.log(`word '${word}' does not consist only of unaccented English letters, hyphen, fullstop, apostrophes, and spaces`);
        }
        if (word.endsWith("s")) {
            if (word.endsWith("'s"))
                uniqVariants.push(`${word.slice(0, -2)}s`);
            else
                uniqVariants.push(`${word.slice(0, -1)}'s`);
        }
        if (word.endsWith(".")) {
            uniqVariants.push(word.slice(0, -1));
        } else {
            uniqVariants.push(`${word}.`);
        }
        if (word.includes(" ")) {
            uniqVariants.push(word.replaceAll(" ", "-"));
            uniqVariants.push(word.replaceAll(" ", ""));
        }
        if (word.includes("-")) {
            uniqVariants.push(word.replaceAll("-", ""));
            uniqVariants.push(word.replaceAll("-", " "));
        }

        wiktIsAWordEarl.setTitles(uniqVariants);

        const data = await (await fetch(wiktIsAWordEarl.getUrlString())).json();

        const present = [];
        const absent = [];

        for (const [key, dqp] of Object.entries(data.query.pages))
            (parseInt(key) < 0 ? absent : present).push(dqp.title);

        const gotExact = present.includes(word);

        console.log("Present:", present, gotExact ? `including '${word}'` : "");
        console.log("Absent:", absent, gotExact ? "" : `including '${word}'`);

        let reply;
        if (present.length === 0) {
            reply = `No sign of '${word}' in there mate!`;
        } else if (!gotExact && present.length === 1) {
            reply = `'${word}' isn't in Wiktionary but '${present[0]}' is.`;
        } else if (!gotExact && present.length > 1) {
            reply = `'${word}' isn't in there but these are: ${present.join(', ')}`;
        } else if (gotExact && present.length === 1) {
            reply = `Yep '${word}' is there.`;
        } else if (gotExact && present.length >= 2) {
            const presentVariants = present.filter(variant => variant !== word);
            if (present.length == 2)
                reply = `Not only is '${word}' there, but I also found '${presentVariants[0]}'`;
            else
                reply = `Not only is '${word}' there, but I also found these: ${presentVariants.join(', ')}`;
        } else {
            reply = `An unexpected combination of exact word, present variants, and absent variants was found. gotExact: ${gotExact}, present: ${present.join(', ')}, absent: ${absent.join(', ')}`;
        }

        await interaction.editReply(reply);
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}

// return the defintion of a word from Wiktionary using the new API I only just found out about
async function wiktx(interaction) {
    await interaction.deferReply();
    try {
        wiktRandomlEarl.setLimit(1);

        const rando = (await (await fetch(wiktRandomlEarl.getUrlString())).json()).query.random;
        const title = rando[0].title;

        wiktXEarl.setTerm(title);

        const daddo = await (await fetch(wiktXEarl.getUrlString())).json();
        //console.log(daddo);

        // if it has exactly these keys then it's an error: type, title, method, detail, uri
        if (daddo['type'] && daddo['title'] && daddo['method'] && daddo['detail'] && daddo['uri']) {
            console.log(`Error: ${JSON.stringify(daddo, null, 2)}`);
            await interaction.editReply(`Error: ${daddo.title}: ${daddo.detail}`);
        } else {
            const en = daddo['en'];
            if (en) {
                console.log(`English definition: ${JSON.stringify(en, null, 2)}`);
                const text = htmlToText(
                    en[0].definitions[0].definition, {
                        selectors: [ { selector: 'a', options: { ignoreHref: true } } ],
                        wordwrap: false,
                    }
                );
                const reply = `${title}:\n${text}`
                console.log(reply);
                await interaction.editReply(reply);
            } else {
                const reply = `'${title}' has no English, just ${Object.keys(daddo).map(x => daddo[x][0].language).join(', ')}.`;
                console.log(reply);
                await interaction.editReply(reply);
            }
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}