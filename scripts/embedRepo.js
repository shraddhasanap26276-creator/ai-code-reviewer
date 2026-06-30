require('dotenv').config();
const { embedRepository } = require('../src/rag/embedCodebase');
const path = require('path');

const repoPath = process.argv[2] || process.cwd();
const namespace = process.argv[3] || 'default';

console.log(`🚀 Embedding repo: ${repoPath}`);

embedRepository(repoPath, namespace)
    .then(count => {
        console.log(`🎉 Done! ${count} chunks embedded`);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });