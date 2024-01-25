import { Earl } from '../../ute/earl.js';

const githubReleasesEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');

// GitHub JSON name field is 'name version'
const xformNameSplit = (_, jn, __) => jn.split(' ');

// Repo name is name, version is GitHub JSON tag
const xformRepoTag = (gor, _, jt) => [gor.split('/')[1], jt];

// Repo name capitalized is name, version is GitHub JSON tag
function xformRepoCapTag(gor, _, jt) {
    // console.log(`[xformRepoCapTag]`, gor, jt);
    const rn = gor.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt];
}

// Repo name capitalized is name, version is GitHub JSON tag with _ converted to .
function xformRepoCapTagVersionUnderscore(gor, _, jt) {
    // console.log(`[xformRepoCapTagVersionUnderscore]`, gor, jt);
    const rn = gor.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt.replace(/_/g, '.')];
}

const ownerRepos = [
    ['apple/swift', xformNameSplit],
    ['audacity/audacity', xformNameSplit],
    ['discordjs/discord.js', xformRepoCapTag],
    /*['elixir-lang/elixir', xformRepoCapTag],*/
    ['JetBrains/kotlin', xformNameSplit],
    ['llvm/llvm-project', xformNameSplit],
    ['lua/lua', xformNameSplit],
    ['mamedev/mame', xformNameSplit],
    ['microsoft/TypeScript', xformRepoTag],
    ['NationalSecurityAgency/ghidra', xformNameSplit],
    ['nodejs/node', (_, __, jt) => ['Node (Current)', jt]],
    ['odin-lang/Odin', (_, __, jt) => ['Odin', jt]],
    ['oven-sh/bun', xformNameSplit],
    ['rakudo/rakudo', xformRepoCapTag],
    /*['ruby/ruby', xformRepoCapTagVersionUnderscore],*/
    ['rust-lang/rust', xformRepoCapTag],
    ['ziglang/zig', xformRepoCapTag],
];

export async function callGithubReleases() {
    let result = [];

    for (const [i, repoEntry] of ownerRepos.entries()) {
        // console.log(`[callGithub] i: ${i}, owner/repo: ${repoEntry[0]}`);
        githubReleasesEarl.setPathname(`/repos/${repoEntry[0]}/releases/latest`);
        const ob = await githubReleasesEarl.fetchJson();
        console.log(`GitHub Rels [${i + 1}/${ownerRepos.length}] ${repoEntry[0]}`);
        const vi = githubJsonToVersionInfo(repoEntry, ob);
        result.push(vi);

        if (i < ownerRepos.length - 1)
            await new Promise(resolve => setTimeout(resolve, 4600)); // delay for GitHub API rate limit
    }
    return result;
}

function githubJsonToVersionInfo(repoEntry, jsonObj) {
    // if ob has just the two keys "message" and "documentation_url"
    // we've hit the API limit or some other error
    if ('message' in jsonObj && 'documentation_url' in jsonObj) {
        console.log(`GitHub releases API error: ${jsonObj.message} ${jsonObj.documentation_url}`);
    } else try {
        const [name, version] = xformRepoNameTagVer(repoEntry, jsonObj);

        return {
            name,
            ver: version,
            link: jsonObj.html_url,
            timestamp: new Date(jsonObj.published_at),
            src: 'github',
        };
    } catch (error) {
        // console.error("<<<", error);
        // console.log(JSON.stringify(ob, null, 2));
        // console.log(">>>");
    }
    return null;
}

// Call the appropriate xform function for the repo
// to get the [name, version] tuple in the right format.
// Depending on the repo, the xform function might
// derive either field from the GitHub owner and repo names
// or from the name and tag fields in the JSON.
// Will call one of: xformNameSplit, xformRepoTag, xformRepoCapTag, etc
function xformRepoNameTagVer(repo, jsonOb) {
    const [githubOwnerRepo, xform] = repo;
    const [jsonName, jsonTag] = [jsonOb.name, jsonOb.tag_name];

    if (xform) {
        return xform(githubOwnerRepo, jsonName, jsonTag);
    } else {
        // for newly added repos, output the name and version so we can see which
        // transform it should use, or if we need a new one
        const name = `${githubOwnerRepo} (GitHub owner/repo) / ${jsonName} (JSON name)`;
        const ver = `${jsonTag} (JSON tag)`;
        console.log(`[GitHub] New repo: ${name} / ${ver}`);
        return [name, ver];
    }
}
