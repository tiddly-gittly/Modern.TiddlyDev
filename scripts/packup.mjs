import path from 'path';
import fs from 'fs-extra';
import esbuild from 'esbuild';
import browserslist from 'browserslist';
import { esbuildPluginBrowserslist } from 'esbuild-plugin-browserslist';
import tw from 'tiddlywiki';
import UglifyJS from 'uglify-js';
import CleanCSS from 'clean-css';
import { walkFilesAsync } from './utils.mjs';

const SOURCE_DIRECTORY = 'src';
const DISTNATION_DIRECTORY = 'dist';
const WIKI_DIRECTORY = 'wiki';
const WIKI_TIDDLERS_DIRECTORY = `${WIKI_DIRECTORY}/tiddlers`;
const ENTRANCE_EXT_LIST = ['.ts', '.tsx', '.jsx', '.mjs'];

export const cleanDist = async () => {
  const distJsTiddler = /^.*\.js\.dist\.tid$/;
  await walkFilesAsync(SOURCE_DIRECTORY, (dir) => {
    if (distJsTiddler.test(dir)) fs.rmSync(dir);
  });
  const distPluginTiddler = /^.*\.json\.dist\.json$/;
  await walkFilesAsync(WIKI_TIDDLERS_DIRECTORY, (dir) => {
    if (distPluginTiddler.test(dir)) fs.rmSync(dir);
  });
  fs.rmSync('dist', { recursive: true, force: true });
};

export const findAllEntries = async (previousEntryList) => {
  previousEntryList = previousEntryList ? previousEntryList : [];
  let entryChanged = false;
  const entryList = [];
  const outputMetaMap = {};
  await walkFilesAsync(SOURCE_DIRECTORY, (dir) => {
    if (ENTRANCE_EXT_LIST.indexOf(path.extname(dir).toLowerCase()) === -1) return;
    const metaDir = `${dir}.meta`;
    if (!fs.existsSync(metaDir)) return;
    let dirInfo = path.parse(dir);
    entryList.push(dir);
    if (!entryChanged && previousEntryList.indexOf(dir) === -1) entryChanged = true;
    outputMetaMap[`${path.resolve(path.join(dirInfo.dir, dirInfo.name))}.js`] = fs.readFileSync(metaDir).toString('utf-8');
  });
  if (!entryChanged) {
    const len = previousEntryList.length;
    for (let i = 0; i < len; i++) {
      if (entryList.indexOf(previousEntryList[i]) !== -1) continue;
      entryChanged = true;
      break;
    }
  }
  return [entryList, outputMetaMap, entryChanged];
};

export const buildEntries = async (entries, metaMap) => {
  // Build .ts, .tsx, .jsx to .js.dist.tid
  const buildResult = await esbuild.build({
    entryPoints: entries,
    bundle: true,
    minify: false,
    write: false,
    incremental: true,
    outdir: SOURCE_DIRECTORY,
    outbase: SOURCE_DIRECTORY,
    sourcemap: false,
    format: 'cjs',
    treeShaking: true,
    // platform: 'browser',
    external: ['$:/*', 'react', 'react-dom'],
    plugins: [
      // http://browserl.ist/?q=%3E0.25%25%2C+not+ie+11%2C+not+op_mini+all
      esbuildPluginBrowserslist(browserslist(['>0.25%', 'not ie 11', 'not op_mini all']), {
        printUnknownTargets: false,
      }),
    ],
  });
  buildResult.outputFiles.forEach((out) => {
    fs.mkdirsSync(path.dirname(out.path));
    fs.writeFileSync(`${out.path}.dist.tid`, `${metaMap[out.path]}\n\n${out.text}`);
  });
};

// .replaceAll(
//     /module\.exports\s*=\s*__toCommonJS\(demo_exports\)/g,
//     'Object.assign(exports, __toCommonJS(demo_exports))',
//   )

export const initTiddlyWiki = async (_$tw, args) => {
  const $tw = tw.TiddlyWiki(_$tw);
  $tw.boot.argv = args ? args : [WIKI_DIRECTORY];
  $tw.boot.boot();
  return $tw;
};

const UglifyJSOption = {
  warnings: false,
  v8: true,
  ie: true,
  webkit: true,
};

const cleanCSS = new CleanCSS({
  compatibility: 'ie8',
  level: 2,
});

const minifyPlugin = (pluginInfo) => {
  const tiddlersJson = JSON.parse(pluginInfo.text);
  const tiddlers = Object.keys(tiddlersJson.tiddlers);
  const len = tiddlers.length;
  for (let i = 0; i < len; i++) {
    const tiddler = tiddlersJson.tiddlers[tiddlers[i]];
    try {
      if (tiddler.type === 'application/javascript') {
        const minified = UglifyJS.minify(tiddler.text, UglifyJSOption).code;
        if (minified !== undefined) tiddler.text = minified;
      } else if (tiddler.type === 'text/css') {
        const minified = cleanCSS.minify(tiddler.text).styles;
        if (minified !== undefined) tiddler.text = minified;
      }
    } catch (e) {
      console.error(e);
      console.error(`Failed to minify ${tiddlers[i]}.`);
    }
  }
  pluginInfo.text = JSON.stringify(tiddlersJson);
  return pluginInfo;
};

const excludeFiles = /^.*\.(tsx?|jsx|meta|swp|mjs)$|^\.(git|hg|lock-wscript|svn|DS_Store|(wafpickle-|_).*)$|^CVS$|^npm-debug\.log$/;

export const exportPlugins = ($tw, minify, exportToDist, exportToWiki) => {
  if (fs.existsSync(SOURCE_DIRECTORY)) {
    // Ignore ts, tsx, jsm and jsx
    if (exportToDist) fs.mkdirsSync(DISTNATION_DIRECTORY);
    fs.readdirSync(SOURCE_DIRECTORY).forEach((_dir) => {
      const dir = path.join(SOURCE_DIRECTORY, _dir);
      const dirStat = fs.statSync(dir);
      if (!dirStat.isDirectory()) return;
      const pluginInfo = minify ? minifyPlugin($tw.loadPluginFolder(dir, excludeFiles)) : $tw.loadPluginFolder(dir, excludeFiles);
      const pluginTiddlerName = `${path.basename($tw.utils.generateTiddlerFilepath(pluginInfo.title, {}))}.json`;
      if (exportToWiki) fs.writeJSONSync(path.join(WIKI_TIDDLERS_DIRECTORY, `${pluginTiddlerName}.dist.json`), pluginInfo);
      if (exportToDist) fs.writeJSONSync(path.join('dist', pluginTiddlerName), pluginInfo);
    });
  }
};
