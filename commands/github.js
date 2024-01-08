import { SlashCommandBuilder } from 'discord.js';
import { GithubEarl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';
import { config } from 'dotenv';

config();

const NUM_TO_FETCH = 10;

const githubEarl = new GithubEarl();
githubEarl.setPerPage(NUM_TO_FETCH);

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
        const usernames = username
            ? [username] : process.env.GITHUB_USERS
                ? process.env.GITHUB_USERS.split('|') : [];

        if (usernames.length === 0) {
            await interaction.editReply('No GitHub usernames specified or in the .env file');
        } else {
            const now = new Date();

            const reply = (await Promise.all(usernames.map(async user => {
                githubEarl.setUserName(user);

                return (await githubEarl.fetchJson())
                    .slice(0, NUM_TO_FETCH)
                    .map(e => ({
                        user: e.actor.login,
                        type: e.type.split(/(?=[A-Z])/).slice(0, -1).join(' ').toLowerCase(),
                        payloadAction: e.payload.action,
                        repo: e.repo.name,
                        created_at: e.created_at,
                        elapsed_time: now - new Date(e.created_at),
                    }));
            })))
                .flat()
                .sort((a, b) => a.elapsed_time - b.elapsed_time)
                .map(e => `${e.user}: ${e.type}${e.payloadAction ? `.${e.payloadAction}` : ''
                    } [${e.repo}](<https://github.com/${e.repo}>) - ${ago(e.elapsed_time)}`)
                .join('\n');

            await interaction.editReply(reply !== "" ? reply : 'No events found');
        }
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
