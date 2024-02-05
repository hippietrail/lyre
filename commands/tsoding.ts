// a new slash command that gets the latest Tsoding Daily YouTube videos
// *and* the latest GitHub activity by rexim
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { GithubEarl, YoutubeVidsEarl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';
import { config } from 'dotenv';

config();

export const data = new SlashCommandBuilder()
    .setName('tsoding')
    .setDescription('Latest from Tsoding');

export const execute = tsoding;

interface YtJsonData {
    items: {
        snippet: {
            resourceId: { videoId: string; };
            publishedAt: string;
            title: string;
        };
    }[];
}

interface GhJsonData {
    created_at: string;
    type: string;
    payload: { action: string };
    repo: { name: string }
}

async function tsoding(interaction: ChatInputCommandInteraction) {
    const NUM_TO_FETCH = 10;
    await interaction.deferReply();
    try {
        const earlYT = new YoutubeVidsEarl();
        earlYT.setMaxResults(NUM_TO_FETCH);
        earlYT.setPlaylistId('UUrqM0Ym_NbK1fqeQG2VIohg');

        const earlGH = new GithubEarl();
        earlGH.setUserName('rexim');
        earlGH.setPerPage(NUM_TO_FETCH);

        const [jsonYT, jsonGH] = await Promise.all([
            earlYT.fetchJson() as Promise<YtJsonData>,
            earlGH.fetchJson() as Promise<GhJsonData []>,
        ]);

        const ytObArr = jsonYT.items.map(v => ({
            type: 'YouTube',
            ts: new Date(v.snippet.publishedAt),
            info: `[${v.snippet.title}](<https://www.youtube.com/watch?v=${
                v.snippet.resourceId.videoId
            }>)`,
        }))

        const ghObArr = jsonGH.map(e => ({
            type: 'GitHub',
            ts: new Date(e.created_at),
            info: `${
                e.type.split(/(?=[A-Z])/).slice(0, -1).join(' ').toLowerCase()
            }${
                e.payload.action ? `.${e.payload.action}` : ''
            } [${e.repo.name}](<https://github.com/${e.repo.name}>)`,
        }))

        const sorted = [...ytObArr, ...ghObArr].toSorted((a, b) => +b.ts - +a.ts);

        const now = new Date();
        const reply = sorted.slice(0, NUM_TO_FETCH).map(v => `${
            v.type
        }: ${
            v.info
        } - ${
            ago(now.getTime() - new Date(v.ts).getTime())
        }`).join('\n');
        await interaction.editReply({ content: reply });
    } catch (error) {
        console.error('TSODING ERROR', error);
    }
}