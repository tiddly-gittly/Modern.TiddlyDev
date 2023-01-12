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

exports.test = ExampleWidget;
