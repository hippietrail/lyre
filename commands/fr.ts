import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { humanFriendlyListFormatter } from '../ute/amis';
import { wikt } from '../ute/wikt';

export const data = new SlashCommandBuilder()
    .setName('fr')
    .setDescription('Check for a French word in a couple of dictionaries')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = fr;

async function fr(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word')!;
        console.log(`fr: ${word}`);

        const tout = await Promise.all([
            robert(word),
            larousse(word),
            wikt('fr', word).then(w => w === 0 ? false : w === 1 ? true : null),
        ]);
        const [robertRes, larousseRes, wiktRes] = tout;

        console.log(`[fr] ${word} robertRes: ${robertRes} larousseRes: ${larousseRes} wiktRes: ${wiktRes}`);

        let resultText = 'aucune idée'
        const dictNames = ['le petit robert', 'larousse', 'wiktionary français'];
        const ins = tout.map((res, i) => res ? dictNames[i] : undefined).filter(Boolean).map(e => e!);
        const notIns = tout.map((res, i) => res === false ? dictNames[i] : undefined).filter(Boolean).map(e => e!);

        if (ins.length && notIns.length)
            resultText = `'${word}' is in ${humanFriendlyListFormatter(ins, 'and')}; but not in ${humanFriendlyListFormatter(notIns, 'or')}`;
        else if (ins.length)
            resultText = `${word} is in ${humanFriendlyListFormatter(ins, 'and')}`;
        else if (notIns.length)
            resultText = `${word} is not in ${humanFriendlyListFormatter(notIns, 'or')}`;
        // any other combination means one or more lookups failed
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
        console.log(`[fr/robert] ${word} length: ${data.length}`);
        const filtr = data.filter(e => e.type === 'def' && e.term === word);
        console.log(`[fr/robert] ${word} filtr: ${filtr.length} after filtering`);
        if (filtr.length === 0) return false;
        else if (filtr.length > 0) return true;
    } catch (error) {
        console.error(`[fr/robert]`, error);
    }
    return null;
}

async function larousse(word: string): Promise<boolean | null> {
    // https://www.larousse.fr/dictionnaires/francais/WORD
    const larousseEarl = new Earl('https://www.larousse.fr', '/dictionnaires/francais/');
    larousseEarl.setLastPathSegment(word);
    try {
        const status = (await fetch(larousseEarl.getUrlString(), { method: 'HEAD', redirect: 'manual' })).status;
        console.log(`[fr/larousse] ${word} status: ${status}`);
        if (status === 301) return true;
        else if (status === 200) return false;
    } catch (error) {
        console.error(`[fr/larousse]`, error);
    }
    return null;
}
