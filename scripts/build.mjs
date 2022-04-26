import path from 'path';
import fs from 'fs-extra';
import esbuild from 'esbuild';
import browserslist from 'browserslist';
import { esbuildPluginBrowserslist } from 'esbuild-plugin-browserslist';

const findAllEntries = () => {
  const entryList = [];
  const outputMetaMap = {};
  const preParellDeep = async (dir) => {
    const statObj = fs.statSync(dir);
    if (statObj.isFile()) {
      const ext = path.extname(dir).toLowerCase();
      if (ext !== '.ts' && ext !== '.tsx' && ext !== '.jsx') return;
      const metaDir = `${dir}.meta`;
      if (!fs.existsSync(metaDir)) return;
      let dirInfo = path.parse(dir);
      entryList.push(dir);
      outputMetaMap[`${path.resolve(path.join(dirInfo.dir, dirInfo.name))}.js`] = fs.readFileSync(metaDir).toString('utf-8');
    } else {
      const dirs = fs.readdirSync(dir);
      await Promise.all(dirs.map((item) => preParellDeep(path.join(dir, item))));
    }
  };
  preParellDeep('src');
  return [entryList, outputMetaMap];
};

const [entries, metaMap] = findAllEntries();

// const pluginInfo = fs.readJsonSync('src/plugin.info');
// const [_, __, author, name] = pluginInfo.title.split('/');
// const pluginTitle = `${author}/${name}`;
// const packageJSON = fs.readJsonSync('package.json');

(
  await esbuild.build({
    entryPoints: entries,
    bundle: true,
    minify: process.env.CI ? true : false,
    write: false,
    outdir: 'src',
    outbase: 'src',
    sourcemap: process.env.CI ? false : 'inline',
    format: 'iife',
    treeShaking: true,
    platform: 'browser',
    external: ['$:/*', 'react', 'react-dom'],
    plugins: [
      // http://browserl.ist/?q=%3E0.25%25%2C+not+ie+11%2C+not+op_mini+all
      esbuildPluginBrowserslist(browserslist(['>0.25%', 'not ie 11', 'not op_mini all']), {
        printUnknownTargets: false,
      }),
    ],
  })
).outputFiles.forEach((out) => {
  fs.mkdirsSync(path.dirname(out.path));
  fs.writeFileSync(`${out.path}.dist.tid`, `${metaMap[out.path]}\n\n${out.text}`);
});
