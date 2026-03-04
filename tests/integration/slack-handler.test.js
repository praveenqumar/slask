const nock = require('nock');
const { extractMessageData, generateTaskTitle, generateMessageLink } = require('../../index');

describe('Slack Event Handler Integration', () => {
    afterEach(() => {
        nock.cleanAll();
    });

    describe('Star Event Processing Flow', () => {
        test('processes complete star_added event for message', () => {
            const starEvent = {
                type: 'star_added',
                user: 'U12345',
                item: {
                    type: 'message',
                    channel: 'C67890',
                    message: {
                        ts: '1234567890.123456',
                        text: 'Important meeting at 3pm tomorrow'
                    },
                    ts: '1234567890.123456'
                },
                event_ts: '1234567890.123456'
            };

            const extracted = extractMessageData(starEvent);
            const title = generateTaskTitle(extracted.messageText);
            const link = generateMessageLink(extracted.channel, extracted.ts);

            expect(extracted.channel).toBe('C67890');
            expect(extracted.messageText).toBe('Important meeting at 3pm tomorrow');
            expect(title).toBe('Important meeting at 3pm tomorrow');
            expect(link).toBe('https://slack.com/archives/C67890/p1234567890123456');
        });

        test('handles message with URL and mentions', () => {
            const starEvent = {
                type: 'star_added',
                user: 'U12345',
                item: {
                    type: 'message',
                    channel: 'C67890',
                    message: {
                        ts: '1234567890.123456',
                        text: '<@U98765> please review <https://example.com/doc>'
                    }
                }
            };

            const extracted = extractMessageData(starEvent);
            const title = generateTaskTitle(extracted.messageText);

            expect(title).toContain('<@U98765>');
            expect(title).toContain('<https://example.com/doc>');
        });

        test('handles very long message text', () => {
            const longText = 'a'.repeat(500);
            const title = generateTaskTitle(longText);

            expect(title.length).toBe(100);
            expect(title).toBe(longText.slice(0, 100));
        });

        test('skips non-message items', () => {
            const starEvent = {
                type: 'star_added',
                user: 'U12345',
                item: {
                    type: 'file',
                    file: {
                        id: 'F12345',
                        title: 'document.pdf'
                    }
                }
            };

            const extracted = extractMessageData(starEvent);

            // Should return data but type check would skip processing
            expect(extracted.channel).toBeUndefined();
            expect(extracted.messageText).toBe('Task from Slack');
        });
    });

    describe('Edge Cases', () => {
        test('handles message with empty text', () => {
            const starEvent = {
                type: 'star_added',
                item: {
                    type: 'message',
                    channel: 'C12345',
                    message: {
                        ts: '1234567890.123456',
                        text: ''
                    }
                }
            };

            const extracted = extractMessageData(starEvent);
            // Empty string is falsy, so it falls back to default
            expect(extracted.messageText).toBe('Task from Slack');
        });

        test('handles message with null/undefined text field', () => {
            const starEvent = {
                type: 'star_added',
                item: {
                    type: 'message',
                    channel: 'C12345',
                    message: {
                        ts: '1234567890.123456'
                    }
                }
            };

            const extracted = extractMessageData(starEvent);
            expect(extracted.messageText).toBe('Task from Slack');
        });

        test('handles system message (channel_join)', () => {
            const starEvent = {
                type: 'star_added',
                item: {
                    type: 'message',
                    channel: 'C12345',
                    message: {
                        ts: '1234567890.123456',
                        subtype: 'channel_join',
                        text: 'User joined the channel'
                    }
                }
            };

            const extracted = extractMessageData(starEvent);
            const title = generateTaskTitle(extracted.messageText);

            expect(extracted.messageText).toBe('User joined the channel');
            expect(title).toBe('User joined the channel');
        });

        test('handles message with attachments only (no text)', () => {
            const starEvent = {
                type: 'star_added',
                item: {
                    type: 'message',
                    channel: 'C12345',
                    message: {
                        ts: '1234567890.123456',
                        attachments: [
                            { text: 'Attachment text', fallback: 'Attachment fallback' }
                        ]
                    }
                }
            };

            const extracted = extractMessageData(starEvent);
            expect(extracted.messageText).toBe('Task from Slack');
        });
    });

    describe('Google Tasks Payload Generation', () => {
        test('generates correct task payload for Google API', () => {
            const messageData = {
                channel: 'C12345',
                ts: '1234567890.123456',
                messageText: 'Review PR #123 before EOD'
            };

            const title = generateTaskTitle(messageData.messageText);
            const link = generateMessageLink(messageData.channel, messageData.ts);

            const payload = {
                title: title,
                notes: `📎 Slack message: ${link}`
            };

            expect(payload.title).toBe('Review PR #123 before EOD');
            expect(payload.notes).toBe('📎 Slack message: https://slack.com/archives/C12345/p1234567890123456');
        });

        test('truncates title but keeps full link in notes', () => {
            const longText = 'a'.repeat(150) + ' - important';
            const title = generateTaskTitle(longText);
            const link = generateMessageLink('C12345', '1234567890.123456');

            expect(title.length).toBe(100);
            expect(link).toBe('https://slack.com/archives/C12345/p1234567890123456');
        });
    });
});
