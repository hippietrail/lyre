import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import * as wikt from './commands/wikt.js';
import * as curr from './commands/curr.js';

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

        case 'audthb':
            await curr.execute(interaction);
            break;
        case 'thbaud':
            await curr.execute2(interaction);
            break;
        case 'audlak':
            await curr.execute3(interaction);
            break;
        case 'lakaud':
            await curr.execute4(interaction);
            break;
        case 'curr':
            await curr.execute5(interaction);
            break;
            
        default:
            console.error(`Unknown command ${interaction.commandName}`);
        }
}

client.once(Events.ClientReady, readyDiscord);

client.login(process.env.TOKEN);

client.on(Events.InteractionCreate, handleInteraction);

client.on('debug', d => console.log(`[DEBUG] ${d}`));

// I don't think this actually does anything - maybe should be 'shardResume'??
client.on('resume', () => console.log(`🔄 Resumed!`));

client.on('shardResume', () => console.log(`💎🔄 Shard resumed!`));

client.on('error', e => console.log(`[ERROR] ${JSON.stringify(e, null, 2)}`));