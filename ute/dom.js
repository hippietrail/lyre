
export function domStroll(site, debug, kids, data) {
    let node = null;
    for (const [i, datum] of data.entries()) {
        const [n, name, opts] = datum;
        //console.log(`n ${n} name ${name}${opts ? ` opts '${JSON.stringify(opts)}'` : ''}`);
        if (opts && typeof opts !== 'object')
            throw new Error(`[domStroll] ${site} opts must be an object`);

        if (debug) console.log(`[donStroll] ${site}#${i} ${
            kids.map(k => k.type === 'tag' ? `"tag.${k.name}"` : `"${k.type}"`).join(' ')
        }`);

        node = kids[n];

        if (!node || node.type !== 'tag' || node.name !== name ||
            (opts && opts.id && node.attribs.id !== opts.id) ||
            (opts && opts.cls && !node.attribs?.class?.includes(opts.cls))
        ) {
            if (!node) {
                if (opts && opts.optional)
                    return null;
                throw new Error(`[domStroll] ${site}#${i} not a node`);
            }
            if (node.type !== 'tag') throw new Error(`[domStroll] ${site}#${i} not a tag node`);
            if (node.name !== name) throw new Error(`[domStroll] ${site}#${i} not ${name}`);
            if (opts && opts.id && node.attribs.id !== opts.id) {
                throw new Error(`[domStroll] ${site}#${i} node id is not ${opts.id}`);
            }
            if (opts && opts.cls && !node.attribs?.class?.includes(opts.cls))
                throw new Error(`<${name}> has no .${opts.cls} class`);
            throw new Error(`not <${name}${opts && opts.cls ? `.${opts.cls}` : ''}>`);
        }

        if (opts) {
            let warn;
            const unsupportedOpts = Object.keys(opts).filter(opt => !['id', 'cls'].includes(opt));
            const uncheckedAtts = Object.keys(node.attribs).filter(attr => !['id', 'class'].includes(attr));
            if (unsupportedOpts.length > 0)
                warn = ['option(s)', '', unsupportedOpts.join(', ')];
            else if (uncheckedAtts.length > 0)
                warn = ['attribute(s)', '', uncheckedAtts.join(', ')];
            else if ('id' in node.attribs)
                if (!opts.id) warn = ['id', '#', node.attribs.id];
            else if ('class' in node.attribs)
                if (!opts.cls) warn = ['class', '.', node.attribs.class];
            if (warn) console.warn(`[domStroll] ${site}#${i}: ${node.name} ${warn[0]} ${warn[1]}${warn[2]} ignored?`);
        }

        kids = node.children;
    }

    return node;
}
