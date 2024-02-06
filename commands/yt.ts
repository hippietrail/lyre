import { AutocompleteInteraction, ChatInputCommandInteraction, CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { YoutubeVidsEarl } from '../ute/earl';
import { ago } from '../ute/ago';
import fs from 'node:fs';

interface ChannelVids {
    items: {
        snippet: {
            title: string;
            resourceId: {
                videoId: string
            },
            publishedAt: string
            channelTitle: string
        }
    }[]
};

let config: { [key: string]: string[] } = {};
let configTimestamp: number;

function maybeLoadOrReloadConfig() {
    if (fs.statSync('./config.json').mtimeMs !== configTimestamp) {
        console.log(`[YouTube] config ${configTimestamp === undefined ? 'not yet loaded' : 'has changed'}!`);
        try {
            config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
            console.log(`[YouTube] ${configTimestamp === undefined ? 'L' : 'Rel'}oaded config.json`);
            configTimestamp = fs.statSync('./config.json').mtimeMs;
        } catch (err) {
            console.error(`[YouTube] ${err}`);
        }
    }
}
  
const ytEarl = new YoutubeVidsEarl();
ytEarl.setMaxResults(10);

function fetchVideos(playlistId: string): Promise<ChannelVids> {
    ytEarl.setPlaylistId(playlistId);
    return ytEarl.fetchJson() as Promise<ChannelVids>;
}

export const data = new SlashCommandBuilder()
    .setName('yt')
    .setDescription('Latest from a group of YouTube channels')
    .addStringOption(option => option
        .setName('group')
        .setDescription('The name of the group')
        .setRequired(true)
        .setAutocomplete(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    const groupName: string = interaction.options.getString('group')!;

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

export async function autocomplete(interaction: AutocompleteInteraction) {
    maybeLoadOrReloadConfig();

    const foc = interaction.options.getFocused().toLowerCase();
    
    interaction.respond(
        ['all', ...Object.keys(config)]
        .filter(name => name
            .toLowerCase()
            .startsWith(foc))
        .sort()
        .map(name => ({ name, value: name }))
    );
}

async function yt(interaction: CommandInteraction, chanGroupName: string, chanList: Record<string, string>) {
    await interaction.deferReply();
    try {
        const now = new Date();

        const videoIdToHeadPromise: Record<string, Promise<Response>> = {};

        const allVids = (await Promise.all(Object.values(chanList).map(
            async (plid): Promise<ChannelVids> => await fetchVideos(plid)
        ))).map(chanVids => {
            chanVids.items.forEach(v => {
                videoIdToHeadPromise[v.snippet.resourceId.videoId] = fetch(
                    `https://www.youtube.com/shorts/${v.snippet.resourceId.videoId}`,
                    { method: 'HEAD', redirect: 'manual' }
                );
            })
            return chanVids.items
        }).flat();

        const videoIdToHeadStatus = await Promise.all(
            Object.entries(videoIdToHeadPromise).map(
                async ([videoId, headPromise]) => [videoId, (await headPromise).status]
            )
        ).then(Object.fromEntries);

        const reply = `${
            allVids
            .toSorted((a, b) => b.snippet.publishedAt.localeCompare(a.snippet.publishedAt))
            .filter(v => videoIdToHeadStatus[v.snippet.resourceId.videoId] !== 200)
            .slice(0, 10)
            .map(v => `${v.snippet.channelTitle}: [${
                v.snippet.title
            }](<https://www.youtube.com/watch?v=${
                v.snippet.resourceId.videoId
            }>) - ${
                ago(now.getTime() - new Date(v.snippet.publishedAt).getTime())
            }`)
            .join('\n')
        }`;
        await interaction.editReply(reply);
    } catch (error) {
        console.error(error);
        await interaction.editReply('An error occurred while fetching data.');
    }
}
