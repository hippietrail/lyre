import { Client, Events, GatewayIntentBits } from 'discord.js';
// uncomment if you want to use DMs
// import { ChannelType, Partials } from 'discord.js';
import { config } from 'dotenv';
import * as wikt from './commands/wikt.js';
import * as curr from './commands/curr.js';
import * as github from './commands/github.js';
import * as yt from './commands/yt.js';
import * as tsoding from './commands/tsoding.js';

config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
    // Uncomment if you want to use DMs
    // intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    // partials: [Partials.Channel, Partials.Message],
});

function readyDiscord() {
    console.log('☮️🤖 ' + client.user.tag);
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
        case 'define':
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

        case 'tsoding':
            await tsoding.execute(interaction);
            break;

        default:
            console.error(`Unknown command ${interaction.commandName}`);
        }
}

client.once(Events.ClientReady, readyDiscord);

client.login(process.env.TOKEN);

client.on(Events.InteractionCreate, handleInteraction);

client.on(Events.Debug, d => console.log(`[DEBUG] ${d}`));

client.on(Events.ShardResume, id => console.log(`💎🔄 Shard ${id} resumed!`));

client.on(Events.Error, e => console.log(`[ERROR] ${JSON.stringify(e, null, 2)}`));

// trying out DMs

// when we receive a DM, including a private slash command
client.on(Events.MessageCreate, m => {
    // m.type 0 = Default, m.type 20 = ChatInputCommand
    console.log(`[MSG] mt ${m.type}. mct ${m.channel.type}, dm? ${m.channel.type === ChannelType.DM}. mat ${m.author.tag}. mc ${m.content}`)
});

// experiment with sending a message from the bot to the channel. let's do it on the shardresume...
client.on(Events.ShardReady, async id => {
    console.log(`[SHARD] Shard ${id} ready!`);
    
    // send a message to a channel - this works
    // client.channels.cache.get('1182601817704628304').send('Full disclosure: I\'m a bot.');

    // send DMs - these work
    // this way works
    // const ht = await client.users.fetch('616866247002423327');
    // //console.log(`[HT] ${JSON.stringify(ht, null, 2)}`);
    // await ht.send("Hi boss!");

    // this way also works - what's the difference?
    // const htDM = await ht.createDM();
    // //console.log(`[HT-DM] ${JSON.stringify(htDM, null, 2)}`);
    // await htDM.send("Hi boss! 2");
});
