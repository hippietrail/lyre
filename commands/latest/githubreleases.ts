import { Earl } from '../../ute/earl';

const githubReleasesEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');

// GitHub JSON name field is 'name version'
const xformNameSplit = (_: string, jn: string, __: string) => jn.split(' ');

// Repo name is name, version is GitHub JSON tag
const xformRepoTag = (gor: string, _: string, jt: string) => [gor.split('/')[1], jt];

// Repo name capitalized is name, version is GitHub JSON tag
function xformRepoCapTag(gor: string, _: string, jt: string) {
    // console.log(`[xformRepoCapTag]`, gor, jt);
    const rn = gor.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt];
}

// Repo name capitalized is name, version is GitHub JSON tag with _ converted to .
function xformRepoCapTagVersionUnderscore(gor: string, _: string, jt: string) {
    // console.log(`[xformRepoCapTagVersionUnderscore]`, gor, jt);
    const rn = gor.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt.replace(/_/g, '.')];
}

// Repo name is name, version is GitHub JSON name
function xformRepoName(gor: string, jn: string, __: string) {
    return [gor.split('/')[1], jn];
}

interface GithubJson {
    name: string;
    tag_name: string;
    published_at: string;
    html_url: string;
}

// do we need a Record or a type or an interface for these string/function tuples?
type StringFunctionTuple = [string, (gor: string, jn: string, jt: string) => string[]];

const ownerRepos: StringFunctionTuple[] = [
    ['discordjs/discord.js', xformRepoCapTag],
    ['microsoft/TypeScript', xformRepoTag],
    ['nodejs/node', (_: string, __: string, jt: string) => ['Node (Current)', jt]],
    ['oven-sh/bun', xformNameSplit],
    ['rust-lang/rust', xformRepoCapTag],
    ['unicode-org/icu', xformNameSplit],
    ['zed-industries/zed', xformRepoTag],
];

export async function callGithubReleases(debug = false) {
    let result = [];

    // in debug mode, just take the first entry
    const chosenOwnerRepos = debug ? [ownerRepos[0]] : ownerRepos;

    for (const [i, repoEntry] of chosenOwnerRepos.entries()) {
        // console.log(`[callGithub] i: ${i}, owner/repo: ${repoEntry[0]}`);
        githubReleasesEarl.setPathname(`/repos/${repoEntry[0]}/releases/latest`);
        const ob = await githubReleasesEarl.fetchJson() as GithubJson;
        console.log(`GitHub Rels [${i + 1}/${chosenOwnerRepos.length}] ${repoEntry[0]}`);
        const vi = githubJsonToVersionInfo(repoEntry, ob);
        result.push(vi);

        if (i < chosenOwnerRepos.length - 1)
            await new Promise(resolve => setTimeout(resolve, 4600)); // delay for GitHub API rate limit
    }
    return result;
}

function githubJsonToVersionInfo(repoEntry: StringFunctionTuple, jsonObj: GithubJson) {
    // if ob has just the two keys "message" and "documentation_url"
    // we've hit the API limit or some other error
    let [name, ver, link, timestamp, src]: [
        string | null,
        string | null,
        string | null,
        Date | null,
        string
    ] = [null, null, null, null, 'github'];

    if ('message' in jsonObj && 'documentation_url' in jsonObj) {
        console.log(`GitHub releases API error: ${jsonObj.message} ${jsonObj.documentation_url}`);
        [name, ver] = [repoEntry[0], 'GitHub API error R'];
    } else try {
        [name, ver] = xformRepoNameTagVer(repoEntry, jsonObj);
        [link, timestamp] = [jsonObj.html_url, new Date(jsonObj.published_at)];
    } catch (error) {
        // console.error("<<<", error);
        // console.log(JSON.stringify(ob, null, 2));
        // console.log(">>>");
    }
    return {
        name,
        ver,
        link,
        timestamp,
        src,
    };
}

// Call the appropriate xform function for the repo
// to get the [name, version] tuple in the right format.
// Depending on the repo, the xform function might
// derive either field from the GitHub owner and repo names
// or from the name and tag fields in the JSON.
// Will call one of: xformNameSplit, xformRepoTag, xformRepoCapTag, etc
function xformRepoNameTagVer(repo: StringFunctionTuple, jsonOb: GithubJson) {
    const [githubOwnerRepo, xform] = repo;
    const [jsonName, jsonTag] = [jsonOb.name, jsonOb.tag_name];

    if (xform) {
        return xform(githubOwnerRepo, jsonName, jsonTag);
    }
    // for newly added repos, output the name and version so we can see which
    // transform it should use, or if we need a new one
    const name = `${githubOwnerRepo} (GitHub owner/repo) / ${jsonName} (JSON name)`;
    const ver = `${jsonTag} (JSON tag)`;
    console.log(`[GitHub] New repo: ${name} / ${ver}`);
    return [name, ver];
}
