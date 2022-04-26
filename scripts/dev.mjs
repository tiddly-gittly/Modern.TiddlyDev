import chokidar from 'chokidar';
import tw from 'tiddlywiki';
import { findAllEntries, buildEntries, exportPlugins, initTiddlyWiki } from './packup.mjs';

let twServer = undefined;
const $tw1 = await initTiddlyWiki();
let $tw2 = undefined;

const watcher = chokidar.watch('src', {
  ignoreInitial: true,
  followSymlinks: true,
  ignored: /^.*\.(swp|js\.dist\.tid)$|^\.(git|hg|lock-wscript|svn|DS_Store|(wafpickle-|_).*)$|^CVS$|^npm-debug\.log$/,
  awaitWriteFinish: {
    stabilityThreshold: 1500,
    pollInterval: 100,
  },
});

const refresh = async () => {
  try {
    const [entryList, metaMap, _entryChanged] = await findAllEntries();
    await buildEntries(entryList, metaMap);
    await exportPlugins($tw1, false, false, true);
  } catch (e) {
      console.error(e);
    return;
  }
  if (twServer) twServer.close();
  $tw2 = tw.TiddlyWiki();
  $tw2.boot.argv = ['wiki', '--listen'];
  $tw2.hooks.addHook('th-server-command-post-start', (_listenCommand, server, _nodeServer) => {
    twServer = server;
  });
  $tw2.boot.boot();
};

watcher.on('ready', async () => {
  const [entryList, metaMap, _] = await findAllEntries();
  await buildEntries(entryList, metaMap);
  await exportPlugins($tw1, false, false, true);
  $tw2 = tw.TiddlyWiki();
  $tw2.boot.argv = ['wiki', '--listen'];
  $tw2.hooks.addHook('th-server-command-post-start', (_listenCommand, server, _nodeServer) => {
    twServer = server;
  });
  $tw2.boot.boot();
});
watcher.on('add', refresh);
watcher.on('change', refresh);
