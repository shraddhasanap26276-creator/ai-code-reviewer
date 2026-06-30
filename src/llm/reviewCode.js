const { buildReviewPrompt } = require('./buildPrompt');
const { postPRComment } = require('../githubApi/postComment');

// ─── MOCK MODE — Simulates AI review without API cost ──────
// Set to false when you have paid API credits
const MOCK_MODE = true;

// ─── Generate realistic mock review based on actual diff ───
function generateMockReview(diff) {
    const files = diff.files.map(f => f.filename);
    const hasSecurityKeywords = diff.files.some(f =>
        /password|secret|token|key|api/i.test(f.patch || '')
    );

    const issues = [];

    if (hasSecurityKeywords) {
        issues.push({
            severity: 'warning',
            filename: files[0],
            line: 1,
            title: 'Potential sensitive data exposure',
            description: 'Detected keywords related to credentials. Ensure no secrets are hardcoded.',
            suggestion: 'Use environment variables for any sensitive values instead of hardcoding them.',
        });
    }

    const score = hasSecurityKeywords ? 72 : 88;

    return {
        summary: `This PR modifies ${files.length} file(s): ${files.join(', ')}. The changes appear focused and follow the existing project structure.`,
        score,
        approved: score >= 70,
        issues,
        positives: [
            'Changes are scoped and focused',
            'No unrelated files modified',
            'Follows existing project conventions',
        ],
        securityConcerns: hasSecurityKeywords ? ['Review any hardcoded credentials before merging'] : [],
        performanceConcerns: [],
    };
}

// ─── Call Claude (Primary) ───────────────────────────────
async function callClaude(prompt) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    console.log('🤖 Calling Claude...');
    const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
}

// ─── Call GPT-4 (Fallback) ───────────────────────────────
async function callGPT4(prompt) {
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log('🤖 Calling GPT-4 (fallback)...');
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
    });

    return response.choices[0].message.content;
}

// ─── Parse LLM JSON Response ─────────────────────────────
function parseReview(rawResponse) {
    try {
        const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
    } catch (err) {
        console.error('⚠️ Failed to parse LLM response');
        return {
            summary: 'Could not parse AI review properly.',
            score: 50,
            approved: false,
            issues: [],
            positives: [],
            securityConcerns: [],
            performanceConcerns: [],
        };
    }
}

// ─── Format into GitHub Comment ──────────────────────────
function formatComment(review) {
    const scoreEmoji =
        review.score >= 90 ? '🟢' :
        review.score >= 70 ? '🟡' :
        review.score >= 50 ? '🟠' : '🔴';

    const approvalBadge = review.approved ?
        '✅ **APPROVED**' :
        '🔄 **CHANGES REQUESTED**';

    const severityEmoji = { critical: '🚨', warning: '⚠️', suggestion: '💡' };

    const issuesSection = (review.issues || []).length === 0 ?
        '_No issues found!_ 🎉' :
        review.issues.map(issue => `
#### ${severityEmoji[issue.severity] || '💡'} ${issue.title}
- **File:** \`${issue.filename}\` ${issue.line ? `(line ${issue.line})` : ''}
- **Issue:** ${issue.description}
- **Fix:** ${issue.suggestion}
`).join('\n');

  const positivesSection = (review.positives || []).length === 0
    ? '_Keep it up!_'
    : review.positives.map(p => `- ✅ ${p}`).join('\n');

  const securitySection = (review.securityConcerns || []).length === 0
    ? '- ✅ No security concerns found'
    : review.securityConcerns.map(s => `- 🔒 ${s}`).join('\n');

  const perfSection = (review.performanceConcerns || []).length === 0
    ? '- ✅ No performance concerns found'
    : review.performanceConcerns.map(p => `- ⚡ ${p}`).join('\n');

  return `
# 🤖 AI Code Review

${approvalBadge} &nbsp; ${scoreEmoji} **Score: ${review.score}/100**

## 📋 Summary
${review.summary}

---

## 🐛 Issues Found (${(review.issues || []).length})
${issuesSection}

---

## 👍 What's Good
${positivesSection}

---

## 🔒 Security
${securitySection}

## ⚡ Performance
${perfSection}

---
<sub>🤖 Reviewed by AI Code Reviewer | Claude + GPT-4 fallback | RAG: Pinecone</sub>
`;
}

// ─── Main Function ────────────────────────────────────────
async function reviewAndComment(prData, diff, relevantCode = []) {
  try {
    let review;

    if (MOCK_MODE) {
      console.log('🎭 Running in MOCK MODE (no API cost)...');
      review = generateMockReview(diff);
    } else {
      const prompt = buildReviewPrompt(diff, relevantCode, prData);
      let rawResponse;
      try {
        rawResponse = await callClaude(prompt);
      } catch (claudeError) {
        console.error('⚠️ Claude failed, trying GPT-4:', claudeError.message);
        rawResponse = await callGPT4(prompt);
      }
      review = parseReview(rawResponse);
    }

    console.log(`📊 Review score: ${review.score}/100`);
    console.log(`🐛 Issues found: ${(review.issues || []).length}`);

    const comment = formatComment(review);

    await postPRComment({
      owner: prData.owner,
      repo: prData.repo,
      prNumber: prData.prNumber,
      comment,
    });

    console.log('✅ Review posted successfully!');
    return review;

  } catch (error) {
    console.error('❌ Review failed:', error.message);
    return { score: 0 };
  }
}

module.exports = { reviewAndComment };

// async function reviewAndComment(prData, diff, relevantCode = []) {
//     console.log('🤖 LLM review coming in Phase 4...');
//     console.log('Files to review:', diff.files.map(f => f.filename));
//     return { score: 0 };
// }

// module.exports = { reviewAndComment };