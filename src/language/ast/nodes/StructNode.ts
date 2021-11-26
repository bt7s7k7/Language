import { ASTNode } from "../ASTNode"
import { StructPropertyNode } from "./StructPropertyNode"


export class StructNode extends ASTNode {
    public readonly properties: StructPropertyNode[] = [];
}
