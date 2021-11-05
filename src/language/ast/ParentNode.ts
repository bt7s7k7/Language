import { Readwrite } from "../../comTypes/types"
import { ASTNode } from "./ASTNode"

export class ParentNode extends ASTNode {
    public readonly children: ASTNode[] = []

    public addChild<T extends ASTNode>(child: T) {
        this.children.push(child)
        return child
    }

    public addChildren(children: ASTNode[]) {
        if (this.children.length == 0) {
            (this as Readwrite<this>).children = children
            return
        }

        this.children.push(...children)
    }
}