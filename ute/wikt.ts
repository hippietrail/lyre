import { Earl } from '../ute/earl';

interface WikiApiJson {
    query: {
        pages: [
            {
                pageid?: unknown,
                missing?: unknown,
            }
        ]
    }
}

export async function wikt(wikiLang: string, word: string) {
    const wiktEarl = new Earl(`https://${wikiLang}.wiktionary.org`, '/w/api.php', {
        'action': 'query',
        'format': 'json',
        'titles': word
    });
    try {
        const data = await wiktEarl.fetchJson() as WikiApiJson;

        if (Object.keys(data.query.pages).length === 1) {
            const page = Object.values(data.query.pages)[0];
            
            if ('pageid' in page) return 1;
            else if ('missing' in page) return 0;
        }
    } catch (error) {
        console.error(`[wikt]`, error);
    }
    
    return null;
}
