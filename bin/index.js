#!/usr/bin/env node

import fs from 'fs';
import { Command } from 'commander';
import handlebars from 'handlebars';
import tiged from 'tiged';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import symbols from 'log-symbols';

// 从 package.json 动态读取版本号
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

// 从 templates.json 加载模板列表（支持本地新增模板，无需发版）
const TEMPLATES_PATH = new URL('../templates.json', import.meta.url);
let templateList = [];
try {
  templateList = JSON.parse(fs.readFileSync(TEMPLATES_PATH, 'utf-8'));
} catch {
  console.log(symbols.error, chalk.red('无法读取 templates.json，请检查文件是否存在且格式正确'));
  process.exit(1);
}

async function downloadTemplate(repo, dest) {
  const emitter = tiged(repo, { disableCache: true });
  await emitter.clone(dest);
}

const program = new Command();

program
  .name('will')
  .version(pkg.version)
  .usage('<command> [options]');

// init 命令
program
  .command('init <name>')
  .description('初始化一个新项目')
  .action(async (name) => {
    if (fs.existsSync(name)) {
      console.log(symbols.error, chalk.red(`目录 "${name}" 已存在，请使用其他项目名称`));
      process.exit(1);
    }

    try {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: '请输入项目描述',
          default: name,
        },
        {
          type: 'list',
          name: 'template',
          message: '请选择项目模板:',
          choices: templateList.map((t) => ({
            name: `${t.name} — ${t.description}`,
            value: t,
          })),
        },
      ]);

      const { template, description } = answers;
      const repoUrl = `${template.git}#${template.branch}`;

      const spinner = ora('正在下载模板...').start();
      try {
        await downloadTemplate(repoUrl, name);
        spinner.succeed('模板下载完成');
      } catch (err) {
        spinner.fail(err.message);
        fs.rmSync(name, { recursive: true, force: true });
        process.exit(1);
      }

      // 编译 package.json
      const pkgPath = `${name}/package.json`;
      if (fs.existsSync(pkgPath)) {
        try {
          const content = fs.readFileSync(pkgPath, 'utf-8');
          const result = handlebars.compile(content)({ name, description });
          fs.writeFileSync(pkgPath, result, 'utf-8');
        } catch (err) {
          console.log(symbols.warning, chalk.yellow(`写入 package.json 失败: ${err.message}`));
        }
      }

      console.log(symbols.success, chalk.green('项目初始化完成'));
      console.log(`\n  cd ${name}\n`);
    } catch (err) {
      console.log(symbols.error, chalk.red(err.message));
      process.exit(1);
    }
  });

// list 命令
program
  .command('list')
  .description('列出所有可用的内置模板')
  .action(() => {
    console.log('\n可用模板列表:\n');
    templateList.forEach((t) => {
      console.log(`  ${chalk.green(t.name.padEnd(10))}${t.description}`);
      console.log(`  ${chalk.gray(t.git + '#' + t.branch)}\n`);
    });
  });

program.parse(process.argv);
