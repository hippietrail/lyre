import { SlashCommandBuilder } from 'discord.js';

const pejorativeAdjectives = ['abominable', 'awful', 'damp', 'disgusting',
                              'distasteful', 'dreadful', 'fetid', 'filthy',
                              'foetid', 'fœtid', 'groß', 'horrendous',
                              'horrible', 'horrid', 'offensive', 'off-putting',
                              'pongy', 'putrid', 'rank', 'ripe', 'smelly',
                              'sour', 'stinky', 'terrible', 'uncalled-for',
                              'unhelpful', 'unjustifiable', 'unpleasant',
                              'unwarranted', 'whiffy', 'wretched', 'yucky',
                             ];

export const data = new SlashCommandBuilder()
    .setName('boddem')
    .setDescription('This is da boddem!');

export async function execute(interaction) {
    const randomIndex = Math.floor(Math.random() * pejorativeAdjectives.length);
  
    // Get the random pejorative adjective
    const randomAdjective = pejorativeAdjectives[randomIndex];
  
    await interaction.reply(randomAdjective + '!');
}






