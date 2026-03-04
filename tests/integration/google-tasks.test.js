const { google } = require('googleapis');
const { verifyTaskCreated, tasks } = require('../../index');

describe('Google Tasks Integration', () => {
    const TEST_TASKLIST = '@default';
    let createdTaskId = null;

    beforeAll(async () => {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
            console.warn('Skipping integration tests - Google credentials not configured');
            return;
        }
    });

    afterAll(async () => {
        if (createdTaskId && process.env.GOOGLE_REFRESH_TOKEN) {
            try {
                await tasks.tasks.delete({
                    tasklist: TEST_TASKLIST,
                    task: createdTaskId
                });
                console.log('Cleaned up test task');
            } catch (err) {
                console.warn('Failed to clean up test task:', err.message);
            }
        }
    });

    test('should create a task via Google Tasks API', async () => {
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return;
        }

        const testTask = {
            title: `Integration Test Task - ${Date.now()}`,
            notes: 'This is a test task created by integration tests'
        };

        const response = await tasks.tasks.insert({
            tasklist: TEST_TASKLIST,
            requestBody: testTask
        });

        expect(response.data).toBeDefined();
        expect(response.data.id).toBeDefined();
        expect(response.data.title).toBe(testTask.title);
        expect(response.data.notes).toBe(testTask.notes);
        expect(response.data.status).toBe('needsAction');

        createdTaskId = response.data.id;
    });

    test('should retrieve the created task by ID', async () => {
        if (!createdTaskId) {
            return;
        }

        const task = await tasks.tasks.get({
            tasklist: TEST_TASKLIST,
            task: createdTaskId
        });

        expect(task.data.id).toBe(createdTaskId);
        expect(task.data.title).toContain('Integration Test Task');
        expect(task.data.notes).toBe('This is a test task created by integration tests');
    });

    test('should verify task creation using verifyTaskCreated function', async () => {
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return;
        }

        const response = await tasks.tasks.insert({
            tasklist: TEST_TASKLIST,
            requestBody: {
                title: `Verification Test - ${Date.now()}`,
                notes: 'Testing verification function'
            }
        });

        const taskId = response.data.id;

        const verifiedTask = await verifyTaskCreated(taskId);

        expect(verifiedTask).not.toBeNull();
        expect(verifiedTask.id).toBe(taskId);
        expect(verifiedTask.title).toContain('Verification Test');
    });

    test('should list all tasks from default tasklist', async () => {
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return;
        }

        const response = await tasks.tasks.list({
            tasklist: TEST_TASKLIST
        });

        expect(response.data).toBeDefined();
        expect(Array.isArray(response.data.items)).toBe(true);

        if (response.data.items && response.data.items.length > 0) {
            const firstTask = response.data.items[0];
            expect(firstTask.id).toBeDefined();
            expect(firstTask.title).toBeDefined();
        }
    });

    test('should update an existing task', async () => {
        if (!process.env.GOOGLE_REFRESH_TOKEN) {
            return;
        }

        const createResponse = await tasks.tasks.insert({
            tasklist: TEST_TASKLIST,
            requestBody: {
                title: `Update Test - ${Date.now()}`,
                notes: 'Original notes'
            }
        });

        const taskId = createResponse.data.id;
        const updatedTitle = `${createResponse.data.title} - Updated`;

        const updateResponse = await tasks.tasks.patch({
            tasklist: TEST_TASKLIST,
            task: taskId,
            requestBody: {
                title: updatedTitle,
                notes: 'Updated notes'
            }
        });

        expect(updateResponse.data.title).toBe(updatedTitle);
        expect(updateResponse.data.notes).toBe('Updated notes');

        // Cleanup
        await tasks.tasks.delete({ tasklist: TEST_TASKLIST, task: taskId });
    });
});
