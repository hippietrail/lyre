import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl, type IsRedirect } from '../ute/earl';
import { humanFriendlyListFormatter } from '../ute/amis';
import { wikt } from '../ute/wikt';

export const data = new SlashCommandBuilder()
    .setName('fr')
    .setDescription('Check for a French word in a couple of dictionaries')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = fr;

async function fr(interaction: ChatInputCommandInteraction) {
    const lang = ['en', 'fr'][Math.floor(Math.random() * 2)];
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

        let resultText = lang === 'fr' ? 'aucune idée' : 'dunno';

        const dictNames = ['le petit robert', 'larousse', lang === 'fr' ? 'wiktionary français' : 'french wiktionary'];

        const ins = tout.map((res, i) => res ? dictNames[i] : undefined).filter(Boolean).map(e => e!);
        const notIns = tout.map((res, i) => res === false ? dictNames[i] : undefined).filter(Boolean).map(e => e!);

        if (ins.length && notIns.length)
            lang === 'en'
                ? resultText = `'${word}' is in ${humanFriendlyListFormatter(ins, 'and')}; but not in ${humanFriendlyListFormatter(notIns, 'or')}`
                : resultText = `'${word}' est dans ${humanFriendlyListFormatter(ins, 'et')}; mais pas dans ${humanFriendlyListFormatter(notIns, 'ou')}`;
        else if (ins.length)
            lang === 'en'
                ? resultText = `${word} is in ${humanFriendlyListFormatter(ins, 'and')}`
                : resultText = `${word} est dans ${humanFriendlyListFormatter(ins, 'et')}`;
        else if (notIns.length)
            lang === 'en'
                ? resultText = `${word} is not in ${humanFriendlyListFormatter(notIns, 'or')}`
                : resultText = `${word} n'est pas dans ${humanFriendlyListFormatter(notIns, 'ou')}`;
        // any other combination means one or more lookups failed
        await interaction.editReply(resultText);

    } catch (e) {
        console.error(e);
        await interaction.editReply(
            lang === 'en'
                ? 'something went wrong, probably the internet'
                : 'quelque chose s\'est mal passe, probablement internet'
        );
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
        if (filtr.length > 0) return true;
    } catch (error) {
        console.error("[fr/robert]", error);
    }
    return null;
}

async function larousse(word: string): Promise<IsRedirect> {
    // https://www.larousse.fr/dictionnaires/francais/WORD
    const larousseEarl = new Earl('https://www.larousse.fr', '/dictionnaires/francais/');
    larousseEarl.setLastPathSegment(word);
    try {
        return (await larousseEarl.checkRedirect())
    } catch (error) {
        console.error("[fr/larousse]", error);
    }
    return undefined;
}
