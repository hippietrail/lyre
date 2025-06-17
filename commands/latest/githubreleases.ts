import { Earl } from '../../ute/earl';

const githubReleasesEarl = new Earl('https://api.github.com', '/repos/OWNER/REPO/releases/latest');

// GitHub JSON name field is 'name version'
const xformRepoName_Tag = (gor: string, _: string, jtn: string, ___?: string) => [gor.split('/')[1], jtn];

// Repo name is name, version is GitHub JSON tag
const xformRepoName_Name = (gor: string, jn: string, __: string, ___?: string) => [gor.split('/')[1], jn];

// Repo name capitalized is name, version is GitHub JSON tag
function xformRepoNameCap_Tag(gor: string, _: string, jtn: string, ___?: string) {
    const rn = gor.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jtn];
}

// Repo name capitalized is name, version is GitHub JSON tag with _ converted to .
function xformRepoNameCap_TagUnderscoreToDot(gor: string, _: string, jtn: string, ___?: string) {
    const rn = gor.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jtn.replace(/_/g, '.')];
}

// Repo name is name, version is GitHub JSON name
function xformRepoNameCap_NameSecondWord(gor: string, jn: string, _: string, ___?: string) {
    const rn = gor.split('/')[1];
    return [rn.charAt(0).toUpperCase() + rn.slice(1), jn.split(' ')[1]];
}

// Repo name is name, version is each word in GitHub JSON name (split by space)
const xformName_SplitSpace = (_: string, jn: string, __: string, ___?: string) => jn.split(' ');

// Fixed name is provided as extra argument, version is GitHub JSON tag
const xformFixedName_Tag = (_: string, __: string, jtn: string, x?: string) => [x!, jtn];

// Fixed name is provided as extra argument, version is the part after ': ' in GitHub JSON name
const xformFixedName_NameColonSplit = (_: string, jn: string, __: string, x?: string) => [x!, jn.split(': ')[1]];

interface GithubJson {
    name: string;
    tag_name: string;
    published_at: string;
    html_url: string;
}

type StringFunctionTuple = [string, (gor: string, jn: string, jtn: string, x?: string) => string[], string?];

const ownerRepos: StringFunctionTuple[] = [
    ['Automattic/harper', xformRepoNameCap_Tag],
    ['Automattic/harper-obsidian-plugin', xformRepoName_Name],
    ['biomejs/biome', xformRepoNameCap_NameSecondWord],
    ['blopker/codebook', xformRepoNameCap_Tag],
    ['casey/just', xformRepoNameCap_Tag],
    ['discordjs/discord.js', xformRepoNameCap_Tag],
    ['helix-editor/helix', xformRepoNameCap_Tag],
    ['jasmine/jasmine', xformFixedName_Tag, 'Jasmine'],
    ['microsoft/TypeScript', xformRepoName_Tag],
    ['microsoft/vscode', xformFixedName_Tag, 'VS Code'],
    ['microsoft/vscode-vsce', xformFixedName_Tag, '@vscode/vsce'],
    ['neovim/neovim', xformRepoNameCap_Tag],
    ['neovim/nvim-lspconfig', xformRepoName_Tag],
    ['nodejs/node', xformFixedName_Tag, "Node.js"],
    ['oven-sh/bun', xformName_SplitSpace],
    ['rust-lang/rust', xformRepoNameCap_Tag],
    ['Stef16Robbe/harper_zed', xformRepoName_Name],
    ['streetsidesoftware/vscode-spell-checker', xformFixedName_NameColonSplit, 'Code Spell Checker'],
    ['typst/typst', xformRepoNameCap_Tag],
    ['unicode-org/icu', xformName_SplitSpace],
    ['zed-industries/zed', xformRepoName_Tag],
];

export async function callGithubReleases(debug = false) {
    const result = [];

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
    const [githubOwnerRepo, xform, extra] = repo;
    const [jsonName, jsonTagName] = [jsonOb.name, jsonOb.tag_name];

    if (xform) {
        return xform(githubOwnerRepo, jsonName, jsonTagName, extra);
    }
    // for newly added repos, output the name and version so we can see which
    // transform it should use, or if we need a new one
    const name = `${githubOwnerRepo} (GitHub owner/repo) / ${jsonName} (JSON name)`;
    const ver = `${jsonTagName} (JSON tag)`;
    console.log(`[GitHub] New repo: ${name} / ${ver}`);
    return [name, ver];
}
