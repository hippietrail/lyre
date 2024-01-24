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
for (const file of commandFiles) {
  let i = 0; const c = [];
  const command = await import(`./commands/${file}`); // Using dynamic import
  if ('data' in command && 'execute' in command) {
    ++i; c.push(command.data.name);
    commands.push(command.data.toJSON());

    if ('data2' in command && 'execute2' in command) {
      ++i; c.push(command.data2.name);
      commands.push(command.data2.toJSON());

      if ('data3' in command && 'execute3' in command) {
        ++i; c.push(command.data3.name);
        commands.push(command.data3.toJSON());

        if ('data4' in command && 'execute4' in command) {
          ++i; c.push(command.data4.name);
          commands.push(command.data4.toJSON());

          if ('data5' in command && 'execute5' in command) {
            ++i; c.push(command.data5.name);
            commands.push(command.data5.toJSON());

            if ('data6' in command && 'execute6' in command) {
              ++i; c.push(command.data6.name);
              commands.push(command.data6.toJSON());
            }
          }
        }
      }
    }
    // note how many commands in this file
    console.log(`[INFO] Loaded ${i} commands from ${file}: ${c.join(', ')}`);
  } else {
    console.log(`[WARNING] The command ${file} is missing a required "data" or "execute" property.`);
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN);

// and deploy your commands!
(async () => {
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