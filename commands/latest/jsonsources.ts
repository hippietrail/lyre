import { Earl } from '../../ute/earl';

// ============================================================================
// HARPER-CORE
// ============================================================================

interface HarperCratesIoJsonEntry {
    vers: string;
    pubtime: string;
}

export async function callHarperCore() {
    const harperEarl = new Earl('https://index.crates.io', '/ha/rp/harper-core');
    try {
        const text = await harperEarl.fetchText();
        const lines = text.split('\n');
        const lastEntry = JSON.parse(lines[lines.length - 2]) as HarperCratesIoJsonEntry;
        return [
            {
                name: 'harper-core',
                ver: lastEntry.vers,
                link: undefined,
                timestamp: new Date(lastEntry.pubtime),
                src: 'crates.io',
            },
        ];
    } catch (error) {
        console.error(`[harper-core]`, error);
    }
    return [];
}

// ============================================================================
// NODE.JS
// ============================================================================

interface Rel {
    lts: false | string;
    version: string;
    date: string;
}

export async function callNodejs() {
    const nodejsEarl = new Earl('https://nodejs.org', '/dist/index.json');
    try {
        const rels = await nodejsEarl.fetchJson() as Rel[];

        return [
            rels.find(rel => rel.lts === false),
            rels.find(rel => typeof rel.lts === 'string')
        ].map(obj => ({
            name: `Node ${obj!.lts === false ? '(Current)' : `'${obj!.lts}' (LTS)`}`,
            ver: obj!.version,
            link: undefined,
            timestamp: new Date(obj!.date),
            src: 'nodejs.org',
        }));
    } catch (error) {
        console.error(`[Node.js]`, error);
    }
    return [];
}
