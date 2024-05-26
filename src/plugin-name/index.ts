import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers } from 'tiddlywiki';
import './index.css';

class ExampleWidget extends Widget {
  refresh(_changedTiddlers: IChangedTiddlers) {
    return false;
  }

  render(parent: Element, nextSibling: Element) {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();
    const containerElement = $tw.utils.domMaker('p', {
      class: 'tc-example-widget',
      text: 'This is a widget!',
    });
    parent.insertBefore(containerElement, nextSibling);
    this.domNodes.push(containerElement);
  }
}

// zh tips
// 此处导出的模块变量名RandomNumber将作为微件（widget）的名称。使用<$RandomNumber/>调用此微件。
// Widget在tiddlywiki中的条目名、源文件以及源文件.meta文件名和Widget名字可以不一致。
// 比如Widget条目名可以为My-Widget,源文件以及源文件.meta文件名可以称为index.ts与index.ts.meta。最终的Widget名却是：RandomNumber，且使用<$RandomNumber/>调用此微件。
// 如果为一个脚本文件添加了 .meta 将会被视为入口文件。
// en tips
// The module variable name RandomNumber exported here will be used as the name of the widget. Use <$RandomNumber/> to call this Widget.
// The Widget's tiddler name, source file, and source file .meta file name in tiddlywiki can be inconsistent with the Widget name.
// For example, the Widget entry name could be My-Widget, and the source and source.meta file names could be index.ts and index.ts.meta, but the final Widget name could be RandomNumber, and the widget would be called with <$RandomNumber/>.
// If a .meta is added to a script file it will be treated as an entry file.
declare let exports: {
  RandomNumber: typeof ExampleWidget;
};
exports.RandomNumber = ExampleWidget;
