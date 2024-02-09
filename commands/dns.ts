import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Resolver } from 'dns/promises';

export const data = new SlashCommandBuilder()
    .setName('dns')
    .setDescription('Check if a domain is available')
    .addStringOption(option => option.setName('domain').setDescription('domain to check').setRequired(true));

export const execute = dns;

async function dns(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const domain = interaction.options.getString('domain', true);
    try {
        const resolver = new Resolver();
        await resolver.resolve4(domain);
        await interaction.editReply(`'${domain}': found it. so you can't register it.`);
    } catch (error: any) {
        console.error(error);
        if (!['errno', 'code', 'syscall', 'hostname'].some(e => error[e]))
            return await interaction.editReply(`'${domain}': missing expected fields in error.`);

        if (error.errno !== undefined || error.syscall !== 'queryA')
            return await interaction.editReply(`'${domain}': unexpected values in error.`);

        if (error.code === 'ENOTFOUND') {
            await interaction.editReply(`'${domain}': can't find it. so it might be available.`);
        } else if (error.code === 'EBADNAME') {
            await interaction.editReply(`'${domain}': don't be silly. that's not a proper domain name.`);
        } else {
            await interaction.editReply(`'${domain}': unexpected error code.`);
        }
    }
}
