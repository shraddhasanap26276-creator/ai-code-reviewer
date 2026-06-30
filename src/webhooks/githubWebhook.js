//localhost.run ssh -R 80:localhost:3000 nokey@localhost.run

//cloudflared tunnel --url http://localhost:3000
//localhost.run connnects github to yuor laptop server 

// Step 1 — Go to Downloads:    cd $env:USERPROFILE\Downloads
//  Step 2 — Check if file exists:   dir cloudflared*
// .\cloudflared.exe tunnel --url http://localhost:3000

//npm test
//npm run lint


const { fetchPRDiff } = require('../githubApi/fetchPRDiff');
const { reviewAndComment } = require('../llm/reviewCode');
const { queryRelevantCode } = require('../rag/embedCodebase');

async function handleWebhook(req, res) {

    console.log('🔔 Webhook endpoint hit!');

    const event = req.headers['x-github-event'];
    const payload = req.body;


    console.log(`📩 Received event: ${event}`);
    console.log(`📦 Action: ${payload.action}`);

    if (
        event === 'pull_request' &&
        (payload.action === 'opened' || payload.action === 'synchronize')
    ) {
        const prData = {
            owner: payload.repository.owner.login,
            repo: payload.repository.name,
            prNumber: payload.pull_request.number,
            title: payload.pull_request.title,
            prDescription: payload.pull_request.body || 'No description',
            baseBranch: payload.pull_request.base.ref,
        };

        console.log(`🔍 New PR detected: #${prData.prNumber} - ${prData.title}`);

        res.status(200).send('Processing...');

        processPR(prData);

    } else {
        console.log(`⏭️ Ignoring: ${event} - ${payload.action}`);
        res.status(200).send('Event ignored');
    }
}

async function processPR(prData) {
    try {
        console.log('⚙️ Starting PR processing...');

        const diff = await fetchPRDiff(prData);
        console.log(`📝 Fetched diff: ${diff.files.length} files changed`);

        const diffText = diff.files
            .map(f => `File: ${f.filename}\n${f.patch}`)
            .join('\n\n');

        const relevantCode = await queryRelevantCode(diffText, prData.repo);

        await reviewAndComment(prData, diff, relevantCode);

    } catch (error) {
        console.error('❌ Error processing PR:', error.message);
    }
}

module.exports = { handleWebhook };