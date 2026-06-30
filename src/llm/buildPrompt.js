function buildReviewPrompt(diff, relevantCode, prData) {

    const changedFiles = diff.files.map(file => `
### File: ${file.filename} (${file.status})
\`\`\`diff
${file.patch}
\`\`\`
`).join('\n');

    const codebaseContext = relevantCode.length > 0 ?
        relevantCode.map(chunk => `
### Related: ${chunk.filename} (lines ${chunk.startLine}-${chunk.endLine})
\`\`\`
${chunk.code}
\`\`\`
`).join('\n') :
        'No additional codebase context available.';

    return `
You are a senior software engineer doing a thorough code review.
You have deep knowledge of best practices, security, performance, and clean code.

## PR Information
- Title: ${prData.title}
- Description: ${prData.prDescription || 'No description'}
- Files changed: ${diff.files.length}
- Lines added: +${diff.totalAdditions}
- Lines removed: -${diff.totalDeletions}

## Code Changes (Diff)
${changedFiles}

## Relevant Existing Codebase Context
${codebaseContext}

## Your Task
Review the code changes above. Respond ONLY with a valid JSON object in this exact format, nothing else, no markdown fences:

{
  "summary": "2-3 sentence overall summary of what this PR does",
  "score": 85,
  "approved": true,
  "issues": [
    {
      "severity": "critical",
      "filename": "example.js",
      "line": 1,
      "title": "Short issue title",
      "description": "Detailed explanation",
      "suggestion": "How to fix it"
    }
  ],
  "positives": ["Good thing 1", "Good thing 2"],
  "securityConcerns": [],
  "performanceConcerns": []
}

Scoring guide:
- 90-100: Excellent, approve immediately
- 70-89: Good, minor issues only
- 50-69: Needs work
- Below 50: Major problems

Be specific and constructive.
`;
}

module.exports = { buildReviewPrompt };