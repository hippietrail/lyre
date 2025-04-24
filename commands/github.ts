import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { GithubEarl } from '../ute/earl';
import { ago } from '../ute/ago';
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

interface JsonData {
    actor: { login: string };
    type: string;
    payload: { action: string };
    repo: { name: string };
    created_at: string;
    url: string;
}

export const execute = async (interaction: ChatInputCommandInteraction) => {
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

                const json = await githubEarl.fetchJson() as JsonData[];
                if ('message' in json && 'documentation_url' in json) {
                    console.log(`[GitHub] GitHub API error: '${user}' ${json.message} ${githubEarl.getUrlString()}`);
                    return [];
                }
                return json
                    .slice(0, NUM_TO_FETCH)
                    .map(e => ({
                        user: e.actor.login,
                        type: e.type.split(/(?=[A-Z])/).slice(0, -1).join(' ').toLowerCase(),
                        payloadAction: e.payload.action,
                        repo: e.repo.name,
                        created_at: e.created_at,
                        elapsed_time: now.getTime() - new Date(e.created_at).getTime(),
                    }));
            })))
                .flat()
                .sort((a, b) => a.elapsed_time - b.elapsed_time)
                .slice(0, NUM_TO_FETCH)
                .map(e => `${e.user}: ${e.type}${e.payloadAction ? `.${e.payloadAction}` : ''
                    } [${e.repo}](<https://github.com/${e.repo}>) - ${ago(e.elapsed_time)}`)
                .join('\n');

            await interaction.editReply(reply !== "" ? reply : 'No events found');
        }
    } catch (error) {
        console.error(`[GitHub] ${error}`);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
