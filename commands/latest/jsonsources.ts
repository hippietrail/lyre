//@ts-nocheck
import { Earl } from '../../ute/earl.js';

export async function callNodejs() {
    const nodejsEarl = new Earl('https://nodejs.org', '/dist/index.json');
    try {
        const rels = await nodejsEarl.fetchJson();

        return [
            rels.find(rel => rel.lts === false),
            rels.find(rel => typeof rel.lts === 'string')
        ].map(obj => ({
            name: `Node ${obj.lts === false ? '(Current)' : `'${obj.lts}' (LTS)`}`,
            ver: obj.version,
            link: undefined,
            timestamp: new Date(obj.date),
            src: 'nodejs.org',
        }));
    } catch (error) {
        console.error(`[Node.js]`, error);
    }
    return [];
}

export async function callGimp() {
    const gimpEarl = new Earl('https://gitlab.gnome.org',
        '/Infrastructure/gimp-web/-/raw/testing/content/gimp_versions.json', {
        'inline': false
    });
    try {
        const gj = await gimpEarl.fetchJson();

        if ('STABLE' in gj && gj.STABLE.length > 0 && 'version' in gj.STABLE[0]) {
            const ver = gj.STABLE[0].version;
            const date = new Date(gj.STABLE[0].date);
            return [{
                name: 'Gimp',
                ver: ver,
                link: `https://gitlab.gnome.org/GNOME/gimp/-/releases/GIMP_${gj.STABLE[0].version.replace(/\./g, '_')}`,
                // the day is not accurate for the news link. 2.10.36 is off by 2 days
                /*link: `https://www.gimp.org/news/${
                    date.getFullYear()
                }/${
                    date.getMonth() + 1
                }/${
                    date.getDate().toString().padStart(2, '0')
                }/gimp-${ver.replace(/\./g, '-')}-released`,*/
                timestamp: date,
                src: 'gitlab',
            }];
        }
    } catch (error) {
        console.error(`[Gimp]`, error);
    }
    return [];
}

export async function callXcode() {
    const xcodeEarl = new Earl('https://xcodereleases.com', '/data.json');
    try {
        const xcj = await xcodeEarl.fetchJson();

        const rel = xcj.find(obj => obj.name === 'Xcode' && obj.version.release.release === true);

        if (rel) {
            const timestamp = new Date(rel.date.year, rel.date.month - 1, rel.date.day);
            return [{
                name: 'Xcode',
                ver: rel.version.number,
                link: rel.links.notes.url,
                timestamp,
                src: 'xcodereleases.com',
            }/*, {
                name: 'Swift',
                ver: rel.compilers.swift[0].number,
                link: undefined,
                timestamp,
                src: 'xcodereleases.com',
            }*/];
        }
    } catch (error) {
        console.error(`[Xcode]`, error);
    }
    return [];
}

export async function callMame() {
    const mameEarl = new Earl('https://raw.githubusercontent.com', '/Calinou/scoop-games/master/bucket/mame.json');
    try {
        const mamej = await mameEarl.fetchJson();

        return [{
            name: 'MAME',
            ver: mamej.version,
            link: undefined,
            timestamp: undefined,
            src: 'githubusercontent.com',
        }];
    } catch (error) {
        console.error(`[MAME]`, error);
    }
    return [];
}

export async function callDart() {
    const dartEarl = new Earl('https://storage.googleapis.com', '/dart-archive/channels/stable/release/latest/VERSION');
    try {
        const dartj = await dartEarl.fetchJson();

        return [{
            name: 'Dart',
            ver: dartj.version,
            link: `https://github.com/dart-lang/sdk/releases/tag/${dartj.version}`,
            timestamp: new Date(dartj.date),
            src: 'googleapis.com',
        }];
    } catch (error) {
        console.error(`[Dart]`, error);
    }
    return [];
}

export async function callPhp() {
    const phpEarl = new Earl('https://www.php.net', '/releases/index.php');
    phpEarl.setSearchParam('json', '');
    try {
        const phpj = await phpEarl.fetchJson();
        // we get an object with a key for each major version number, in ascending order
        const latest = Object.values(phpj).pop();
        const maj = latest.version.match(/^(\d+)\.\d+\.\d+$/)[1];
        return [{
            name: 'PHP',
            ver: latest.version,
            link: `https://www.php.net/ChangeLog-${maj}.php#${latest.version}`,
            timestamp: new Date(latest.date),
            src: 'php.net',
        }];
    } catch (error) {
        console.error(`[PHP]`, error);
    }
    return [];
}
