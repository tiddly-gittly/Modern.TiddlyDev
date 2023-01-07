import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { program } from 'commander';
import {
  buildLibrary,
  tiddlywiki,
  mkdirsForFileSync,
  waitForFile,
} from 'tiddlywiki-plugin-dev';
import { ITiddlerFields } from 'tw5-typed';

/** 项目路径 */
const repoFolder = process.cwd();
const wikiFolder = path.resolve(repoFolder, 'wiki');
const bypassTiddlers = new Set([
  '$:/core',
  '$:/UpgradeLibrary',
  '$:/UpgradeLibrary/List',
]);

/**
 * 构建在线HTML版本：核心JS和资源文件不包括在HTML中， 下载后不能使用
 * @param {string} dist 目标路径，空或者不填则默认为'dist'
 * @param {string} htmlName HTML名称，空或者不填则默认为'index.html'
 * @param {boolean} minify 是否最小化JS和HTML，默认为true
 * @param {string} excludeFilter 要排除的tiddler的过滤表达式，默认为'-[is[draft]]'
 */
const buildOnlineHTML = async (
  dist = 'dist',
  htmlName = 'index.html',
  excludeFilter = '-[is[draft]]',
) => {
  // 构建插件库，导出插件
  const distDir = path.resolve(dist);
  const plugins = await buildLibrary(path.join(dist, 'library'));

  // 读取、导出外置资源、处理 tiddler
  const $tw = tiddlywiki([], wikiFolder);
  const tiddlers: Record<string, ITiddlerFields> = {};
  const savePromises: Promise<NodeJS.ErrnoException | null>[] = [];
  mkdirsForFileSync(path.resolve(distDir, 'media', '1'));
  $tw.wiki.each(({ fields }, title: string) => {
    if (
      bypassTiddlers.has(title) ||
      title.startsWith('$:/boot/') ||
      title.startsWith('$:/temp/')
    ) {
      return;
    }
    if ($tw.wiki.isBinaryTiddler(title) || $tw.wiki.isImageTiddler(title)) {
      const { extension, encoding } = $tw.config.contentTypeInfo[
        fields.type || 'text/vnd.tiddlywiki'
      ] ?? { extension: '.bin', encoding: 'base64' };
      const fileName = encodeURIComponent(
        title.endsWith(extension) ? title : `${title}${extension}`,
      );
      savePromises.push(
        new Promise(resolve =>
          fs.writeFile(
            path.resolve(distDir, 'media', fileName),
            fields.text,
            encoding as any,
            resolve,
          ),
        ),
      );
      tiddlers[title] = {
        ...fields,
        text: '',
        _canonical_uri: `./media/${encodeURIComponent(fileName)}`,
      };
    } else {
      tiddlers[title] = { ...fields };
    }
  });

  // 将构建好的插件注入
  Object.entries(plugins).forEach(
    ([title, tiddler]) => (tiddlers[title] = tiddler),
  );

  // 构建
  const tmpFolder = fs.mkdtempSync(path.resolve(tmpdir(), 'tiddlywiki-'));
  try {
    fs.cpSync(
      path.resolve(wikiFolder, 'tiddlywiki.info'),
      path.resolve(tmpFolder, 'tiddlywiki.info'),
    );
    tiddlywiki(Object.values(tiddlers), tmpFolder, [
      ...['--output', distDir] /* 指定输出路径 */,
      ...[
        '--rendertiddler',
        '$:/core/save/offline-external-js',
        htmlName,
        'text/plain',
        '',
        'publishFilter',
        excludeFilter,
      ] /* 导出无核心的HTML文件 */,
      ...[
        '--rendertiddler',
        '$:/core/templates/tiddlywiki5.js',
        `tiddlywikicore-${$tw.version}.js`,
        'text/plain',
      ] /* 导出核心 */,
    ]);
    await waitForFile(
      path.resolve(distDir, `tiddlywikicore-${$tw.version}.js`),
    );
  } catch (e) {
    console.error(e);
  }
  fs.rmSync(tmpFolder, { recursive: true, force: true });
  (await Promise.all(savePromises)).forEach(error => {
    if (error) {
      console.error(error);
    }
  });
};

/**
 * 构建离线HTML版本：核心JS和资源文件包括在HTML中， 下载后可以使用(就是单文件版本的wiki)
 * @param {string} dist 目标路径，空或者不填则默认为'dist'
 * @param {string} htmlName HTML名称，空或者不填则默认为'index.html'
 * @param {boolean} minify 是否最小化JS和HTML，默认为true
 * @param {string} excludeFilter 要排除的tiddler的过滤表达式，默认为'-[is[draft]]'
 */
const buildOfflineHTML = async (
  dist = 'dist',
  htmlName = 'index.html',
  excludeFilter = '-[is[draft]]',
) => {
  // 构建插件库，导出插件
  const distDir = path.resolve(dist);
  const plugins = await buildLibrary(path.join(dist, 'library'));

  // 读取所有 tiddler
  const $tw = tiddlywiki([], wikiFolder);
  const tiddlers: Record<string, ITiddlerFields> = {};
  $tw.wiki.each(({ fields }, title: string) => {
    if (
      bypassTiddlers.has(title) ||
      title.startsWith('$:/boot/') ||
      title.startsWith('$:/temp/')
    ) {
      return;
    }
    tiddlers[title] = { ...fields };
  });

  // 将构建好的插件注入
  Object.entries(plugins).forEach(
    ([title, tiddler]) => (tiddlers[title] = tiddler),
  );

  // 构建
  const tmpFolder = fs.mkdtempSync(path.resolve(tmpdir(), 'tiddlywiki-'));
  try {
    fs.cpSync(
      path.resolve(wikiFolder, 'tiddlywiki.info'),
      path.resolve(tmpFolder, 'tiddlywiki.info'),
    );
    tiddlywiki(Object.values(tiddlers), tmpFolder, [
      ...['--output', distDir] /* 指定输出路径 */,
      ...[
        '--rendertiddler',
        '$:/plugins/tiddlywiki/tiddlyweb/save/offline',
        htmlName,
        'text/plain',
        '',
        'publishFilter',
        excludeFilter,
      ] /* 将wiki导出为HTML */,
    ]);
    // 由于导出是异步的，因此等待完成
    await waitForFile(path.join(distDir, htmlName));
  } catch (e) {
    console.error(e);
  }
  fs.rmSync(tmpFolder, { recursive: true, force: true });
};

/**
 * 构建插件源
 * @param {string} pluginFilter 要发布插件的过滤器，默认为 '[prefix[$:/plugins/]!prefix[$:/plugins/tiddlywiki/]!prefix[$:/languages/]!prefix[$:/themes/tiddlywiki/]!tag[$:/tags/PluginLibrary]]'
 * @param {string} dist 目标路径，空或者不填则默认为'dist/library'
 * @param {boolean} minify 是否最小化HTML，默认为true
 */
const _buildLibrary = async (
  pluginFilter = '[prefix[$:/plugins/]!prefix[$:/plugins/tiddlywiki/]!prefix[$:/languages/]!prefix[$:/themes/tiddlywiki/]!tag[$:/tags/PluginLibrary]]',
  dist = 'dist/library',
) => {
  const distDir = path.resolve(dist);

  // 构建HTML
  mkdirsForFileSync(path.resolve(distDir, 'recipes/library/tiddlers'));
  tiddlywiki([], wikiFolder, [
    ...['--output', distDir] /* 指定输出路径 */,
    ...['--makelibrary', '$:/UpgradeLibrary'] /* 收集所有已安装插件 */,
    ...[
      '--savelibrarytiddlers',
      '$:/UpgradeLibrary',
      pluginFilter,
      'recipes/library/tiddlers/',
      '$:/UpgradeLibrary/List',
    ] /* 导出指定的插件 */,
    ...[
      '--savetiddler',
      '$:/UpgradeLibrary/List',
      'recipes/library/tiddlers.json',
    ] /* 生成插件集合JSON文件 */,
    ...[
      '--rendertiddler',
      '$:/plugins/tiddlywiki/pluginlibrary/library.template.html',
      'index.html',
      'text/plain',
    ] /* 生成插件库HTML文件 */,
    ...[
      '--deletetiddlers',
      '[[$:/UpgradeLibrary]] [[$:/UpgradeLibrary/List]]',
    ] /* 删掉中间内容 */,
  ]);

  // 由于导出是异步的，因此等待完成
  await waitForFile(path.join(distDir, 'index.html'));
};

program
  .command('publish')
  .description('Publish wiki')
  .argument('[dist]', 'Destination folder to publish', 'dist')
  .option(
    '-e, --exclude <exclude-filter>',
    'Filter to exclude publishing tiddlers',
    '-[is[draft]]',
  )
  .option(
    '--offline',
    'Generate single wiki file, with an external core js file',
    false,
  )
  .action(
    async (
      dist: string,
      { offline, excludeFilter }: { offline: boolean; excludeFilter: string },
    ) => {
      if (offline) {
        await buildOfflineHTML(dist, 'index.html', excludeFilter);
      } else {
        await buildOnlineHTML(dist, 'index.html', excludeFilter);
      }
      process.exit(0);
    },
  )
  .parse();
