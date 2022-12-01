import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import tw from 'tiddlywiki';
import { getPort } from 'get-port-please';
import { Server } from 'tw5-typed';
import { WebSocketServer, WebSocket } from 'ws';
import { tiddlywiki } from './utils';
import { rebuild } from './packup';

// WebSocket with TiddlyWiki on broswer
const runServer = async () => {
  const port = await getPort({ port: 8081 });
  const server = new WebSocketServer({ port });
  const refreshHeartBeat = (ws: any) => {
    ws.isAlive = true;
    if (ws.heartBeatInterval) {
      clearInterval(ws.heartBeatInterval);
    }
    // eslint-disable-next-line consistent-return
    ws.heartBeatInterval = setInterval(() => {
      if (ws.isAlive === false) {
        clearInterval(ws.heartBeatInterval);
        delete ws.heartBeatInterval;
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    }, 15000);
  };
  server.on('connection', ws => {
    refreshHeartBeat(ws);
    ws.ping();
    ws.on('pong', () => refreshHeartBeat(ws));
    ws.on('close', () => {
      if ((ws as any).heartBeatInterval) {
        clearInterval((ws as any).heartBeatInterval);
      }
    });
  });
  server.on('close', () => {
    server.clients.forEach(ws => {
      if ((ws as any).heartBeatInterval) {
        clearInterval((ws as any).heartBeatInterval);
      }
      ws.send('bye');
    });
  });
  return { server, port };
};

// Run refresh server
export const runDev = async () => {
  const { server, port } = await runServer();
  const devWebListnerScript = fs
    .readFileSync(path.resolve(__dirname, 'devweb-listener.js'))
    .toString('utf-8')
    .replace('$$$$port$$$$', `${port}`);

  // Watch source files change
  let $tw = tiddlywiki();
  let twServer: Server;
  const watcher = chokidar.watch('src', {
    ignoreInitial: true,
    followSymlinks: true,
    ignored: ($tw.boot as any).excludeRegExp,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });
  const refresh = async (path?: string) => {
    const plugins = await rebuild($tw, 'src', path);
    $tw = tw.TiddlyWiki();
    $tw.boot.argv = ['wiki', '--listen'];
    $tw.preloadTiddler({
      title: '$:/Modern.TiddlyDev/devWebsocket/listener',
      text: devWebListnerScript,
      type: 'application/javascript',
      'module-type': 'startup',
    });
    $tw.preloadTiddlerArray(plugins);
    $tw.hooks.addHook(
      'th-server-command-post-start',
      (_listenCommand: unknown, newTwServer: Server) => {
        twServer = newTwServer;
        server.clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('refresh');
          }
        });
      },
    );
    twServer?.close?.();
    $tw.boot.boot();
  };
  watcher.on('ready', refresh);
  watcher.on('add', refresh);
  watcher.on('change', refresh);
};
