import { ASTNode } from "./ASTNode"

export class ParentNode extends ASTNode {
    public readonly children: ASTNode[] = []

    public addChild<T extends ASTNode>(child: T) {
        this.children.push(child)
        return child
    }
}