require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const { handleWebhook } = require('./webhooks/githubWebhook');
const { reviewAndComment } = require('./llm/reviewCode');
const { fetchPRDiff } = require('./githubApi/fetchPRDiff');
const { queryRelevantCode } = require('./rag/embedCodebase');

const app = express();
const PORT = process.env.PORT || 3000;

const reviewScores = new Map();

app.use(bodyParser.json({
    verify: (req, res, buf) => { req.rawBody = buf; }
}));

// ── Logger ──────────────────────────────────────────────
app.use((req, res, next) => {
    console.log(`📬 ${req.method} ${req.path}`);
    next();
});

app.get('/', (req, res) => {
    res.json({
        name: '🤖 AI Code Reviewer',
        status: 'running',
        endpoints: {
            health: 'GET /health',
            webhook: 'POST /webhook',
            trigger: 'POST /trigger-review',
            score: 'GET /score/:prNumber'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

app.post('/webhook', handleWebhook);

app.post('/trigger-review', async(req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.REVIEW_BOT_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { owner, repo, prNumber, title, baseBranch } = req.body;

    if (!owner || !repo || !prNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    res.json({ status: 'processing', prNumber });

    try {
        const prData = { owner, repo, prNumber, title, baseBranch };
        const diff = await fetchPRDiff(prData);
        const diffText = diff.files.map(f => `${f.filename}\n${f.patch}`).join('\n');
        const relevantCode = await queryRelevantCode(diffText, repo);
        const review = await reviewAndComment(prData, diff, relevantCode);


        if (review && review.score) {
            reviewScores.set(String(prNumber), review.score);
        }
    } catch (err) {
        console.error('❌ Review failed:', err.message);
    }
});

app.get('/score/:prNumber', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.REVIEW_BOT_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const score = reviewScores.get(req.params.prNumber) || 0;
    res.json({ score, prNumber: req.params.prNumber });
});

const server = app.listen(PORT, () => {
    console.log(`✅ AI Code Reviewer running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    server.close(() => process.exit(0));
});

module.exports = server;