import { Earl } from '../../ute/earl';

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
