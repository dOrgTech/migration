// Set the package version to @daostack/arc version

const fs = require('fs');
const ora = require('ora');
const inquirer = require('inquirer');

async function setVersion() {
	const spinner = ora();
	const package = require('./package.json');
	spinner.info(`Current package version is '${package.version}'`);
	const { version } = await inquirer.prompt([
		{
			type: 'input',
			name: 'version',
			message: `What would you like to call this package version ('v<???>')?`,
			validate: x => (x ? true : 'Please choose a version'),
		},
	]);

	package.version = `v${version}`;
	fs.writeFileSync('package.json', JSON.stringify(package, undefined, 2), 'utf-8');
	spinner.succeed(`Updated package version to ${package.version}`);
}

if (require.main == module) {
	setVersion();
} else {
	module.exports = setVersion;
}
