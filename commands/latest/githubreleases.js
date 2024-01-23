import { Earl } from '../../ute/earl.js';

const githubReleasesEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');

// GitHub JSON name field is 'name version'
const xformNameSplit = (_, jn, __) => jn.split(' ');

// Repo name is name, version is GitHub JSON tag
const xformRepoTag = (ro, _, jt) => [ro.split('/')[1], jt];

// Repo name capitalized is name, version is GitHub JSON tag
function xformRepoCapTag(ro, _, jt) {
    // console.log(`[xformRepoCapTag]`, ro, jt);
    const rn = ro.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jt];
}

// Repo name capitalized is name, version is GitHub JSON tag with _ converted to .
function xformRepoCapTagVersionUnderscore(ro, _, jt) {
    // console.log(`[xformRepoCapTagVersionUnderscore]`, ro, jt);
    const rn = ro.split('/')[1];
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
        const nvlts = githubJsonToNVLTS(repoEntry, ob);
        result.push(nvlts);

        if (i < ownerRepos.length - 1)
            await new Promise(resolve => setTimeout(resolve, 4600)); // delay for GitHub API rate limit
    }
    return result;
}

function githubJsonToNVLTS(repoEntry, jsonObj) {
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

function xformRepoNameTagVer(repo, jsonOb) {
    const [githubOwnerRepo, xform] = repo;
    const [jsonName, jsonTag] = [jsonOb.name, jsonOb.tag_name];

    if (xform) {
        return xform(githubOwnerRepo, jsonName, jsonTag);
    } else {
        console.log(`Unrecognized repo: ${githubOwnerRepo}, name: ${jsonName}, tag: ${jsonTag}`);
        return ['?name?', '?ver?'];
    }
}
