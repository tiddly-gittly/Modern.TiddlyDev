import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { program } from 'commander';
import { ITiddlyWiki } from 'tw5-typed';
import { TiddlyWiki } from 'tiddlywiki';

/**
 * 初始化 TiddlyWiki
 *
 * @param {Record<string, unknown>[]} [preloadTiddlers=[]] 额外的 tiddler
 * @param {string} [dir='.'] 工作路径
 * @param {string[]} [commands=[]] 附加指令
 * @return {ITiddlyWiki}
 */
export const tiddlywiki = (
  preloadTiddlers: Record<string, unknown>[] = [],
  dir = '.',
  commands: string[] = [],
): ITiddlyWiki => {
  const $tw = TiddlyWiki();
  $tw.boot.argv = [dir, ...commands];
  $tw.preloadTiddlerArray(preloadTiddlers);
  $tw.boot.boot();
  return $tw;
};

export const mkdirsForFileSync = (fileName: string) => {
  const _path = path.dirname(fileName);
  if (!fs.existsSync(_path)) {
    mkdirsForFileSync(_path);
    fs.mkdirSync(_path);
  }
};

export const tryCopy = (from: string, to: string) => {
  if (fs.existsSync(from)) {
    fs.cpSync(from, to, { force: true, errorOnExist: false, recursive: true });
  }
};

const waitForFile = (path: string) =>
  new Promise<void>(resolve => {
    const id = setInterval(() => {
      resolve();
      if (fs.existsSync(path)) {
        resolve();
        clearInterval(id);
      }
    }, 100);
  });

/** 项目路径 */
const repoFolder = process.cwd();
const wikiFolder = path.resolve(repoFolder, 'wiki');
const tiddlersFolder = path.resolve(wikiFolder, 'tiddlers');

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
  const distDir = path.resolve(dist);

  // 静态资源拷贝
  mkdirsForFileSync(path.resolve(distDir, htmlName));
  // tryCopy(publicFolder, distDir);
  tryCopy(
    path.resolve(tiddlersFolder, '$__favicon.ico'),
    path.resolve(distDir, 'favicon.ico'),
  );

  // 构建HTML
  // 备份 因为下面有改变tiddler的field的操作(媒体文件全部转为canonical)
  const backupFolder = fs.mkdtempSync(path.resolve(tmpdir(), 'tiddlywiki-'));
  tryCopy(tiddlersFolder, backupFolder);
  const $tw = tiddlywiki([], wikiFolder, [
    ...['--output', distDir] /* 指定输出路径 */,
    ...[
      '--deletetiddlers',
      '[[$:/UpgradeLibrary]] [[$:/UpgradeLibrary/List]]',
    ] /* 删掉一些没必要导出而且占用很大的条目 */,
    ...[
      '--setfield',
      '[is[image]] [is[binary]] [type[application/msword]] [type[image/svg+xml]]',
      '_canonical_uri',
      '$:/core/templates/canonical-uri-external-image',
      'text/plain',
    ] /* 媒体条目转外链 */,
    ...[
      '--setfield',
      '[is[image]] [is[binary]] [type[application/msword]] [type[image/svg+xml]]',
      'text',
      '',
      'text/plain',
    ] /* 媒体条目内容清空：注意这一步也会把所有媒体文件的内容变成空的 */,
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
      'tiddlywikicore.js',
      'text/plain',
    ] /* 导出核心 */,
  ]);

  const rawCoreJsPath = path.join(distDir, 'tiddlywikicore.js');
  await waitForFile(rawCoreJsPath);
  fs.renameSync(
    rawCoreJsPath,
    path.join(distDir, `tiddlywikicore-${($tw as any).packageInfo.version}.js`),
  );

  // 将所有的二进制文件(媒体文件, 参考$tw.utils.registerFileType)导出
  const binaryExtensionMap: Record<string, boolean> = {};
  Object.keys($tw.config.fileExtensionInfo).forEach(ext => {
    const _info = $tw.config.fileExtensionInfo[ext];
    const info = $tw.config.contentTypeInfo[_info.type];
    if (info?.encoding === 'base64') {
      binaryExtensionMap[ext.toLowerCase()] = true;
    }
  });
  const distMediaFolder = path.resolve(distDir, 'images');
  mkdirsForFileSync(path.resolve(distMediaFolder, '1'));
  fs.cpSync(backupFolder, distMediaFolder, {
    force: true,
    recursive: true,
    filter: (src, dest) =>
      src === backupFolder ||
      binaryExtensionMap[path.extname(src).toLowerCase()] === true,
  });
  tryCopy(
    path.resolve(backupFolder, '$__favicon.ico'),
    path.resolve(
      distDir,
      'images',
      encodeURIComponent(encodeURIComponent('$:/favicon.ico')),
    ),
  );

  // 恢复被清空内容的媒体文件
  tryCopy(backupFolder, tiddlersFolder);
  fs.rmSync(backupFolder, { recursive: true, force: true });
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
  const distDir = path.resolve(dist);
  // 构建HTML
  mkdirsForFileSync(path.resolve(distDir, htmlName));
  tiddlywiki([], wikiFolder, [
    ...['--output', distDir] /* 指定输出路径 */,
    ...[
      '--deletetiddlers',
      "'[[$:/UpgradeLibrary]] [[$:/UpgradeLibrary/List]]'",
    ] /* 删掉一些没必要导出而且占用很大的条目 */,
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
};

/**
 * 构建插件源
 * @param {string} pluginFilter 要发布插件的过滤器，默认为 '[prefix[$:/plugins/]!prefix[$:/plugins/tiddlywiki/]!prefix[$:/languages/]!prefix[$:/themes/tiddlywiki/]!tag[$:/tags/PluginLibrary]]'
 * @param {string} dist 目标路径，空或者不填则默认为'dist/library'
 * @param {boolean} minify 是否最小化HTML，默认为true
 */
const buildLibrary = async (
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
        buildOfflineHTML(dist, 'index.html', excludeFilter);
      } else {
        buildOnlineHTML(dist, 'index.html', excludeFilter);
      }
    },
  )
  .parse();
