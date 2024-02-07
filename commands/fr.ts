import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';

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

        const tout = await Promise.all([robertProm, larousseProm]);
        const [robertRes, larousseRes] = tout;
        console.log(`[ISAWORD] ${word} robertRes: ${robertRes} larousseRes: ${larousseRes}`);

        let resultText = 'aucune idée'
        if (robertRes && larousseRes) {
            resultText = `«  ${word}  » est dans les deux dictionnaires, le petit robert et la larousse.`;
        } else if (robertRes && larousseRes === false) {
            resultText = `«  ${word}  » est seulement dans le petit robert.`;
        } else if (larousseRes && robertRes === false) {
            resultText = `«  ${word}  » est seulement dans la larousse.`;
        } else if (robertRes === false && larousseRes === false) {
            resultText = `«  ${word}  » n'est dans aucun dictionnaire. ni le petit robert, ni la larousse.`;
        } else if (robertRes) {
            resultText = `«  ${word}  » est dans le petit robert.`;
        } else if (larousseRes) {
            resultText = `«  ${word}  » est dans la larousse.`;
        }
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

    // just do an HTTP HEAD - if it's moved it's in the dictionary. if 200 OK then it's not

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