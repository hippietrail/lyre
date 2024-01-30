
export function domStroll(site, debug, kids, data) {
    let node = null;
    for (const [i, datum] of data.entries()) {
        const [n, name, opts] = datum;
        //console.log(`n ${n} name ${name}${opts ? ` opts '${JSON.stringify(opts)}'` : ''}`);
        if (opts && typeof opts !== 'object')
            throw new Error(`[domStroll] ${site} opts must be an object`);

        if (debug) kidsForStep(site, i, kids);

        node = kids[n];

        if (!node || node.type !== 'tag' || node.name !== name ||
            (opts && opts.id && node.attribs.id !== opts.id) ||
            (opts && opts.cls && !node.attribs?.class?.includes(opts.cls))
        ) {
            if (!node) {
                if (opts && opts.optional) return null;
                throw new Error(`[domStroll] ${site}#${i} not a node`);
            }
            if (node.type !== 'tag') {
                if (opts && opts.optional) return null;
                throw new Error(`[domStroll] ${site}#${i} not a tag node but a ${node.type}`);
            }
            if (node.name !== name) {
                if (opts && opts.optional) return null;
                throw new Error(`[domStroll] ${site}#${i} not ${name}`);
            }
            if (opts && opts.id && node.attribs.id !== opts.id) {
                if (opts && opts.optional) return null;
                throw new Error(`[domStroll] ${site}#${i} node id is not ${opts.id}`);
            }
            if (opts && opts.cls && !node.attribs?.class?.includes(opts.cls)) {
                if (opts && opts.optional) return null;
                throw new Error(`<${name}> has no .${opts.cls} class`);
            }
            throw new Error(`not <${name}${opts && opts.cls ? `.${opts.cls}` : ''}>`);
        }

        if (opts && opts.debug) {
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

function kidsForStep(site, st, kids) {
    console.log(`[domStroll] ${site}#${st} ${kids.map(
        k => k.type === 'tag'
            ? `<${k.name}${
                    k.attribs && k.attribs.id ? `#${k.attribs.id}` : ''
                }${
                    k.attribs && k.attribs.class ? `.${k.attribs.class.split(/\s+/).join('.')}` : ''
                }>`
            : `#${k.type}`
    ).join(' ')}`);
}
