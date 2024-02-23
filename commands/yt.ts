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

// const elap = (startTime: number) => new Date().getTime() - startTime;

const isRejected = <t>(input: PromiseSettledResult<t>): input is PromiseRejectedResult => input.status === 'rejected';
const isFulfilled = <t>(input: PromiseSettledResult<t>): input is PromiseFulfilledResult<t> => input.status === 'fulfilled';

export async function execute(interaction: ChatInputCommandInteraction) {
    const iid = interaction.id;
    console.log('[YT] execute defer', iid);

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
        return await interaction.editReply(`execute config error: ${config.error}.`).catch(editReplyFail(iid));
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

    const earlYtv = new YoutubeVidsEarl();
    earlYtv.setMaxResults(10);

    const channelPromises = channelIDs.map(id => earlYtv.fetchPlaylistById(id));

    const settled = await Promise.allSettled(channelPromises);

    const fulfilled = settled.filter(isFulfilled);
    const rejected = settled.filter(isRejected);

    // This represents the "items" array from the "value" field of the JSON
    // returned by the YouTube API. Note that it represents an arbitrary
    // playlist rather than a Channel. This is the standard way to query a
    // channel's videos - just like any playlist. For this reason there is
    // no channel title field. But each video has a channel title field.
    // The official name of the whole JSON is probably "playlistItemListResponse"
    // https://developers.google.com/youtube/v3/docs/playlistItems/list
    // The other fields were:
    /*interface YouTubePlaylistJSON {
        status: string;
        value: {
            kind: string;
            etag: string;
            nextPageToken: string;
            items: ChannelVids;
            pageInfo: {
                totalResults: number;
                resultsPerPage: number;
            }            
        }
    }*/
    interface ChannelVids /* JSON playlist.value */ {
        // kind, etag, nextPageToken
        items: {
            // kind: string;
            // etag: string;
            // id: string;
            snippet: {
                publishedAt: string;    // format: "2024-01-20T15:42:16Z"
                // channelId: string;
                title: string;
                // description: string;
                // thumbnail: { /* default, medium, high, standard, maxres */ };
                channelTitle: string;
                // playlistId: string;
                // position: number;
                resourceId: {
                    // kind: string;
                    videoId: string;
                };
                // videoOwnerChannelTitle: string;
                // videoOwnerChannelId: string;
            }
        }[]
        // pageInfo
    };

    interface MyVidStruct {
        channelTitle: string;
        id: string;
        timestamp: number;
        title: string;
    }

    // map ChannelVids to an array of MyVidStruct
    const groupChannelVids = fulfilled
        .map(fr => fr.value as ChannelVids)
        .map(cv => cv.items
            .map(i => ({
                channelTitle: i.snippet.channelTitle,
                id: i.snippet.resourceId.videoId,
                timestamp: Date.parse(i.snippet.publishedAt),
                title: i.snippet.title
            }) as MyVidStruct)
        )
        .flat().sort((a, b) => b.timestamp - a.timestamp);

    const now = Date.now();

    // start at the beginning, check each video to seee if it's a short by whether there's a redirect via HTTP HEAD
    const earlR = new Earl('https://www.youtube.com', '/shorts/');

    const selectedVids = Array<[MyVidStruct, boolean | undefined]>();
    let [redirsChecked, redirsTrue, redirsFalse, redirsUndef] = [0, 0, 0, 0];

    for (const v of groupChannelVids) {
        earlR.setLastPathSegment(v.id);
        const rr = lenOpt === 'all' ? undefined : await earlR.checkRedirect();
        
        redirsChecked++;
        if (rr === true)
            redirsTrue++;
        else if (rr === false)
            redirsFalse++;
        else if (rr === undefined)
            redirsUndef++;

        if (doWeWantIt(lenOpt, rr))
            selectedVids.push([v, rr]);

        if (selectedVids.length >= 10)
            break;
    }

    const len = (r: boolean | undefined) => r === true ? 'Long' : r === false ? 'Short' : '???';

    const vidMap = selectedVids.map(([v, r]) => `${
        lenOpt === 'all' ? '' : `(${len(r)}) `
    }${v.channelTitle}: [${v.title}](<${
        `https://www.youtube.com/watch?v=${v.id}`
    }>) -  ${ago(now - v.timestamp)}`);

    console.log(`redirsChecked: ${redirsChecked}, redirsTrue: ${redirsTrue}, redirsFalse: ${redirsFalse}, redirsUndef: ${redirsUndef}`);

    console.log(`${fulfilled.length} fulfilled, ${rejected.length} rejected`);
    if (rejected.length)
        console.error('rejected[0]', rejected[0]);
    
    const ytreply = vidMap.join('\n');

    return await interaction.editReply(ytreply).catch(editReplyFail(iid));
}

function doWeWantIt(lenOpt: string, r: boolean | undefined): boolean {
    if (lenOpt === 'long')
        return r !== false;
    if (lenOpt === 'short')
        return r !== true;
    // for all and all-short we want everything
    return true;
}

const editReplyFail = (iid: string) => () => console.log('[YT] execute editReply error', iid);

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
