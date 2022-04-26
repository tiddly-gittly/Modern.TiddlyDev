import path from 'path';
import tw from 'tiddlywiki';
import fs from 'fs-extra';
import UglifyJS from 'uglify-js';
import { minify as htmlMinify } from 'html-minifier-terser';
import { tryCopy, htmlMinifierOptions } from './utils.mjs';

/** 项目路径 */
const repoFolder = process.cwd();
const wikiFolder = path.join(repoFolder, 'wiki');
const tiddlersFolder = path.join(wikiFolder, 'tiddlers');
const publicFolder = path.join(repoFolder, 'public');

const runTiddlyWiki = (argv) => {
  const $tw = tw.TiddlyWiki();
  $tw.boot.argv = argv;
  return $tw;
};

/**
 * 构建在线HTML版本：核心JS和资源文件不包括在HTML中， 下载后不能使用
 * @param {string} distDir 目标路径，空或者不填则默认为'dist'
 * @param {string} htmlName HTML名称，空或者不填则默认为'index.html'
 * @param {boolean} minify 是否最小化JS和HTML，默认为true
 * @param {string} excludeFilter 要排除的tiddler的过滤表达式，默认为'-[is[draft]]'
 */
export const buildOnlineHTML = (distDir, htmlName, minify, excludeFilter) => {
  distDir = path.resolve(typeof distDir !== 'string' || distDir.length === 0 ? 'dist' : distDir);
  if (typeof htmlName !== 'string' || htmlName.length === 0) htmlName = 'index.html';
  minify = minify !== false;
  if (typeof excludeFilter !== 'string') excludeFilter = '-[is[draft]]';

  // 静态资源拷贝
  fs.mkdirsSync(distDir);
  fs.copySync(publicFolder, distDir, { overwrite: true });
  tryCopy(path.join(tiddlersFolder, 'favicon.ico'), path.join(distDir, 'favicon.ico'));
  tryCopy(path.join(tiddlersFolder, 'TiddlyWikiIconWhite.png'), path.join(distDir, 'TiddlyWikiIconWhite.png'));
  tryCopy(path.join(tiddlersFolder, 'TiddlyWikiIconBlack.png'), path.join(distDir, 'TiddlyWikiIconBlack.png'));

  // 构建HTML
  // 备份 因为下面有改变tiddler的field的操作(媒体文件全部转为canonical)
  const backupFolder = path.join(wikiFolder, 'tmp_tiddlers_backup');
  fs.mkdirsSync(backupFolder);
  fs.copySync(tiddlersFolder, backupFolder, { overwrite: true });
  const $tw = runTiddlyWiki([
    wikiFolder /* 指定wiki路径 */,
    ...['--output', distDir] /* 指定输出路径 */,
    ...['--deletetiddlers', '[[$:/UpgradeLibrary]] [[$:/UpgradeLibrary/List]]'] /* 删掉一些没必要导出而且占用很大的条目 */,
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
    ...['--rendertiddler', '$:/core/save/offline-external-js', 'index-raw.html', 'text/plain', '', 'publishFilter', excludeFilter] /* 导出无核心的HTML文件 */,
    ...['--rendertiddler', '$:/core/templates/tiddlywiki5.js', 'tiddlywikicore.js', 'text/plain'] /* 导出核心 */,
  ]);

  // 将所有的二进制文件(媒体文件, 参考$tw.utils.registerFileType)导出
  const binaryExtensionMap = [];
  $tw.config.fileExtensionInfo.forEach((ext, _info) => {
    const info = $tw.config.contentTypeInfo[_info.type];
    if (info && info.encoding === 'base64') binaryExtensionMap[ext.toLowerCase()] = true;
  });
  const distMediaFolder = path.join(distDir, 'images');
  fs.mkdirsSync(distMediaFolder);
  fs.copySync(backupFolder, distMediaFolder, {
    overwrite: true,
    filter: (src, _dest) => {
      return binaryExtensionMap[path.extname(src).toLowerCase()] === true;
    },
  });

  // 恢复被清空内容的媒体文件
  fs.copySync(backupFolder, tiddlersFolder, { overwrite: true });
  fs.rmSync(backupFolder, { recursive: true, force: true });

  // 最小化：核心JS和HTML
  const rawCoreJsPath = path.join(distDir, 'tiddlywikicore.js');
  const rawHTMLPath = path.join(distDir, 'index-raw.html');
  if (minify) {
    // 核心
    let result = UglifyJS.minify(fs.readFileSync(rawCoreJsPath), {
      warnings: false,
      v8: true,
      ie: true,
      webkit: true,
    });
    fs.writeFileSync(rawCoreJsPath, result.code);
    // 网页
    result = htmlMinify(fs.readFileSync(rawHTMLPath), htmlMinifierOptions);
    fs.writeFileSync(rawHTMLPath, result);
  }
  fs.moveSync(rawCoreJsPath, path.join(distDir, `tiddlywikicore-${$tw.packageInfo.version}.js`), { overwrite: true });
  fs.moveSync(rawHTMLPath, path.join(distDir, htmlName), { overwrite: true });
};

/**
 * 构建离线HTML版本：核心JS和资源文件包括在HTML中， 下载后可以使用(就是单文件版本的wiki)
 * @param {string} distDir 目标路径，空或者不填则默认为'dist'
 * @param {string} htmlName HTML名称，空或者不填则默认为'index.html'
 * @param {boolean} minify 是否最小化JS和HTML，默认为true
 * @param {string} excludeFilter 要排除的tiddler的过滤表达式，默认为'-[is[draft]]'
 */
export const buildOfflineHTML = (distDir, htmlName, minify, excludeFilter) => {
  distDir = path.resolve(typeof distDir !== 'string' || distDir.length === 0 ? 'dist' : distDir);
  if (typeof htmlName !== 'string' || htmlName.length === 0) htmlName = 'index.html';
  minify = minify !== false;
  if (typeof excludeFilter !== 'string') excludeFilter = '-[is[draft]]';

  // 构建HTML
  fs.mkdirsSync(distDir);
  runTiddlyWiki([
    wikiFolder /* 指定wiki路径 */,
    ...['--output', distDir] /* 指定输出路径 */,
    ...['--deletetiddlers', '[[$:/UpgradeLibrary]] [[$:/UpgradeLibrary/List]]'] /* 删掉一些没必要导出而且占用很大的条目 */,
    ...[
      '--rendertiddler',
      '$:/plugins/tiddlywiki/tiddlyweb/save/offline',
      'index-raw.html',
      'text/plain',
      '',
      'publishFilter',
      excludeFilter,
    ] /* 将wiki导出为HTML */,
  ]);

  // 最小化：HTML
  const rawHTMLPath = path.join(distDir, 'index-raw.html');
  if (minify) {
    const result = htmlMinify(fs.readFileSync(rawHTMLPath), htmlMinifierOptions);
    fs.writeFileSync(rawHTMLPath, result);
  }
  fs.moveSync(rawHTMLPath, path.join(distDir, htmlName), { overwrite: true });
};

/**
 * 构建插件源
 * @param {string} pluginFilter 要发布插件的过滤器，默认为 '[prefix[$:/plugins/]!prefix[$:/plugins/tiddlywiki/]!prefix[$:/languages/]!prefix[$:/themes/tiddlywiki/]!tag[$:/tags/PluginLibrary]]'
 * @param {string} distDir 目标路径，空或者不填则默认为'dist/library'
 * @param {boolean} minify 是否最小化HTML，默认为true
 */
export const buildLibrary = (pluginFilter, distDir, minify) => {
  if (typeof pluginFilter !== 'string' || pluginFilter.length === 0)
    pluginFilter = '[prefix[$:/plugins/]!prefix[$:/plugins/tiddlywiki/]!prefix[$:/languages/]!prefix[$:/themes/tiddlywiki/]!tag[$:/tags/PluginLibrary]]';
  distDir = path.resolve(typeof distDir !== 'string' || distDir.length === 0 ? 'dist/library' : distDir);
  minify = minify !== false;

  // 构建HTML
  fs.mkdirsSync(distDir);
  runTiddlyWiki([
    wikiFolder /* 指定wiki路径 */,
    ...['--output', distDir] /* 指定输出路径 */,
    ...['--makelibrary', '$:/UpgradeLibrary'] /* 收集所有已安装插件 */,
    ...['--savelibrarytiddlers', '$:/UpgradeLibrary', pluginFilter, 'recipes/library/tiddlers/', '$:/UpgradeLibrary/List'] /* 导出指定的插件 */,
    ...['--savetiddler', '$:/UpgradeLibrary/List', 'recipes/library/tiddlers.json'] /* 生成插件集合JSON文件 */,
    ...['--rendertiddler', '$:/plugins/tiddlywiki/pluginlibrary/library.template.html', 'index-raw.html', 'text/plain'] /* 生成插件库HTML文件 */,
    ...['--deletetiddlers', '[[$:/UpgradeLibrary]] [[$:/UpgradeLibrary/List]]'] /* 删掉中间内容 */,
  ]);

  // 最小化：HTML
  const rawHTMLPath = path.join(distDir, 'index-raw.html');
  if (minify) {
    const result = htmlMinify(fs.readFileSync(rawHTMLPath), htmlMinifierOptions);
    fs.writeFileSync(rawHTMLPath, result);
  }
  fs.moveSync(rawHTMLPath, path.join(distDir, htmlName), { overwrite: true });
};
