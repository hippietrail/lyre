import { SlashCommandBuilder } from 'discord.js';

const wiktRandomUrl = new URL('https://en.wiktionary.org');
wiktRandomUrl.pathname = '/w/api.php';
const spRnd = wiktRandomUrl.searchParams;
spRnd.set('action', 'query');
spRnd.set('format', 'json');
spRnd.set('list', 'random');
spRnd.set('rnlimit', '2');
spRnd.set('rnnamespace', '0');

const wiktIsAWordUrl = new URL('https://en.wiktionary.org');
wiktIsAWordUrl.pathname = '/w/api.php';
const spIsW = wiktIsAWordUrl.searchParams;
spIsW.set('action', 'query');
spIsW.set('format', 'json');

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

export async function random(interaction) {
    console.log("random")
    await interaction.deferReply();
    try {
        const number = interaction.options.getInteger('number') ?? 1;
        console.log(`wikt number: '${number}'`);
        if (number > 0) {
            spRnd.set('rnlimit', number.toString());
            const response = await fetch(wiktRandomUrl);
            const data = await response.json();
            const mappo = data.query.random.map(x => x.title);
            await interaction.editReply(`${mappo.join(', ')}`);
        } else {
            await interaction.editReply('technically, that would not be very random');
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}

export async function isaword(interaction) {
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
        const joinedVariants = uniqVariants.join('|');

        spIsW.set('titles', joinedVariants);
        const data = await (await fetch(wiktIsAWordUrl)).json();
        //console.log(data.query.pages);

        const present = [];
        const absent = [];

        for (const [key, dqp] of Object.entries(data.query.pages))
            (parseInt(key) < 0 ? absent : present).push(dqp.title);

        const gotExact = present.includes(word);

        console.log("Present:", present, gotExact ? `including '${word}'` : "");
        console.log("Absent:", absent, gotExact ? `including '${word}'` : "");

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

        await interaction.reply(reply);
    } catch (error) {
        console.error(error);
        await interaction.reply('An error occurred while fetching data.');
    }
}
