import { Earl } from '../../ute/earl';
import { domStroll, DomNode } from '../../ute/dom';
import parse from 'html-dom-parser';

export async function callHarper() {
    const harperEarl = new Earl('https://writewithharper.com', '/latestversion');
    try {
        const resp = await harperEarl.fetchText();

        return [{
            name: "Harper",
            ver: resp,
            link: null,
            timestamp: null,
            src: 'writewithharper.com'
        }];
    } catch (error) {
        console.error(`[Harper]`, error);
    }
    return [];
}