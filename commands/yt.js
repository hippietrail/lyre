import { SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';
import { ago } from '../ute/ago.js';

config();

const ytUrl = new URL('https://www.googleapis.com');
ytUrl.pathname = '/youtube/v3/playlistItems';
const sp = ytUrl.searchParams;
sp.set('part', 'snippet');
sp.set('maxResults', '5');
sp.set('order', 'date');
sp.set('key', process.env.YT_API_KEY);

export const data = new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('The latest Tsoding Daily videos');

export const execute = yt;

// make a map of my favourite coding youtube channel names to their channel IDs
const chans = {
    'Tsoding Daily':    'UUrqM0Ym_NbK1fqeQG2VIohg',
    'AngeTheGreat':     'UUV0t1y4h_6-2SqEpXBXgwFQ',
    'javidx9':          'UU-yuWVUplUJZvieEligKBkA',
    'Bisqwit':          'UUKTehwyGCKF-b2wo0RKwrcg',
    'Code Bullet':      'UU0e3QhIYukixgh5VVpKHH9Q',
    'Acerola':          'UUQG40havu4kNpB4pxUDQhYQ',
    'The Coding Train': 'UUvjgXvBlbQiydffZU7m1_aw',
    'Sebastian Lague':  'UUmtyQOKKmrMVaKuRXz02jbQ',
    'suckerpinch':      'UU3azLjQuz9s5qk76KEXaTvA',
};

async function yt(interaction) {
    await interaction.deferReply();
    try {
        const promises = [];
        sp.set('maxResults', '3');
        for (const chan in chans) {
            sp.set('playlistId', chans[chan]);
            promises.push(fetch(ytUrl));
        }
        const responses = await Promise.all(promises);
        const videos = [];
        const now = new Date();
        for (const response of responses) {
            const data = await response.json();
            videos.push(...data.items);
        }
        videos.sort();
        const mappo = videos.slice(0, 10).map(x => {
            const elapsed_time = now - new Date(x.snippet.publishedAt);
            return `${x.snippet.channelTitle}: ${x.snippet.title} - ${
                ago(elapsed_time)
            }`
        });
        await interaction.editReply(`${mappo.join('\n')}`);
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
