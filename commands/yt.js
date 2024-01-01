import { SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';
import { ago } from '../ute/ago.js';

config();

// fetch the "playlist" which is actually all the channel's videos
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

export const execute = ytcoding;

export const data2 = new SlashCommandBuilder()
    .setName('retro')
    .setDescription('Latest from my favourite retrocomputing youtube channels');

export const execute2 = ytretro;

// make a map of my favourite coding youtube channel names to their channel IDs
// IDs starting with UU are the playlists for the whole channel
// and are derived from the channel IDs, which start with UC
const codingChans = {
    'Acerola':          'UUQG40havu4kNpB4pxUDQhYQ',
    'AngeTheGreat':     'UUV0t1y4h_6-2SqEpXBXgwFQ',
    'Bisqwit':          'UUKTehwyGCKF-b2wo0RKwrcg',
    'Code Bullet':      'UU0e3QhIYukixgh5VVpKHH9Q',
    'fasterthanlime':   'UUs4fQRyl1TJvoeOdekW6lYA',
    'javidx9':          'UU-yuWVUplUJZvieEligKBkA',
    'Sebastian Lague':  'UUmtyQOKKmrMVaKuRXz02jbQ',
    'suckerpinch':      'UU3azLjQuz9s5qk76KEXaTvA',
    'The Coding Train': 'UUvjgXvBlbQiydffZU7m1_aw',
    'Tsoding Daily':    'UUrqM0Ym_NbK1fqeQG2VIohg',
};

const retroChans = {
    'Adrian\'s Digital Basement':       'UUE5dIscvDxrb7CD5uiJJOiw',
    'Adrian\'s Digital Basement ][':    'UUbtwi4wK1YXd9AyV_4UcE6g',
    'Noel\'s Retro Lab':                'UU2-SP1bYi3ueKlVU7I75wFw',
    'RMC - The Cave':                   'UULEoyoOKZK0idGqSc6Pi23w',
    'The 8-Bit Guy':                    'UU8uT9cgJorJPWu7ITLGo9Ww',
    'The Clueless Engineer':            'UURgWN7MQrH4V3o9wB47DYzA',
};

async function ytcoding(interaction) {
    await yt(interaction, codingChans);
}

async function ytretro(interaction) {
    await yt(interaction, retroChans);
}

async function yt(interaction, chans) {
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
