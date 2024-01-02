import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';
import { config } from 'dotenv';

config();

// fetch the "playlist" which is actually all the channel's videos
class YoutubeVidsEarl extends Earl {
    constructor() {
        super('https://www.googleapis.com', '/youtube/v3/playlistItems', {
            part: 'snippet',
            maxResults: '3',
            order: 'date',
            key: process.env.YT_API_KEY,
        });
    }
    setPlaylistId(playlistId) {
        this.url.searchParams.set('playlistId', playlistId);
    }
}

const ytEarl = new YoutubeVidsEarl();

function fetchVideos(playlistId) {
    ytEarl.setPlaylistId(playlistId);
    return ytEarl.fetchJson();
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
    'Acerola':                      'UUQG40havu4kNpB4pxUDQhYQ',
    'AngeTheGreat':                 'UUV0t1y4h_6-2SqEpXBXgwFQ',
    'AppleProgramming':             'UUDg-YmnNehm3KB0BpytkUJg',
    'Bisqwit':                      'UUKTehwyGCKF-b2wo0RKwrcg',
    'ChibiAkumas':                  'UU8t99gp5IN-FTf5rGVaRevw',
    'Code Bullet':                  'UU0e3QhIYukixgh5VVpKHH9Q',
    'fasterthanlime':               'UUs4fQRyl1TJvoeOdekW6lYA',
    'Inigo Quilez':                 'UUdmAhiG8HQDlz8uyekw4ENw',
    'javidx9':                      'UU-yuWVUplUJZvieEligKBkA',
    'Sebastian Lague':              'UUmtyQOKKmrMVaKuRXz02jbQ',
    'StatQuest with Josh Starmer':  'UUtYLUTtgS3k1Fg4y5tAhLbw',
    'suckerpinch':                  'UU3azLjQuz9s5qk76KEXaTvA',
    'The Art of Code':              'UUcAlTqd9zID6aNX3TzwxJXg',
    'The Coding Train':             'UUvjgXvBlbQiydffZU7m1_aw',
    'Tsoding Daily':                'UUrqM0Ym_NbK1fqeQG2VIohg',
};

const retroChans = {
    'Adrian\'s Digital Basement':       'UUE5dIscvDxrb7CD5uiJJOiw',
    'Adrian\'s Digital Basement ][':    'UUbtwi4wK1YXd9AyV_4UcE6g',
    'ChibiAkumas':                      'UU8t99gp5IN-FTf5rGVaRevw',
    'Jan Beta':                         'UUftUpOO4h9EgH0eDOZtjzcA',
    'LGR':                              'UULx053rWZxCiYWsBETgdKrQ',
    'Modern Vintage Gamer':             'UUjFaPUcJU1vwk193mnW_w1w',
    'Noel\'s Retro Lab':                'UU2-SP1bYi3ueKlVU7I75wFw',
    'Nostalgia Nerd':                   'UU7qPftDWPw9XuExpSgfkmJQ',
    'RetroVirtualMachine':              'UUgNfOsqL76T13tUex62gonA',
    'RMC - The Cave':                   'UULEoyoOKZK0idGqSc6Pi23w',
    'Tech Tangents':                    'UUerEIdrEW-IqwvlH8lTQUJQ',
    'The 8-Bit Guy':                    'UU8uT9cgJorJPWu7ITLGo9Ww',
    'The Byte Attic':                   'UUfzZNuoHys1t-AdwYDhOz8g',
    'The Clueless Engineer':            'UURgWN7MQrH4V3o9wB47DYzA',
    'The Retro Desk':                   'UUWihlGXWuyJbjP5vjzD03Rw',
    'Usagi Electric':                   'UUE4xstUnu0YmkG-W9_PyYrQ',
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

        const allVids = (await Promise.all(Object.values(chans).map(
            async plid => await fetchVideos(plid)
        ))).map(chanVids => chanVids.items).flat();
        
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
