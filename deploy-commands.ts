//@ts-nocheck
// Slash Commands Deployment Script
// https://discordjs.guide/creating-your-bot/command-deployment.html#guild-commands/

// Importing modules using ES6 syntax
import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';

config(); // Using dotenv config function directly

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter((file) => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
(async () => {
    for (const file of commandFiles) {
    let i = 0; const c = [];
    const command = await import(`./commands/${file}`); // Using dynamic import
    let n = 1;
    while (true) {
      const [data, execute] = ['data', 'execute'].map(k => `${k}${n > 1 ? n : ''}`);
      if (data in command && execute in command) {
        ++i; c.push(command[data].name);
        commands.push(command[data].toJSON());
        n++;
      } else if (data in command || execute in command) {
        console.log(`[WARNING] The command ${file} is missing a required "${data}" or "${execute}" property.`);
        break;
      } else {
        break;
      }
    }
    // note how many commands in this file
    console.log(`[INFO] Loaded ${i} commands from ${file}: ${c.join(', ')}`);
  }

  // Construct and prepare an instance of the REST module
  const rest = new REST().setToken(process.env.TOKEN);

  // and deploy your commands!
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands with the current set

    // In Discord terminology, "guild" and "server" are basically synonyms
    // So "SERVERID" from the .env file is "guildId" in the API
    const guildData = await rest.put(Routes.applicationGuildCommands(process.env.CLIENTID, process.env.SERVERID), {
      // empty because we want to remove our old guild commands now that we've switched to global commands that work in DMs
    });

    const data = await rest.put(Routes.applicationCommands(process.env.CLIENTID), {
        body: commands,
    });

    console.log(`Successfully reloaded ${guildData.length} guild application (/) commands, and ${data.length} global application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();