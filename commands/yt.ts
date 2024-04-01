import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { RESTJSONErrorCodes } from 'discord.js';
import { YoutubeVidsEarl, Earl } from '../ute/earl';
import { ago } from '../ute/ago';
import fs from 'fs/promises';

export const data = new SlashCommandBuilder()
    .setName('yt')
    .setDescription('Latest from a group of YouTube channels')
    .addStringOption(option => option
        .setName('group')
        .setDescription('The name of the group')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option => option
        .setName('length')
        .setDescription('Long vs short videos')
        .addChoices(
            { name: 'long videos only', value: 'long' },
            { name: 'shorts only', value: 'short' },
            { name: 'all', value: 'all' },
            { name: 'all, and report which are shorts', value: 'all-short' },
        )
    );

// Type guard functions to check whether a PromiseSettledResult is PromiseRejectedResult or PromiseFulfilledResult
// They narrow the type of input
const isFulfilled = <t>(input: PromiseSettledResult<t>): input is PromiseFulfilledResult<t> => input.status === 'fulfilled';

export async function execute(interaction: ChatInputCommandInteraction) {
    const iid = interaction.id;

    try {
        await interaction.deferReply();
    } catch (e: any) {
        if (e.code === RESTJSONErrorCodes.UnknownInteraction)
            return console.log('[YT] deferReply UnknownInteraction due to laggy/bursty connection timeout');
        return console.log('[YT] deferReply error', e);
    }

    const group = interaction.options.getString('group') || '';
    const lenOpt = interaction.options.getString('length') || 'all';
    const config = await getConfig();
    const configData = config.data;

    if (configData.error) {
        console.log(`[YT] execute config error`, typeof configData.error, Object.keys(configData.error));
        return await interaction.editReply(`execute config error: ${config.error}.`).catch(e => editReplyFail(iid, e));
    }

    if (!configData[group] && group !== 'all')
        return await interaction.editReply(`'${group}' group not found.`).catch(editReplyFail(iid));

    const configGroup: Record<string, string> = group !== 'all' && group !== '*'
        ? configData[group]
        : Object.values(configData).reduce((a, b) => ({ ...a, ...b }));

    const groupChannelNames = Object.keys(configGroup);

    if (groupChannelNames.length === 0)
        return await interaction.editReply(`'${group}' empty group.`).catch(editReplyFail(iid));

    const channelIDs = Object.values(configGroup);

    const selectedVids = await processChannels(channelIDs, lenOpt);

    const ytreply = formatReply(selectedVids, lenOpt);

    if (ytreply === '')
        return await interaction.editReply('No videos found').catch(e => editReplyFail(iid, e));

    return await interaction.editReply(ytreply).catch(e => editReplyFail(iid, e));
}

interface ChannelVids {
    items: {
        snippet: {
            publishedAt: string; // format: "2024-01-20T15:42:16Z"
            channelId: string;
            title: string;
            channelTitle: string;
            resourceId: { videoId: string; };
        };
    }[];
    error?: { // Add the error property here
        message: string;
    };
};

interface VidInfo {
    channelTitle: string;
    id: string;
    timestamp: number;
    title: string;
}

async function processChannels(channelIDs: string[], lenOpt: string) {
    const earl = new YoutubeVidsEarl();
    earl.setMaxResults(10);

    const allVideos = (await fetchChannels(channelIDs, earl))
        .map((fr, num) => {
            const items = 'items' in fr.value ? (fr.value as ChannelVids).items : [];
            return items
                .map(i => ({
                    channelTitle: i.snippet.channelTitle,
                    id: i.snippet.resourceId.videoId,
                    timestamp: Date.parse(i.snippet.publishedAt),
                    title: i.snippet.title
                }) as VidInfo)
        })
        .flat().sort((a, b) => b.timestamp - a.timestamp);

    // select long or short videos, which requires a HTTP HEAD request each
    return await selectVideos(allVideos, lenOpt);
}

async function fetchChannels(channelIDs: string[], earl: YoutubeVidsEarl, maxRetries = 5): Promise<PromiseFulfilledResult<ChannelVids>[]> {
    const requestedIDCount = channelIDs.length;
    let retryCount = 1;
    const results: PromiseFulfilledResult<ChannelVids>[] = [];

    do {
        const channelPromises = channelIDs.map(chid => earl.fetchPlaylistById(chid));
        
        const settledResults = await Promise.allSettled(channelPromises) as PromiseSettledResult<ChannelVids>[];
        const fulfilledResults = settledResults.filter(isFulfilled);
        
        const retryIDs = channelIDs.filter((_, idx) => !isFulfilled(settledResults[idx]));
        console.log(`[YT] idsToRetry: ${JSON.stringify(retryIDs)}`);
        const errorIDs = channelIDs.filter((_, idx) => isFulfilled(settledResults[idx]) && 'error' in (settledResults[idx] as PromiseFulfilledResult<ChannelVids>).value);
        console.log(`[YT] errorIDs: ${JSON.stringify(errorIDs)}`);

        results.push(...fulfilledResults);

        channelIDs = channelIDs.filter((_, idx) => !isFulfilled(settledResults[idx]));
        retryCount++;
    } while (channelIDs.length > 0 && retryCount <= maxRetries);

    console.log(`[YT] fetched ${results.length} of ${requestedIDCount} channel IDs after ${retryCount - 1} retries`);

    return results;
}

interface VidRedirPair {
    vid: VidInfo;
    isRedir?: boolean;
}

function getChannelNameByID(id: string) {
    return Object.values(cachedConfig.data)
        .map(gr => Object.entries(gr))
        .flat()
        .find(ch => ch[1] === id)![0];
}

function formatReply(selectedVids: VidRedirPair[], lenOpt: string) {
    const len = (r?: boolean) => r === true ? 'Long' : r === false ? 'Short' : '???';
    const now = Date.now();

    const vidMap = selectedVids.map(({ vid: v, isRedir: r }) => `${
        lenOpt === 'all' ? ''
            : `(${len(r)}) `}${v.channelTitle}: [${v.title}](<${
                `https://www.youtube.com/watch?v=${v.id}`
            }>) - ${ago(now - v.timestamp)}`
    );

    return vidMap.join('\n');
}

interface VidRedirTriple {
    vid: VidInfo;
    redirProm: Promise<boolean | undefined>;
    isRedir?: boolean;
}

async function selectVideos(vids: VidInfo[], lenOpt: string, maxRetries: number = 3): Promise<VidRedirPair[]> {
    const selectedVids = new Array<VidRedirPair>();

    let [settledNum, fulfilledNum, rejectedNum] = [0, 0, 0];

    // chunk loop
    let chunkNum = 1;
    let retryCount = 0;
    for (let offset = 0; offset < vids.length; offset += 10) {
        const chunk = vids.slice(offset, offset + 10);

        const vidsWithRedirFlag: VidRedirTriple[] = chunk.map(v => ({ vid: v, redirProm: checkRedir(v) }));

        let badOnes: VidRedirTriple[] = [];
        let retryNum = 1;

        while (true) {
            console.log(`[YT] redir check chunk ${chunkNum} try ${retryNum}`);
            await Promise.allSettled(vidsWithRedirFlag.map(v => v.redirProm.then(r => v.isRedir = r)));

            badOnes = vidsWithRedirFlag.filter(v => v.isRedir === undefined);
            if (badOnes.length > 0) {
                console.log(`[YT] ${badOnes.length} redirection checks failed!`);
                console.log((`${badOnes.map(v => `[YT]   ${v.vid.channelTitle} :: ${v.vid.title}`).join('\n')}`));
                if (retryNum >= maxRetries) {
                    console.log(`[YT] check redirs max retries reached!`);
                    break;
                }
            } else {
                console.log(`[YT] all ${vidsWithRedirFlag.length} redir checks succeeded`);
                break;
            }

            console.log(`[YT] retrying ${badOnes.length} redirection checks`);
            vidsWithRedirFlag.forEach(v => { if (v.isRedir === undefined) v.redirProm = checkRedir(v.vid) });
            retryNum++;
            retryCount++;
        }

        settledNum += vidsWithRedirFlag.length;
        rejectedNum += badOnes.length;
        fulfilledNum += settledNum - badOnes.length;

        const vidsWeWant = vidsWithRedirFlag.filter(v => doWeWantIt(lenOpt, v.isRedir));

        selectedVids.push(...vidsWeWant.slice(0, 10 - selectedVids.length).map(v => ({ vid: v.vid, isRedir: v.isRedir })));

        if (selectedVids.length >= 10)
            break;

        chunkNum++;
    }

    console.log(`[YT] selected ${selectedVids.length} of ${settledNum} total, ${fulfilledNum} fulfilled, ${rejectedNum} rejected, after ${retryCount} retries`);

    return selectedVids;
}

function checkRedir(v: VidInfo) {
    const earlR = new Earl('https://www.youtube.com', '/shorts/');
    earlR.setLastPathSegment(v.id);
    return earlR.checkRedirect();
}

function doWeWantIt(lenOpt: string, r?: boolean): boolean {
    if (lenOpt === 'long')
        return r !== false;
    if (lenOpt === 'short')
        return r !== true;
    // for all and all-short we want everything
    return true;
}

const editReplyFail = (iid: string, e?: any) => () => console.log('[YT] execute editReply error', iid, e);

export async function autocomplete(interaction: AutocompleteInteraction) {
    const foc = interaction.options.getFocused().toLowerCase();
    const config = await getConfig();
    if (config.error)
        console.error(`[YT] autocomp config error`, typeof config.error, Object.keys(config.error));
    const configDataKeys = Object.keys(config.data);

    const response = ['all', ...configDataKeys]
        .filter(key => key.toLowerCase().startsWith(foc))
        //.sort()
        .map(key => ({ name: key, value: key }));

    await interaction.respond(response).catch(() => console.log('[YT] autocomp respond error'));
}

interface Config {
    data: Record<string, Record<string, string>>;
    timestamp: number;
    error?: any;
}

let cachedConfig: Config = { data: {}, timestamp: 0 };
async function getConfig(): Promise<Config> {
    try {
        const timestamp = (await fs.stat('config.json')).mtimeMs;
        if (cachedConfig.timestamp === timestamp)
            return cachedConfig;

        const jsonText = await fs.readFile('config.json', 'utf8');
        const data = JSON.parse(jsonText);
        cachedConfig = { data, timestamp };
        return cachedConfig;
    } catch (error) {
        cachedConfig = { data: {}, timestamp: 0, error };
        return cachedConfig;
    }
}
