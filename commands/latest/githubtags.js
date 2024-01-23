import { Earl } from '../../ute/earl.js';
import { ago } from '../../ute/ago.js';

const githubTagsEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/tags');

export async function callGithubTags(name, ownerRepo) {
    githubTagsEarl.setPathname(`/repos/${ownerRepo}/tags`);

    try {
        const ght = await githubTagsEarl.fetchJson();

        if (ght.message && ght.documentation_url) {
            console.log(`[${name}] GitHub tags API error: '${name}'${ght.message} ${ght.documentation_url}`);
        } else {
            const rel = ght.find(obj => obj.name.match(/^v(\d+)\.(\d+)\.(\d+)$/));

            // TODO if the 2nd fetch fails, use this link to the tag release:
            // TODO `https://github.com/python/cpython/releases/tag/${rel.name}`,
            // TODO but there is more human-friendly documentation at:
            // TODO https://docs.python.org/3.12/
            //
            // Note that though it mentions the full version number it only goes
            // on to cover the major/minor version: 3.12.1 vs 3.12
            //
            // > Python 3.12.1 documentation
            // > Welcome! This is the official documentation for Python 3.12.1.
            // >
            // > Parts of the documentation:
            // >
            // > What's new in Python 3.12?
            // > or all "What's new" documents since 2.0

            if (rel) {
                const json = await (await fetch(rel.commit.url)).json();

                // there is commit.author.date and commit.committer.date...
                const [authorDate, committerDate] = ["author", "committer"].map(k => new Date(json.commit[k].date));
                // print which is newer, and by how many seconds/minutes
                // in the one I checked, the committer is newer by about 15 minutes
                const [newer, older, diff, date] = committerDate > authorDate
                    ? ['committer', 'author', committerDate - authorDate, committerDate]
                    : ['author', 'committer', authorDate - committerDate, authorDate];

                if (diff)
                    console.log(`[${name}] ${newer} is newer than ${older} by ${ago(diff).replace(' ago', '')} (diff: ${diff})`);

                return [{
                    name: name,
                    ver: rel.name,
                    link: json.html_url,
                    timestamp: date,
                    src: 'github',
                }];
            }
        }
    } catch (error) {
        console.error(`[${name}]`, error);
    }
    return [];
}
