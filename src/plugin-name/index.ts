import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers } from 'tiddlywiki';
import './index.css';

class ExampleWidget extends Widget {
  refresh(_changedTiddlers: IChangedTiddlers) {
    return false;
  }

  render(parent: Element, nextSibling: Element) {
    this.parentDomNode = parent;
    this.execute();
    const containerElement = $tw.utils.domMaker('p', {
      text: 'This is a widget!',
    });
    nextSibling === null ? parent.append(containerElement) : nextSibling.before(containerElement);
    this.domNodes.push(containerElement);
  }
}

// 此处导出的模块变量名RandomNumber将作为微件（widget）的名称。使用<$RandomNumber/>调用此微件。
// Widget在tiddlywiki中的条目名、源文件以及源文件.meta文件名和Widget名字可以不一致。
// 比如Widget条目名可以为My-Widget,源文件以及源文件.meta文件名可以称为index.ts与index.ts.meta。最终的Widget名却是：RandomNumber，且使用<$RandomNumber/>调用此微件。
// 如果为一个脚本文件添加了 .meta 将会被视为入口文件。
declare let exports: {
  RandomNumber: typeof ExampleWidget;
};
exports.RandomNumber = ExampleWidget;
