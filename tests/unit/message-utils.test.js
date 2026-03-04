const {
    extractMessageData,
    generateTaskTitle,
    generateMessageLink
} = require('../../index');

describe('Message Processing Utilities', () => {
    describe('extractMessageData', () => {
        test('extracts data from message with full event structure', () => {
            const event = {
                item: {
                    channel: 'C12345',
                    message: {
                        ts: '1234567890.123456',
                        text: 'This is a test message'
                    }
                }
            };
            const result = extractMessageData(event);
            expect(result).toEqual({
                channel: 'C12345',
                ts: '1234567890.123456',
                messageText: 'This is a test message'
            });
        });

        test('falls back to item.ts when message.ts is missing', () => {
            const event = {
                item: {
                    channel: 'C12345',
                    ts: '1234567890.123456',
                    message: {
                        text: 'Message text'
                    }
                }
            };
            const result = extractMessageData(event);
            expect(result.ts).toBe('1234567890.123456');
        });

        test('falls back to default text when message.text is missing', () => {
            const event = {
                item: {
                    channel: 'C12345',
                    message: {
                        ts: '1234567890.123456'
                    }
                }
            };
            const result = extractMessageData(event);
            expect(result.messageText).toBe('Task from Slack');
        });

        test('handles system messages without text', () => {
            const event = {
                item: {
                    channel: 'C12345',
                    message: {
                        ts: '1234567890.123456',
                        subtype: 'channel_join'
                    }
                }
            };
            const result = extractMessageData(event);
            expect(result.messageText).toBe('Task from Slack');
        });
    });

    describe('generateTaskTitle', () => {
        test('truncates message to 100 characters', () => {
            const longText = 'a'.repeat(150);
            const result = generateTaskTitle(longText);
            expect(result.length).toBe(100);
        });

        test('preserves short messages unchanged', () => {
            const shortText = 'Short message';
            const result = generateTaskTitle(shortText);
            expect(result).toBe(shortText);
        });

        test('handles exactly 100 character message', () => {
            const exactText = 'a'.repeat(100);
            const result = generateTaskTitle(exactText);
            expect(result.length).toBe(100);
            expect(result).toBe(exactText);
        });

        test('handles empty string', () => {
            const result = generateTaskTitle('');
            expect(result).toBe('');
        });

        test('handles message with special characters', () => {
            const specialText = 'Test with emojis 🎉 and symbols @#$% and links https://example.com';
            const result = generateTaskTitle(specialText);
            expect(result).toContain('🎉');
        });
    });

    describe('generateMessageLink', () => {
        test('generates correct Slack message link', () => {
            const channel = 'C12345';
            const ts = '1234567890.123456';
            const result = generateMessageLink(channel, ts);
            expect(result).toBe('https://slack.com/archives/C12345/p1234567890123456');
        });

        test('removes decimal from timestamp', () => {
            const channel = 'C67890';
            const ts = '9876543210.987654';
            const result = generateMessageLink(channel, ts);
            expect(result).toBe('https://slack.com/archives/C67890/p9876543210987654');
        });

        test('handles channel IDs with different prefixes', () => {
            const testCases = [
                { channel: 'C12345', ts: '123.456', expected: 'https://slack.com/archives/C12345/p123456' },
                { channel: 'G12345', ts: '123.456', expected: 'https://slack.com/archives/G12345/p123456' },
                { channel: 'D12345', ts: '123.456', expected: 'https://slack.com/archives/D12345/p123456' }
            ];
            testCases.forEach(({ channel, ts, expected }) => {
                expect(generateMessageLink(channel, ts)).toBe(expected);
            });
        });
    });
});
