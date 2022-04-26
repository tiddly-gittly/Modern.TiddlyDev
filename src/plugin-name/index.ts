import type { Widget as IWidget, IChangedTiddlers } from 'tiddlywiki';

const Widget = (require('$:/core/modules/widgets/widget.js') as { widget: typeof IWidget }).widget;

class ExampleWidget extends Widget {
  constructor(parseTreeNode: any, options: any) {
    super(parseTreeNode, options);
  }

  refresh(_changedTiddlers: IChangedTiddlers) {
    return false;
  }

  /**
   * Lifecycle method: Render this widget into the DOM
   */
  render(parent: Node, _nextSibling: Node) {
    this.parentDomNode = parent;
    this.execute();

    const containerElement = document.createElement('div');
    containerElement.innerHTML = 'This is a widget!';
    this.domNodes.push(containerElement);
    parent.appendChild(containerElement);
  }
}

export { ExampleWidget as test };
