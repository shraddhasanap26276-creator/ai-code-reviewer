const { Octokit } = require('@octokit/rest');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

// Posts general comment on PR
async function postPRComment({ owner, repo, prNumber, comment }) {
    console.log(`💬 Posting comment on PR #${prNumber}...`);

    await octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: comment,
    });

    console.log('✅ Comment posted successfully!');
}

// Posts inline comment on specific line
async function postInlineComment({
    owner,
    repo,
    prNumber,
    commitSha,
    filename,
    line,
    comment,
}) {
    await octokit.pulls.createReviewComment({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: commitSha,
        path: filename,
        line: line,
        body: comment,
    });
}

module.exports = { postPRComment, postInlineComment };