import { SlashCommandBuilder } from 'discord.js';

const githubUrl = new URL('https://api.github.com');

export const data = new SlashCommandBuilder()
    .setName('github')
    .setDescription('GitHub events')
    .addStringOption(option =>
        option.setName('username')
            .setDescription('GitHub username')
            .setRequired(false));

export const execute = async interaction => {
    await interaction.deferReply();
    try {
        const username = interaction.options.getString('username');
        const usernames = username ? [username] : ['hippietrail', 'justinmcp', 'hitman-codehq'];

        const promises = usernames.map(async (user) => {
            githubUrl.pathname = `/users/${user}/events/public`;
            const response = await fetch(githubUrl);
            const data = await response.json();
            return data.slice(0, 2).map(e => {
                const action = e.type.split(/(?=[A-Z])/).slice(0, -1).join(' ').toLowerCase();
                return `${e.actor.login} ${action} ${e.repo.name}`;
            }).join('; ');
        });

        const replies = await Promise.all(promises);
        const reply = replies.join('\n');
        await interaction.editReply(reply !== "" ? reply : 'No events found');
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
