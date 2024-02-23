import 'source-map-support/register'
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { AutocompleteInteraction, ChatInputCommandInteraction, CommandInteraction, Interaction } from "discord.js";
import { ChannelType, MessageType } from 'discord.js';
// uncomment if you want to use DMs
// import { ChannelType, Partials } from 'discord.js';
import { config } from 'dotenv';
import * as wikt from './commands/wikt';
import * as curr from './commands/curr';
import * as github from './commands/github';
import * as yt from './commands/yt';
import * as tsoding from './commands/tsoding';
import * as etym from './commands/etym';
import * as latest from './commands/latest';
import * as thai from './commands/thai';
import * as isaword from './commands/isaword';
import * as ddg from './commands/ddg';
import * as es from './commands/es';
import * as fr from './commands/fr';
import * as dns from './commands/dns';
import * as lao from './commands/lao';

config();

const client = new Client({
    // Uncomment if you don't want to use DMs
    intents: [GatewayIntentBits.Guilds]

    // Uncomment if you want to use DMs
    // intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    // partials: [Partials.Channel, Partials.Message],

    // TODO to handle replies back from users
    //
    // alright, so starting with the intents you need, you need
    // Guilds, GuildMembers, GuildMessages for guild related events
    // and DirectMessages to receive messages in dms
    // then, for the "user triggers command - bot replies"
    // you dont need anything extra, just send the first reply,
    // after you send it you need to wait for a follow up message
    // from the user in your code,
    // use this https://old.discordjs.dev/#/docs/discord.js/main/class/TextChannel?scrollTo=awaitMessages
    //
    // dont forget the MessageContent intent
    //
    // true that one too, and you have to enable that one and
    // the GuildMembers one on the developer portal
    // and this should be inside your MessageCreate listener
    // for both, guilds and dm messages
    //
    // also just to add to this, you dont need to use the reply
    // functionality for this to work, just make sure you filter
    // messages in awaitMessages using the original user's id or
    // something so your bot doesn't accept replies from anyone
    // else in between
});

function readyDiscord() {
    console.log('☮️🤖 ' + client.user?.tag);
}

async function handleInteraction(interaction: Interaction) {
    if (interaction.isAutocomplete()) {
        await interactionAutocomplete(interaction);
    }
    else if (interaction.isCommand()) {
        await interactionCommand(interaction);
    }
}

async function interactionCommand(interaction: CommandInteraction) {
    switch (interaction.commandName) {
        case 'wikt':
            await wikt.execute(interaction as ChatInputCommandInteraction);
            break;
        case 'isaword':
            await wikt.execute2(interaction as ChatInputCommandInteraction);
            break;
        case 'define':
            await wikt.execute3(interaction as ChatInputCommandInteraction);
            break;

        case 'curr':
            await curr.execute(interaction as ChatInputCommandInteraction);
            break;
        case 'curr2':
            await curr.execute2(interaction as ChatInputCommandInteraction);
            break;
        case 'currplus':
            await curr.execute3(interaction as ChatInputCommandInteraction);
            break;
        case 'currdiff':
            await curr.execute4(interaction as ChatInputCommandInteraction);
            break;

        case 'github':
            await github.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'yt':
            await yt.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'tsoding':
            await tsoding.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'etym':
            await etym.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'latest':
            await latest.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'thai':
            await thai.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'isaword2':
            await isaword.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'ddg':
            await ddg.execute(interaction as ChatInputCommandInteraction);
            break;
        case 'ddgs':
            await ddg.execute2(interaction as ChatInputCommandInteraction);
            break;

        case 'es':
            await es.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'fr':
            await fr.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'dns':
            await dns.execute(interaction as ChatInputCommandInteraction);
            break;

        case 'lao':
            await lao.execute(interaction as ChatInputCommandInteraction);
            break;

        default:
        console.error(`Interaction Command: Unknown command ${interaction.commandName}`);
    }
}

async function interactionAutocomplete(interaction: AutocompleteInteraction) {
    switch (interaction.commandName) {
        case 'yt':
            await yt.autocomplete(interaction);
            break;

        default:
            console.error(`Interaction Autocomplete: Unknown command ${interaction.commandName}`);
    }
}

client.once(Events.ClientReady, readyDiscord);

client.login(process.env.TOKEN);

client.on(Events.InteractionCreate, handleInteraction);

client.on(Events.Debug, d => {
    if (d.includes('Heartbeat acknowledged')) return;
    console.log(`[DEBUG] ${d}`)
});

client.on(Events.ShardResume, id => console.log(`💎🔄 Shard ${id} resumed!`));

client.on(Events.Error, e => console.log(`[ERROR] ${JSON.stringify(e, null, 2)}`));

client.on(Events.Warn, w => console.log(`[WARN] ${w}`));

// trying out DMs

// when we receive a DM, including a private slash command
client.on(Events.MessageCreate, m => {
    console.log(`[MSG] mt ${MessageType[m.type]}. mct ${m.channel.type}, dm? ${m.channel.type === ChannelType.DM}. mat ${m.author.tag}. mc ${m.content}`);

    // HIPP experiment looking for replies
    // won't do anything without the extra intents etc in comment up above
    /*const foopy = m.channel.awaitMessages({
        filter: true,//m => m.author.id === '616866247002423327',
        max: 1,
        time: 10000,
        errors: ['time']
    });
    console.log(`[FOOPY] ${JSON.stringify(foopy, null, 2)}`);
    */
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
