import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { BlockNode } from "./BlockNode"
import { ArgumentDeclarationNode } from "./DeclarationNode"
import { TypeReferenceNode } from "./TypeReferenceNode"

export class FunctionDefinitionNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string,
        public readonly args: ArgumentDeclarationNode[],
        public readonly type: TypeReferenceNode | null,
        public readonly body: BlockNode
    ) { super(span) }
}