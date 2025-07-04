import { Earl } from '../../ute/earl';
import { ago } from '../../ute/ago';

const githubTagsEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/tags');

const regexMajMinPatch = /^v?(\d+)\.(\d+)\.(\d+)$/
const regexVmajMinPatch = /^v(\d+)\.(\d+)\.(\d+)$/
const regexVmajMinOptPatch = /^v(\d+)\.(\d+)(?:\.(\d+))?$/;

const ownerRepos: [string, string, RegExp][] = [
    ['languagetool', 'languagetool-org/languagetool', regexVmajMinOptPatch],
    ['write good', 'btford/write-good', regexVmajMinPatch]
];

export async function callGithubTags(debug = false) {
    const result = [];

    // in debug mode, just take the first entry
    const chosenOwnerRepos = debug ? [ownerRepos[0]] : ownerRepos;

    for (const [i, repoEntry] of chosenOwnerRepos.entries()) {
        const ob = await callGithubTagsRepo(repoEntry[0], repoEntry[1], repoEntry[2]);
        console.log(`GitHub Tags [${i + 1}/${chosenOwnerRepos.length}] ${repoEntry[0]}`);
        result.push(ob);

        if (i < chosenOwnerRepos.length - 1)
            await new Promise(resolve => setTimeout(resolve, 4600)); // delay for GitHub API rate limit
    }

    return result;
}

type GitHubJval = string | GitHubJobj | GitHubJarr;

interface GitHubJobj {
  [x: string]: GitHubJval;
}

interface GitHubJarr extends Array<GitHubJval> {}

interface GitHubTags {
  name: string;
  commit: { url: string; };
}

interface GitHubRel {
    commit: {
        author: { date: string; };
        committer: { date: string; };
        [key: string]: any; // TODO fix 'any' type
    };
    html_url: string;
}

async function callGithubTagsRepo(name: string, ownerRepo: string, regex: RegExp) {
    githubTagsEarl.setPathname(`/repos/${ownerRepo}/tags`);

    let [ver, link, timestamp, src]: [string | null, string | null, number | null, string | null] = [null, null, null, 'github'];

    try {
        const ght = await githubTagsEarl.fetchJson() as GitHubJarr | GitHubJobj;

        if (!Array.isArray(ght)) {
            if (ght.message && ght.documentation_url) {
                console.log(`[${name}] GitHub tags API error: '${name}' ${ght.message} ${githubTagsEarl.getUrlString()}`);
                ver = 'GitHub API error T1';
            }
        } else {
            // TODO fix 'any' type
            const rel = ght.find((e: any) => new RegExp(regex).test(e.name)) as GitHubTags | undefined;
            
            if (rel) {
                const json = await (await fetch(rel.commit.url)).json() as GitHubJobj;

                if (json.message && json.documentation_url) {
                    console.log(`[${name}] GitHub tags API error: '${name}' ${json.message} ${rel.commit.url}`);
                    ver = 'GitHub API error T2';
                } else {
                    const jRel = json as unknown as GitHubRel;
                    // there is commit.author.date and commit.committer.date...
                    const [authorDate, committerDate] = ["author", "committer"].map(k => jRel.commit[k].date);
                    // print which is newer, and by how many seconds/minutes
                    // in the one I checked, the committer is newer by about 15 minutes
                    const [newer, older, diff, date] = committerDate > authorDate
                        ? ['committer', 'author', committerDate - authorDate, committerDate]
                        : ['author', 'committer', authorDate - committerDate, authorDate];

                    if (diff)
                        console.log(`[${name}] ${newer} is newer than ${older} by ${ago(diff).replace(' ago', '')} (diff: ${diff})`);

                    [ver, link, timestamp] = [rel.name, jRel.html_url, date];
                }
            } else {
                // TODO no tags found?
                console.log(`[${name}] No tags found`);
            }
        }
    } catch (error) {
        console.error(`[${name}]`, error);
    }

    return {
        name,
        ver,
        link,
        timestamp: timestamp ? new Date(timestamp) : null,
        src,
    };
}
