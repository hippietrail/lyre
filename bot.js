import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import * as wikt from './commands/wikt.js';
import * as curr from './commands/curr.js';
import * as github from './commands/github.js';
import * as yt from './commands/yt.js';

config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

function readyDiscord() {
    console.log('🤖 ' + client.user.tag);
}

async function handleInteraction(interaction) {
    if (!interaction.isCommand()) return;

    switch (interaction.commandName) {
        case 'wikt':
            await wikt.execute(interaction);
            break;
        case 'isaword':
            await wikt.execute2(interaction);
            break;
        case 'wiktx':
            await wikt.execute3(interaction);
            break;

        case 'curr':
            await curr.execute(interaction);
            break;

        case 'github':
            await github.execute(interaction);
            break;

        case 'youtube':
            await yt.execute(interaction);
            break;
        case 'retro':
            await yt.execute2(interaction);
            break;

        default:
            console.error(`Unknown command ${interaction.commandName}`);
        }
}

client.once(Events.ClientReady, readyDiscord);

client.login(process.env.TOKEN);

client.on(Events.InteractionCreate, handleInteraction);

client.on('debug', d => console.log(`[DEBUG] ${d}`));

client.on('shardResume', () => console.log(`💎🔄 Shard resumed!`));

client.on('error', e => console.log(`[ERROR] ${JSON.stringify(e, null, 2)}`));