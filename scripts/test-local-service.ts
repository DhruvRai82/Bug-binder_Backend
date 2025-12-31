import { localProjectService } from '../src/services/LocalProjectService';

async function test() {
    try {
        console.log('Testing LocalProjectService...');
        const projects = await localProjectService.getAllProjects('test-user');
        console.log('Projects found:', projects.length);
        if (projects.length > 0) {
            console.log('First project:', projects[0].name);
        } else {
            console.log('No projects found (which might be valid if empty).');
        }
        console.log('Test Passed!');
    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
}

test();
