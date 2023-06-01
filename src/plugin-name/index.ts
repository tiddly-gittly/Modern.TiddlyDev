import { IChangedTiddlers } from 'tiddlywiki';
import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import './index.css';

class ExampleWidget extends Widget {
  refresh(_changedTiddlers: IChangedTiddlers) {
    return false;
  }

  render(parent: Node, _nextSibling: Node) {
    this.parentDomNode = parent;
    this.execute();
    const containerElement = $tw.utils.domMaker('p', {
      text: 'This is a widget!',
    });
    this.domNodes.push(parent.appendChild(containerElement));
  }
}

// 此处导出的模块名RandomNumber将作为<$RandomNumber/>：widget的名称。
// 另外，index.ts.meta元信息文件中的条目名字名称可以与导出的模块名不一致。
// 可以没有元信息文件。但index.ts文件与index.ts.meta元信息文件的文件名必须一致。
// 例如：index.ts文件与index.ts.meta文件，一一对应。
// 如果为一个脚本文件添加了 .meta 将会被视为入口文件。
exports.RandomNumber = ExampleWidget;
