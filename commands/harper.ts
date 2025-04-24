import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
// TODO: use harperjs is it import or require and inside { these } or not?

export const data = new SlashCommandBuilder()
    .setName('lint')
    .setDescription('Lint English text for spelling and grammar')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('Text to lint')
            .setRequired(true)
    );

export const execute = lint;

async function lint(interaction: ChatInputCommandInteraction) {
    const hjs = await import('harper.js');
    await interaction.deferReply();

    const text = interaction.options.getString('text')!;

    const linter = new hjs.LocalLinter({ binary: hjs.binary });

    const lints = await linter.lint(text);

    const lintText = lints.map(lint => lint.message()).join('\n');
  
    await interaction.editReply(lintText);
}