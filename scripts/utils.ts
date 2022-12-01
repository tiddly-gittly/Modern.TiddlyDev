import fs from 'fs';
import { dirname } from 'path';
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
  const path = dirname(fileName);
  if (!fs.existsSync(path)) {
    mkdirsForFileSync(path);
    fs.mkdirSync(path);
  }
};

export const tryCopy = (from: string, to: string) => {
  if (fs.existsSync(from)) {
    fs.cpSync(from, to, { force: true, errorOnExist: false, recursive: true });
  }
};
