import { Earl } from '../ute/earl';
import { domStroll } from '../ute/dom';

export async function etym(word: string): Promise<[boolean | null, string]> {
    try {
        const earl = new Earl('https://etymonline.com', '/word/');
        earl.setLastPathSegment(word!);

        const lg17 = domStroll('etym', false, await earl.fetchDom(), [
            [3, 'html'],
            [3, 'body'],
            [1, 'div', { id: 'root' }],
            [0, 'div'],                                 // TODO: 'data-role' attribute - add att feature to domStroll opts?
            [0, 'div', { cls: 'container--1mazc' }],
            [1, 'div', { cls: 'main' }],                // TODO: attK: 'data-role', attV: 'content-main'
            [0, 'div', { cls: 'ant-row-flex' }],
            [0, 'div', { cls: 'ant-col-lg-17' }],
        ])!;

        // if the children are [h2, p, p] then the word is not in etymonline
        if (['h2', 'p', 'p'].every((tagName, i) => lg17.children![i].name === tagName)) {
            return [null, 'Not in Etymonline'];
        } else {
            const wordNodes = lg17.children!.filter(node => node.name === 'div' && node.attribs?.class?.includes('word--C9UPa'));

            const [verb, suffix] = wordNodes.length === 1 ? ['is', ''] : ['are', 's'];
            let resultString = `[there ${verb} ${wordNodes.length} word section${suffix}.](${earl.getUrlString()})`;
            let resultBool: boolean | null = null;

            const words = [...new Set(wordNodes
                .map(node => node.children![0].children![0])
                .map(node => node.children!.find(child => child.attribs?.class?.includes('word__name--TTbAA')))
                .map(node => node!.children![0].data))];

            // is at least one of the words a case-insensitive match?
            console.log(`[ute/etym] ${word} words: ${words}`);
            if (words.some(w => w!.toLowerCase() === word!.toLowerCase())) {
                resultBool = true;
                if (words.length !== 1) {
                    resultString += `\nat least one of ${words.map(node => `'${node}'`).join(', ')} matches '${word}'.`;
                }
            } else {
                if (words.length === 1) {
                    resultString += `\nbut '${words[0]}' does not match '${word}'!`;
                    resultBool = false;
                } else {
                    resultString += `\nbut none of ${words.map(node => `'${node}'`).join(', ')} match '${word}'!`;
                    resultBool = false;
                }
            }
            return [resultBool, resultString];
        }
    } catch (e) {
        console.error(e);
        return [null, 'An error occurred while fetching data.'];
    }
}  
