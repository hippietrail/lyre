import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';

// SEAlang uses a self-signed certificate that throws an exception by default in fetch()
// So we turn off the NODE_TLS_REJECT_UNAUTHORIZED environment variable before and make
// sure we turn it back on afterwards no matter if the request succeeds, fails, or an exception is thrown
export async function seaLang(lang: string, word: string) {
    const childNum = lang === 'thai' ? 6 : 4;   // lao and vietnamese both use child #4

    const seaEarl = new Earl('https://sealang.net', `/${lang}/search.pl`, {
        'dict': lang,
        'hasFocus': 'orth',         // def, orth, phone
        'approx': '',
        'orth': word,
        'phone': '',
        'def': '',
        //'filedata': '',
        'matchEntry': 'any',
        'matchLength': 'word',      // syllable, whole, word
        'matchPosition': 'any',
        'anon': 'on',
        'ety': '',                  // Burmese, ...
        'pos': '',                  // C, ...
        'usage': '',                // imitative, ...
        'useTags': '1',
        'derivatives': 'always',    // never, ...
        'hyphenateSyls': '0',
        'redundantData': '0',
    });

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const dom = await (async () => {
        try {
            return await seaEarl.fetchDom();
        } catch (error) {
            console.error(`[SEALANG] ${word}:`, error);
            return null;
        }
    })();

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    if (dom) {
        const body = domStroll('sea', false, dom, [
            [4, 'html'],
            [3, 'body'],
        ])!;

        if (childNum in body.children! && body.children![childNum].type === 'text') {
            const lines = body.children![childNum].data!.trim().split('\n');

            if (lines.length > 0) {
                const matt = lines[0].trim().match(/^(Nothing|(\d+) items?) found/);

                if (matt) {
                    if (matt[1] === 'Nothing') return 0;
                    return Number(matt[2]);
                }
            }
        }
    }
    return null;
}
