const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

async function fetchPRDiff({ owner, repo, prNumber }) {
    console.log(`📡 Fetching PR diff for #${prNumber}...`);

    // 1. Get list of changed files
    const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
    });

    // 2. Get PR details
    const { data: prDetails } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
    });

    // 3. Structure files nicely
    const structuredFiles = files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch || '',
        rawUrl: file.raw_url,
    }));

    // 4. Filter out files we don't need to review
    const reviewableFiles = structuredFiles.filter(
        file => !shouldSkipFile(file.filename)
    );

    console.log(`✅ ${reviewableFiles.length} reviewable files found`);

    return {
        files: reviewableFiles,
        prDescription: prDetails.body || 'No description provided',
        totalAdditions: prDetails.additions,
        totalDeletions: prDetails.deletions,
    };
}

function shouldSkipFile(filename) {
    const skipPatterns = [
        /package-lock\.json/,
        /yarn\.lock/,
        /\.png$/,
        /\.jpg$/,
        /\.svg$/,
        /node_modules\//,
        /dist\//,
        /build\//,
        /\.env/,
    ];

    return skipPatterns.some(pattern => pattern.test(filename));
}

module.exports = { fetchPRDiff };