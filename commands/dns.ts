import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import dns from 'dns';

export const data = new SlashCommandBuilder()
    .setName('dns')
    .setDescription('Check if a domain is available')
    .addStringOption(option => option.setName('domain').setDescription('domain to check').setRequired(true));

export const execute = dnsCheck;

function checkDomainAvailability(domain: string, callback: (error: string | null, status: string) => void) {
    dns.resolve(domain, (error) => {
        if (error && error.code === 'ENOTFOUND') {
            // Domain is not registered
            callback(null, 'available');
        } else if (error) {
            // Error occurred during DNS resolution
            callback(error.message, 'error');
        } else {
            // Domain is registered
            callback(null, 'registered');
        }
    });
}

async function dnsCheck(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const domain = interaction.options.getString('domain', true);
    checkDomainAvailability(domain, async (error: string | null, status: string) => {
        if (error) {
            console.error('[DNS] An error occurred:', error);
            await interaction.editReply('An error occurred while fetching data.');
        } else {
            console.log(`[DNS] Domain status: ${status}`);
            await interaction.editReply(`Domain ${domain} is ${status}.`);
        }
    });
}