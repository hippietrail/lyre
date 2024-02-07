import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { humanFriendlyListFormatter } from '../ute/amis';

export const data = new SlashCommandBuilder()
    .setName('fr')
    .setDescription('Check for a French word in a couple of dictionaries')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = es;

async function es(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word')!;
        console.log(`es: ${word}`);

        const robertProm = robert(word);
        const larousseProm = larousse(word);
        const wiktProm = wikt('fr', word);

        const tout = await Promise.all([robertProm, larousseProm, wiktProm]);
        const [robertRes, larousseRes, wiktRes] = tout;
        console.log(`[ISAWORD] ${word} robertRes: ${robertRes} larousseRes: ${larousseRes}`);

        let resultText = 'aucune idée'
        const dictNames = ['le petit robert', 'larousse', 'wiktionary français'];
        const ins = tout.map((res, i) => res ? dictNames[i] : undefined).filter(Boolean).map(e => e!);
        const notIns = tout.map((res, i) => res === false ? dictNames[i] : undefined).filter(Boolean).map(e => e!);

        if (ins.length && notIns.length)
            resultText = `in ${humanFriendlyListFormatter(ins, 'and')} not in ${humanFriendlyListFormatter(notIns, 'or')}`;
        else if (ins.length)
            resultText = `in ${humanFriendlyListFormatter(ins, 'and')}`;
        else if (notIns.length)
            resultText = `not in ${humanFriendlyListFormatter(notIns, 'or')}`;
        // any other combination means one or both lookups failed
        await interaction.editReply(resultText);

    } catch (e) {
        console.error(e);
        await interaction.editReply('Je n\'arrive pas à trouver cette fréquence.');
    }
}

interface RobertJson {
    page: string;
    term: string;
    display: string;
    type: string;
    typeTitle: string;
    typeLabel: string;
}

async function robert(word: string): Promise<boolean | null> {
    // https://dictionnaire.lerobert.com/autocomplete.json?t=def&q=WORD
    const robertEarl = new Earl('https://dictionnaire.lerobert.com', '/autocomplete.json', {
        t: 'def',
        q: word
    });
    try {
        const data = await robertEarl.fetchJson() as RobertJson[];
        console.log(`[ISAWORD/robert] ${word} length: ${data.length}`);
        const filtr = data.filter(e => e.type === 'def' && e.term === word);
        console.log(`[ISAWORD/robert] ${word} filtr: ${filtr.length} after filtering`);
        if (filtr.length === 0) return false;
        else if (filtr.length > 0) return true;
    } catch (error) {
        console.error(`[ISAWORD/robert]`, error);
    }
    return null;
}

async function larousse(word: string): Promise<boolean | null> {
    // https://www.larousse.fr/dictionnaires/francais/WORD
    const larousseEarl = new Earl('https://www.larousse.fr', '/dictionnaires/francais/');
    larousseEarl.setLastPathSegment(word);
    try {
        const status = (await fetch(larousseEarl.getUrlString(), { method: 'HEAD', redirect: 'manual' })).status;
        console.log(`[ISAWORD/larousse] ${word} status: ${status}`);
        if (status === 301) return true;
        else if (status === 200) return false;
    } catch (error) {
        console.error(`[ISAWORD/larousse]`, error);
    }
    return null;
}

interface WikiApiJson {
    query: {
        pages: [
            {
                pageid?: unknown,
                missing?: unknown,
            }
        ]
    }
}

// TODO this is duplicated from thai.ts
async function wikt(wikiLang: string, word: string) {
    const wiktEarl = new Earl(`https://${wikiLang}.wiktionary.org`, '/w/api.php', {
        'action': 'query',
        'format': 'json',
        'titles': word
    });
    const data = await wiktEarl.fetchJson() as WikiApiJson;

    if (Object.keys(data.query.pages).length === 1) {
        const page = Object.values(data.query.pages)[0];
        
        if ('pageid' in page) return true;
        else if ('missing' in page) return false;
    }
    
    return null;
}
