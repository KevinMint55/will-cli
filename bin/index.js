#!/usr/bin/env node

const fs = require('fs');
const program = require('commander');
const handlebars = require('handlebars');
const download = require('download-git-repo');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');
const symbols = require('log-symbols');

const templateList = [
  {
    name: 'vue',
    git: 'https://github.com/KevinMint55/vue-willtemplate.git',
    branch: 'template',
  },
  {
    name: 'react',
    git: 'https://github.com/KevinMint55/react-willtemplate.git',
    branch: 'template',
  },
  {
    name: 'koa',
    git: 'https://github.com/KevinMint55/koa-willtemplate.git',
    branch: 'template',
  },
];

program
  .version('1.0.0')
  .usage('will <command> [options]')
  .command('init <name>')
  .action((name) => {
    if (!fs.existsSync(name)) {
      inquirer.prompt(
        [
          {
            name: 'description',
            message: '请输入项目描述',
            type: 'input',
            default: name,
          },
          {
            type: 'list',
            name: 'template',
            message: '请选择项目模版:',
            choices: templateList,
          },
        ],
      ).then((answers) => {
        const template = templateList.find((item) => item.name === answers.template);
        const spinner = ora('正在下载模板...');
        spinner.start();
        download(`direct:${template.git}#${template.branch}`, name, {
          clone: true,
        }, (err) => {
          if (err) {
            spinner.fail();
            console.log(symbols.error, chalk.red(err));
          } else {
            spinner.stop();
            const fileName = `${name}/package.json`;
            const meta = {
              name,
              description: answers.description,
            };
            if (fs.existsSync(fileName)) {
              const content = fs.readFileSync(fileName).toString();
              const result = handlebars.compile(content)(meta);
              fs.writeFileSync(fileName, result);
            }
            console.log(symbols.success, chalk.green('项目初始化完成'));
          }
        });
      });
    } else {
      console.log(symbols.error, chalk.red('项目已存在'));
    }
  });

program.parse(process.argv);
