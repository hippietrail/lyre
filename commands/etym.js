// a new slash command that checks if a word in in Etymonline
import { SlashCommandBuilder } from 'discord.js';
import { Earl } from '../ute/earl.js';
import parse from 'html-dom-parser';

export const data = new SlashCommandBuilder()
    .setName('etym')
    .setDescription('Check if a word in in Etymonline')
    .addStringOption(option => option.setName('word').setDescription('word to check').setRequired(true));

export const execute = etym;

async function etym(interaction) {
    await interaction.deferReply();
    try {
        const earl = new Earl('https://etymonline.com', '/word/');
        earl.setLastPathSegment(interaction.options.getString('word'));
        const dommy = parse(await earl.fetchText());

        const whatWeFound = lookForClass(dommy, 'ant-col-lg-17', 0);

        console.log(`lookForClass: ${JSON.stringify(whatWeFound, null, 2)}`);

        let reply = '???';
        switch (whatWeFound) {
            case 404:
                reply = "Not found";
                break;
            case 'FOUND':
                reply = "Found";
                break;
            case 'FOUND2':
                reply = "Found (2)";
                break;
        }
        await interaction.editReply(`${reply}: ${earl.getUrlString()}`);
    } catch (e) {
        console.error(e);
        await interaction.editReply('An error occurred while fetching data.');
    }
}

function exploreEtymonlineDom(stuffs, startDepth, maxDepth) {
    if (maxDepth === undefined) maxDepth = 8;

    for (const [index, n] of stuffs.entries()) {
        printNode(n, startDepth, index);
        if (
            'children' in n &&
            'name' in n &&
            ['div', 'html', 'body'].includes(n.name) &&
            startDepth < maxDepth
        ) {
            exploreEtymonlineDom(n.children, startDepth + 1, maxDepth);
        }
    }
}
  
function lookForClass(stuffs, className, depth) {
    const notFound = [404, ['h2', 'p', 'p']];
    const found = ['FOUND', ['div', 'div', 'div', 'div', 'div', 'div', 'p', 'div']];
    const found2 = ['FOUND2', ['div', 'div', 'div', 'div', 'div', 'div', 'div', 'div', 'p', 'div']];

    function cmp(node, childrenNames, matchKids) {
        return node.children.length === matchKids.length && childrenNames.every(n => matchKids.includes(n));
    }

    for (const node of stuffs) {
        if ('children' in node && 'name' in node && ['div', 'html', 'body'].includes(node.name)) {
            if (node.attribs.class?.includes(className)) {
                console.log(`Found ${className} at depth ${depth}`);
                console.log(node.children.map(c => c.name));
                const kidNodeNames = node.children.map(c => c.name);

                let matchIndex = -1;
                [notFound, found, found2].some((tup, index) => {
                    if (cmp(node, kidNodeNames, tup[1])) {
                        matchIndex = index;
                        return true;
                    }
                    return false;
                });

                if (matchIndex !== -1)
                    return [notFound, found, found2][matchIndex][0];

                console.log('Did not find any known pattern of child nodes here');
                exploreEtymonlineDom(node.children, depth + 1);

                // remove the child nodes for ad content, they have an 'data-ad-container' attribute
                console.log(node.children.filter(c => !('data-ad-container' in c.attribs)).map(c => `${c.name} ${c.attribs.class}`));
            }
            const result = lookForClass(node.children, className, depth + 1);
            if (result !== null) return result;
        }
    }
    return null;
}

function printNode(node, depth, index) {
    if (node.type === 'text' && node.data.trim() === '') return;
    if (node.type === 'script') return;

    if (node.type !== 'tag') {
        console.log(`${
            ' '.repeat(depth)
        } ${`[${depth}.${index}] `}type: ${
            node.type
        }${
            node.name ? `, name: ${node.name}` : ''
        } [ ${Object.keys(node).join(', ')} ]`
        );
    } else {
        console.log(`${' '.repeat(depth)} ${`[${depth}.${index}] `}<${node.name}>`);
    }

    if ('attribs' in node && Object.keys(node.attribs).length > 0) {
        if (node.attribs.id)
            console.log(`${' '.repeat(depth+1+6)}#`, node.attribs.id);
        if (node.attribs.class)
            console.log(`${' '.repeat(depth+1+5)}`, node.attribs.class.split(' ').map((c) => `.${c}`));

        // if there are attribs/attributes other than 'id' and/or 'class', we can print them
        const others = Object.keys(node.attribs).filter((key) => !['id', 'class'].includes(key));
        if (others.length > 0)
            console.log(`${' '.repeat(depth+1+6)}@@`, others.map((key) => `${key}: ${node.attribs[key]}`).join(', '));
    }

    if (node.type === 'text')
        console.log(`${' '.repeat(depth+1)}'"""'${node.data.trim()}'"""'`);
}
