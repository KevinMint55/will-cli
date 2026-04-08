#!/usr/bin/env node

import fs from 'fs';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import handlebars from 'handlebars';
import download from 'download-git-repo';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import symbols from 'log-symbols';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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

const DOWNLOAD_TIMEOUT_MS = 30000;

function downloadTemplate(url, dest) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('下载超时，请检查网络连接'));
    }, DOWNLOAD_TIMEOUT_MS);

    download(url, dest, { clone: true }, (err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    });
  });
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
  .option('--repo <url>', '使用自定义 Git 仓库作为模板（格式：https://github.com/user/repo.git#branch）')
  .action(async (name, options) => {
    if (fs.existsSync(name)) {
      console.log(symbols.error, chalk.red(`目录 "${name}" 已存在，请使用其他项目名称`));
      process.exit(1);
    }

    try {
      let repoUrl;

      if (options.repo) {
        // 校验自定义模板 URL，防止命令注入
        if (!/^https?:\/\/[^\s;|&`$]+$/.test(options.repo)) {
          console.log(symbols.error, chalk.red('无效的仓库地址，请使用合法的 https URL'));
          process.exit(1);
        }
        repoUrl = `direct:${options.repo}`;
      } else {
        // 交互式选择内置模板
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
        repoUrl = `direct:${template.git}#${template.branch}`;

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
        return;
      }

      // --repo 模式
      const spinner = ora('正在下载模板...').start();
      try {
        await downloadTemplate(repoUrl, name);
        spinner.succeed('模板下载完成');
      } catch (err) {
        spinner.fail(err.message);
        fs.rmSync(name, { recursive: true, force: true });
        process.exit(1);
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
