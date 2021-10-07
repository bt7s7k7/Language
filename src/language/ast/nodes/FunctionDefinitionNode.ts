import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { BlockNode } from "./BlockNode"
import { ArgumentDeclarationNode } from "./DeclarationNode"

export class FunctionDefinitionNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string,
        public readonly args: ArgumentDeclarationNode[],
        public readonly body: BlockNode | null
    ) { super(span) }
}