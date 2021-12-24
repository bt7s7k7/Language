import { ASTNode } from "./ASTNode"

export abstract class ComplexSuffixNode extends ASTNode {
    public target!: ASTNode
}