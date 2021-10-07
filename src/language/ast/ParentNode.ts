import { ASTNode } from "./ASTNode"

export class ParentNode extends ASTNode {
    public readonly children: ASTNode[] = []

    public addChild(child: ASTNode) {
        this.children.push(child)
    }
}