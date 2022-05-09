import { findAllEntries, buildEntries, exportPlugins, initTiddlyWiki } from './packup.mjs';

const [entryList, metaMap, _] = await findAllEntries();
const [$tw, __] = await Promise.all([initTiddlyWiki(), buildEntries(entryList, metaMap)]);
exportPlugins($tw, true, true, false);
process.exit(0);
