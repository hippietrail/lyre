import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';

export const data = new SlashCommandBuilder()
    .setName('es')
    .setDescription('Check for a Spanish word in the RAE')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = es;

async function es(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    try {
        const word = interaction.options.getString('word')!;
        console.log(`es: ${word}`);

        // https://dle.rae.es/WORD
        const raeEarl = new Earl('https://dle.rae.es', word);

        const resultados = domStroll('rae', false, await raeEarl.fetchDom(), [
            [2, 'html'],
            [3, 'body'],
            [1, 'div', { cls: 'container' }],
            [4, 'div', { cls: 'row' }],
            [1, 'div', { cls: 'col-sm-8' }],
            [1, 'section', { id: 'diccionario' }],
            [3, 'div', { id: 'resultados' }],
        ])!;

        // console.log(resultados.children?.map((e,i) => `${i}\t${e.type}\t<${e.name??''}>\t#${e.attribs?.id??''}\t.${e.attribs?.class??''}`).join('\n'));

        const kidsTags = resultados.children!.filter(e => e.type === 'tag').map(e => e.name);
        const firstN = kidsTags.slice(0, -2);
        const last2 = kidsTags.slice(-2);

        console.log(`[ES] first ${firstN.length}`, firstN); console.log(`[ES] last 2`, last2);

        if (['p', 'div'].some((e,i) => last2[i] !== e)) {
            await interaction.editReply(`unexpected last 2 child nodes: ${last2.join(' ')}`);
            return;
        }

        // Aviso: La palabra teju no está en el Diccionario. Las entradas que se muestran a continuación podrían estar relacionadas:
        if (['span', 'p', 'div'].every((e,i) => firstN[i] === e)) {
            await interaction.editReply(`'${word}' not found`);
            return;
        }

        // Entradas que contienen la forma «tejas»:
        if (['div'].every((e,i) => firstN[i] === e)) {
            await interaction.editReply(`'${word}' not found`);
            return;
        }

        if (firstN[0] === 'article') {
            await interaction.editReply(`'${word}' found`);
            return;
        }
        
        await interaction.editReply('hmm...');

    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}