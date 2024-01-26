import { SlashCommandBuilder } from 'discord.js';
import { YoutubeVidsEarl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';
import fs from 'node:fs';

let config;
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (err) {
    console.error(`[YouTube] ${err}`);
}

const ytEarl = new YoutubeVidsEarl();
ytEarl.setMaxResults(10);

function fetchVideos(playlistId) {
    ytEarl.setPlaylistId(playlistId);
    return ytEarl.fetchJson();
}

export const data = new SlashCommandBuilder()
    .setName('ytcoding')
    .setDescription('Latest from my favourite coding YouTube channels');

export const execute = ytcoding;

export const data2 = new SlashCommandBuilder()
    .setName('ytretro')
    .setDescription('Latest from my favourite retrocomputing YouTube channels');

export const execute2 = ytretro;

export const data3 = new SlashCommandBuilder()
    .setName('ytcoding2')
    .setDescription('Latest from other coding YouTube channels');

export const execute3 = ytcoding2;

export const data4 = new SlashCommandBuilder()
    .setName('ytretro2')
    .setDescription('Latest from other retrocomputing YouTube channels');

export const execute4 = ytretro2;

export const data5 = new SlashCommandBuilder()
    .setName('ytstories')
    .setDescription('Latest from storytelling YouTube channels');

export const execute5 = ytstories;

export const data6 = new SlashCommandBuilder()
    .setName('ytother')
    .setDescription('Latest from other YouTube channels');

export const execute6 = ytother;

export const data7 = new SlashCommandBuilder()
    .setName('ytall')
    .setDescription('Latest from all YouTube channels');

export const execute7 = ytall;

async function ytcoding(interaction) {
    await yt(interaction, 'coding', config.coding);
}

async function ytcoding2(interaction) {
    await yt(interaction, 'coding2', config.coding2);
}

async function ytretro(interaction) {
    await yt(interaction, 'retro', config.retro);
}

async function ytretro2(interaction) {
    await yt(interaction, 'retro2', config.retro2);
}

async function ytstories(interaction) {
    await yt(interaction, 'stories', config.stories);
}

async function ytother(interaction) {
    await yt(interaction, 'other', config.other);
}

async function ytall(interaction) {
    await yt(interaction, 'all', {
        ...config.coding,
        ...config.coding2,
        ...config.retro,
        ...config.retro2,
        ...config.stories,
        ...config.other
    });
}

async function yt(interaction, chanGroupName, chanList) {
    await interaction.deferReply();
    try {
        const now = new Date();

        if (chanList.length === 0) {
            await interaction.editReply(`No channels in group '${chanGroupName}'`);
            return;
        }

        const allVids = (await Promise.all(Object.values(chanList).map(
            async plid => await fetchVideos(plid)
        ))).map(chanVids => chanVids.items).flat();
        
        allVids.sort((a, b) => b.snippet.publishedAt.localeCompare(a.snippet.publishedAt));

        const reply = `${
            allVids.slice(0, 10).map(v => `${v.snippet.channelTitle}: [${
                v.snippet.title
            }](<https://www.youtube.com/watch?v=${
                v.snippet.resourceId.videoId
            }>) - ${
                ago(now - new Date(v.snippet.publishedAt))
            }`).join('\n')
        }`;
        await interaction.editReply(reply);
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
