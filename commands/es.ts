import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';
import { wikt } from '../ute/wikt';

export const data = new SlashCommandBuilder()
    .setName('es')
    .setDescription('Check for a Spanish word in the RAE')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = es;

async function es(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word');

        type DictTuple = [string, (word: string) => Promise<number | null>];

        const replies = await Promise.all(([
            ['rae', rae],
            ['enwiktionary', () => wikt('en', word!)],
            ['viwiktionary', () => wikt('es', word!)],
        ] as Array<DictTuple>).map(async ([name, func]) => {
            const reply = await func(word!);
            return reply !== null
                ? `${name}: ${reply} results.`
                : `${name}: error.`
        }));
        
        await interaction.editReply(replies.join('\n'));
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}

async function rae(word: string): Promise<number | null> {
    const raeEarl = new Earl('https://dle.rae.es', word);
    try {
        const resultados = domStroll('rae', false, await raeEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [1, 'div', { cls: 'container' }],
            [4, 'div', { cls: 'row' }],
            [1, 'div', { cls: 'col-sm-8' }],
            [1, 'section', { id: 'diccionario' }],
            [3, 'div', { id: 'resultados' }],
        ])!;

        const kidsTags = resultados.children!.filter(e => e.type === 'tag').map(e => e.name);
        const firstN = kidsTags.slice(0, -2);
        const last2 = kidsTags.slice(-2);

        console.log(`[ES] first ${firstN.length}`, firstN); console.log(`[ES] last 2`, last2);

        if (['p', 'div'].some((e,i) => last2[i] !== e)) {
            console.log('hmm...');
            return null;
        }

        // Aviso: La palabra teju no está en el Diccionario. Las entradas que se muestran a continuación podrían estar relacionadas:
        if (['span', 'p', 'div'].every((e,i) => firstN[i] === e)) {
            return 0;
        }

        // Entradas que contienen la forma «tejas»:
        if (['div'].every((e,i) => firstN[i] === e)) {
            return 0;
        }

        if (firstN[0] === 'article') {
            return 1;
        }
        return null;

    } catch (error) {
        console.error(error);
        return null;
    }
}