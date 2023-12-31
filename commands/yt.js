import { SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';
import { ago } from '../ute/ago.js';

config();

 function fetchYouTubeChannelVids(playlistId) {
    const url = new URL('https://www.googleapis.com');
    url.pathname = '/youtube/v3/playlistItems';
    const sp = url.searchParams;
    sp.set('part', 'snippet');
    sp.set('maxResults', '3');
    sp.set('order', 'date');
    sp.set('key', process.env.YT_API_KEY);
    sp.set('playlistId', playlistId);
    return fetch(url.href);
}

export const data = new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('Latest from my favourite coding youtube channels');

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
        const now = new Date();

        const allVids = (await Promise.all(
            Object.values(chans).map(
                async plid => (await fetchYouTubeChannelVids(plid)).json()
            )
        )).map(chanVids => chanVids.items).flat();
        
        allVids.sort((a, b) => b.snippet.publishedAt.localeCompare(a.snippet.publishedAt));

        const reply = `${
            allVids.slice(0, 10).map(v => `${v.snippet.channelTitle}: ${v.snippet.title} - ${
                ago(now - new Date(v.snippet.publishedAt))
            }`).join('\n')
        }`;
        await interaction.editReply(reply);
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
