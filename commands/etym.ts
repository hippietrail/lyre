import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { etym as uteEtym } from '../ute/etym';

export const data = new SlashCommandBuilder()
    .setName('etym')
    .setDescription('Check if a word in in Etymonline')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = etym;

async function etym(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    await interaction.editReply((await uteEtym(interaction.options.getString('word')!))[1]);
}
