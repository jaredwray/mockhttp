/* c8 ignore next 34 */
import fs from 'node:fs';

async function copyAndReplaceText(originalFile: string, newFile: string, searchValue: string, replaceValue: string) {
	try {
		// Ensure the original file exists
		if (!fs.existsSync(originalFile)) {
			throw new Error(`Original file "${originalFile}" does not exist.`);
		}

		// Read the content of the original file
		const fileContent = await fs.promises.readFile(originalFile, 'utf8');

		// Replace the text
		const updatedContent = fileContent.replaceAll(new RegExp(searchValue, 'g'), replaceValue);

		// Write the updated content to the new file
		await fs.promises.writeFile(newFile, updatedContent, 'utf8');

		console.log(`File copied and text replaced: ${newFile}`);
	} catch (error) {
		console.error(`Error processing files: ${error.message}`);
	}
}

// File paths and replacement values
const originalFile = 'README.md';
const newFile = 'DOCKER.md';
const searchValue = '\\[\\!\\[public/logo\\.svg\\]\\(public/logo\\.svg\\)\\]\\(https://mockhttp\\.org\\)';
const replaceValue = '';

// Run
await copyAndReplaceText(originalFile, newFile, searchValue, replaceValue);
