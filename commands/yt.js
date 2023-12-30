import { SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';

config();

// get the latest videos for the Tsoding channel
// https://youtube.googleapis.com/youtube/v3/search?part=snippet&channelId=UChcSRqitXAm2BXtxTzP1azQ&maxResults=25&key=SUPER_SECRET_KEY

const ytUrl = new URL('https://www.googleapis.com');
ytUrl.pathname = '/youtube/v3/search';
const sp = ytUrl.searchParams;
sp.set('part', 'snippet');
sp.set('channelId', 'UCrqM0Ym_NbK1fqeQG2VIohg');
sp.set('maxResults', '5');
sp.set('order', 'date');
sp.set('key', process.env.YT_API_KEY);

export const data = new SlashCommandBuilder()
    .setName('yt')
    .setDescription('Get the latest videos for the Tsoding channel');

export const execute = yt;

async function yt(interaction) {
    await interaction.deferReply();
    try {
        const response = await fetch(ytUrl);
        const data = await response.json();
        const now = new Date();
        const mappo = data.items.map(x => {
            const elapsed_time = now - new Date(x.snippet.publishedAt);
            return `${
                elapsed_time > 1000 * 60 * 60 * 24
                ? `${Math.floor(elapsed_time / 1000 / 60 / 60 / 24)} days ago`
                : elapsed_time > 1000 * 60 * 60
                    ? `${Math.floor(elapsed_time / 1000 / 60 / 60)} hours ago`
                    : `${Math.floor(elapsed_time / 1000 / 60)} minutes ago`
            }: ${
                x.snippet.title
            }`
        });
        await interaction.editReply(`${mappo.join('\n')}`);
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}