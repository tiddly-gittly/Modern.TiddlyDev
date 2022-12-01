import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import UglifyJS from 'uglify-js';
import CleanCSS from 'clean-css';
import colors from 'ansi-colors';
import cliProgress from 'cli-progress';
import browserslist from 'browserslist';
import { ITiddlerFields, ITiddlyWiki } from 'tw5-typed';
import { esbuildPluginBrowserslist } from 'esbuild-plugin-browserslist';

// 插件构建缓存
const pluginCache: Record<string, ITiddlerFields> = {};

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

const minifyTiddler = (tiddler: ITiddlerFields) => {
  const { text, type } = tiddler;
  try {
    if (type === 'application/javascript') {
      const minified = UglifyJS.minify(text, UglifyJSOption).code;
      if (minified !== undefined) {
        return {
          ...tiddler,
          text: minified,
        };
      }
    } else if (type === 'text/css') {
      const minified = cleanCSS.minify(text).styles;
      if (minified !== undefined) {
        return {
          ...tiddler,
          text: minified,
        };
      }
    }
  } catch (e) {
    console.error(e);
    console.error(`Failed to minify ${tiddler.title}.`);
  }
  return tiddler;
};

export const walkFilesSync = (
  dir: string,
  callback: (filepath: string, stats: fs.Stats) => void,
) => {
  const stats = fs.statSync(dir);
  if (stats.isFile()) {
    callback(dir, stats);
  } else {
    fs.readdirSync(dir).forEach(item =>
      walkFilesSync(path.resolve(dir, item), callback),
    );
  }
};

export const rebuild = async (
  $tw: ITiddlyWiki,
  pluginsDir: string,
  updatePath?: string,
  minify = false,
): Promise<ITiddlerFields[]> => {
  const baseDir = path.resolve(pluginsDir);
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  // eslint-disable-next-line no-console
  console.log(colors.green('Compiling...'));
  const bar = new cliProgress.SingleBar(
    {
      format: `${colors.green('{bar}')} {percentage}% | {plugin}`,
      stopOnComplete: true,
    },
    cliProgress.Presets.shades_classic,
  );
  const tmp = ($tw.boot as any).excludeRegExp.toString();
  const filterExp = new RegExp(
    `/^.*\\.tsx?$|${tmp.substring(1, tmp.length - 1)}/`,
  );
  const updateDir = updatePath ? path.resolve(path.dirname(updatePath)) : '';
  const pluginDirs = fs
    .readdirSync(baseDir)
    .map(dirname => path.resolve(baseDir, dirname))
    .filter(dir => fs.statSync(dir).isDirectory());
  bar.start(pluginDirs.length, 0);
  const plugins = await Promise.all(
    pluginDirs.map(async (dir, index) => {
      bar.update(index, { plugin: path.basename(dir) });
      // 检查插件是否被修改过，缓存
      const update =
        updateDir.startsWith(dir) || !pluginCache.hasOwnProperty(dir);
      if (!update) {
        bar.update(index + 1, { plugin: path.basename(dir) });
        return pluginCache[dir];
      }

      // 读取非编译内容
      const plugin: ITiddlerFields = ($tw as any).loadPluginFolder(
        dir,
        filterExp,
      );
      const tiddlers = JSON.parse(plugin.text).tiddlers as Record<
        string,
        ITiddlerFields
      >;

      // 检索编译入口
      const entries: Record<string, ITiddlerFields> = {};
      walkFilesSync(baseDir, filepath => {
        if (['.ts', '.tsx'].includes(path.extname(filepath).toLowerCase())) {
          const meta = ($tw as any).loadMetadataForFile(
            filepath,
          ) as ITiddlerFields | null;
          if (!meta) {
            return;
          }
          entries[filepath] = meta;
        }
      });
      // 编译
      (
        await esbuild.build({
          entryPoints: Object.keys(entries),
          bundle: true,
          minify: false,
          write: false,
          incremental: true,
          outdir: baseDir,
          outbase: baseDir,
          sourcemap: false,
          format: 'cjs',
          treeShaking: true,
          // platform: 'browser',
          external: ['$:/*'],
          plugins: [
            // http://browserl.ist/?q=%3E0.25%25%2C+not+ie+11%2C+not+op_mini+all
            esbuildPluginBrowserslist(
              browserslist(['>0.25%', 'not ie 11', 'not op_mini all']),
              {
                printUnknownTargets: false,
              },
            ),
          ],
        })
      ).outputFiles.forEach(file => {
        // .replaceAll(
        //     /module\.exports\s*=\s*__toCommonJS\(demo_exports\)/g,
        //     'Object.assign(exports, __toCommonJS(demo_exports))',
        //   )
        const { dir, name } = path.parse(file.path);
        const jsPath = path.resolve(dir, `${name}.ts`);
        const meta = entries[jsPath];
        tiddlers[meta.title] = {
          ...meta,
          text: file.text,
        };
      });

      // 最小化
      if (minify) {
        Object.keys(tiddlers).forEach(
          title => (tiddlers[title] = minifyTiddler(tiddlers[title])),
        );
      }

      pluginCache[dir] = {
        ...plugin,
        text: JSON.stringify({ tiddlers }),
      };
      bar.update(index + 1, { plugin: path.basename(dir) });
      return pluginCache[dir];
    }),
  );
  // eslint-disable-next-line no-console
  console.log('');
  return plugins;
};
