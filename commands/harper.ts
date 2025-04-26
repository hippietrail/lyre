import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

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

    // Check for experimental command: --option rest of the text
    const match = text.match(/^--(\w+)\s+([\s\S]*)/);
    if (match) {
        const [_, command, rest] = match;
        if (command === 'old') {
            const lintyText = await linter.lint(rest)
            .then(lints => lints
                .map(lint => lint.suggestions()
                    .map(s => {
                        const [[prob_txt, prob_is_ws], [repl_txt, repl_is_ws]] = [lint.get_problem_text(), s.get_replacement_text()].map(s => {
                            const is_ws = /^\s+$/.test(s);
                            const maybe_quoted = is_ws ? `"${s}"` : s;
                            return [maybe_quoted, is_ws];
                        });
                        return `${prob_txt} → ${repl_txt}${prob_is_ws || repl_is_ws ? ` ${lint.message()}` : ''}`;
                    })
                    .join('\n') || `${lint.get_problem_text()} → ?`)
                .join('\n')
            );
            return await interaction.editReply(lintyText || '👍');
        }
        return await interaction.editReply('😕');
    }

    const lintyText = await linter.lint(text)
    .then(lints => lints
        .map(lint => `${lint.lint_kind()}: ${lint.get_problem_text()} → ${lint.suggestion_count() === 0 ? '?' : lint.suggestions()
            .map(s => {
                const [[repl_txt, repl_is_ws]] = [s.get_replacement_text()].map(s => {
                    const is_ws = /^\s+$/.test(s);
                    const maybe_quoted = is_ws ? `"${s}"` : s;
                    return [maybe_quoted, is_ws];
                });
                return `${repl_txt}${repl_is_ws ? ` ${lint.message()}` : ''}`;
            })
            .join(' | ')}`)
        .join('\n')
    );

    return await interaction.editReply(lintyText || '👍');
}