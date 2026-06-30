const { buildReviewPrompt } = require('../llm/buildPrompt');

describe('buildReviewPrompt', () => {
    const mockDiff = {
        files: [{
            filename: 'src/app.js',
            status: 'modified',
            patch: '+const x = 1;'
        }],
        prDescription: 'Test PR',
        totalAdditions: 1,
        totalDeletions: 0,
    };

    const mockPRData = {
        title: 'Test PR',
        prDescription: 'Adding feature',
    };

    it('should include PR title in prompt', () => {
        const prompt = buildReviewPrompt(mockDiff, [], mockPRData);
        expect(prompt).toContain('Test PR');
    });

    it('should include filename in prompt', () => {
        const prompt = buildReviewPrompt(mockDiff, [], mockPRData);
        expect(prompt).toContain('src/app.js');
    });
});