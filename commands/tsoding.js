// a new slash command that gets the latest Tsoding Daily YouTube videos
// *and* the latest GitHub activity by rexim
import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import { ago } from '../ute/ago.js';
import { config } from 'dotenv';

config();

export const data = new SlashCommandBuilder()
    .setName('tsoding')
    .setDescription('Latest from Tsoding');

export const execute = tsoding;

async function tsoding(interaction) {
    const NUM_TO_FETCH = 10;
    await interaction.deferReply();
    try {
        const earlYT = new Earl('https://www.googleapis.com', '/youtube/v3/playlistItems', {
            part: 'snippet',
            maxResults: '10',
            order: 'date',
            key: process.env.YT_API_KEY,
            playlistId: 'UUrqM0Ym_NbK1fqeQG2VIohg',
        });
        const earlGH = new Earl('https://api.github.com', 'users/rexim/events/public', {
            per_page: 10,
        });

        const [jsonYT, jsonGH] = await Promise.all([earlYT.fetchJson(), earlGH.fetchJson()]);

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

        const sorted = [...ytObArr, ...ghObArr].sort((a, b) => b.ts - a.ts);

        const now = new Date();
        const reply = sorted.slice(0, NUM_TO_FETCH).map(v => `${
            v.type
        }: ${
            v.info
        } - ${
            ago(now - new Date(v.ts))
        }`).join('\n');
        await interaction.editReply({ content: reply });
    } catch (error) {
        console.error('TSODING ERROR', error);
    }
}