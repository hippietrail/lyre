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
    .setName('yt')
    .setDescription('Latest from a group of YouTube channels')
    .addStringOption(option => option
        .setName('group')
        .setDescription('The name of the group')
        .setRequired(true)
    );

export const execute = ytParamArg;

async function ytParamArg(interaction) {
    const groupName = interaction.options.getString('group');

    const chanList = groupName in config
        ? config[groupName]
        : groupName === 'all' || groupName === '*'
            ? Object.values(config).reduce((a, b) => ({ ...a, ...b }), {})
            : null;

    if (!chanList)
        await interaction.reply(`No group of YouTube channels by the name '${groupName}'`);
    else if (Object.keys(chanList).length === 0)
        await interaction.reply(`No channels in group '${groupName}'`);
    else
        await yt(interaction, groupName, chanList);
}

async function yt(interaction, chanGroupName, chanList) {
    await interaction.deferReply();
    try {
        const now = new Date();

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
