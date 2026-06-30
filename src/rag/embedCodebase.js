const { Pinecone } = require('@pinecone-database/pinecone');

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

// ─── Get Embedding using fetch (free, no API key needed) ────
async function getEmbedding(text) {
    const response = await fetch(
        'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                inputs: text.slice(0, 512),
                options: { wait_for_model: true }
            }),
        }
    );

    const data = await response.json();

    // Average pooling — convert to single vector
    if (Array.isArray(data[0])) {
        const avg = data[0][0].map((_, i) =>
            data[0].reduce((sum, row) => sum + row[i], 0) / data[0].length
        );
        return avg;
    }

    return data[0];
}

// ─── Chunk code into small pieces ───────────────────────────
function chunkCode(content, filename, chunkSize = 40) {
    const lines = content.split('\n');
    const chunks = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
        const chunkLines = lines.slice(i, i + chunkSize);
        chunks.push({
            text: chunkLines.join('\n'),
            filename,
            startLine: i + 1,
            endLine: i + chunkLines.length,
        });
    }

    return chunks;
}

// ─── Embed entire repository ─────────────────────────────────
async function embedRepository(repoPath, namespace) {
    console.log(`📚 Embedding repo: ${repoPath}`);

    const fs = require('fs');
    const path = require('path');
    const glob = require('glob');

    const index = pinecone.index(process.env.PINECONE_INDEX);

    const files = glob.sync('**/*.{js,ts,jsx,tsx,py,java}', {
        cwd: repoPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
        absolute: true,
    });

    console.log(`📁 Found ${files.length} files`);

    let totalChunks = 0;
    let batch = [];

    for (const filePath of files) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(repoPath, filePath);

            if (!content.trim() || content.length > 50000) continue;

            const chunks = chunkCode(content, relativePath);

            for (const chunk of chunks) {
                const embedding = await getEmbedding(
                    `File: ${chunk.filename}\n\n${chunk.text}`
                );

                batch.push({
                    id: `${relativePath}-${chunk.startLine}`.replace(/[^a-zA-Z0-9-_]/g, '_'),
                    values: embedding,
                    metadata: {
                        filename: chunk.filename,
                        startLine: chunk.startLine,
                        endLine: chunk.endLine,
                        text: chunk.text,
                    },
                });

                if (batch.length >= 50) {
                    await index.namespace(namespace).upsert(batch);
                    totalChunks += batch.length;
                    console.log(`⬆️ Uploaded ${totalChunks} chunks...`);
                    batch = [];
                }
            }
        } catch (err) {
            console.error(`⚠️ Skipped: ${err.message}`);
        }
    }

    if (batch.length > 0) {
        await index.namespace(namespace).upsert(batch);
        totalChunks += batch.length;
    }

    console.log(`✅ Embedded ${totalChunks} chunks!`);
    return totalChunks;
}

// ─── Query relevant code for PR diff ────────────────────────
async function queryRelevantCode(diffText, namespace) {
    console.log('🔍 Querying relevant code...');

    try {
        const index = pinecone.index(process.env.PINECONE_INDEX);

        const queryEmbedding = await getEmbedding(diffText.slice(0, 512));

        const results = await index.namespace(namespace).query({
            vector: queryEmbedding,
            topK: 5,
            includeMetadata: true,
        });

        const relevantChunks = results.matches.map(match => ({
            filename: match.metadata.filename,
            startLine: match.metadata.startLine,
            endLine: match.metadata.endLine,
            code: match.metadata.text,
            score: match.score,
        }));

        console.log(`✅ Found ${relevantChunks.length} relevant chunks`);
        return relevantChunks;

    } catch (err) {
        console.error('⚠️ RAG query failed:', err.message);
        return [];
    }
}

module.exports = { embedRepository, queryRelevantCode };