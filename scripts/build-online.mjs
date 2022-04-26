import { buildOnlineHTML } from "./tw.mjs";
import { findAllEntries, buildEntries, exportPlugins, initTiddlyWiki } from './packup.mjs';

const [entryList, metaMap, _] = await findAllEntries();
const [$tw, __] = await Promise.all([initTiddlyWiki(), buildEntries(entryList, metaMap, false)]);
exportPlugins($tw, false, true);
buildOnlineHTML('dist', 'index.html', true);
