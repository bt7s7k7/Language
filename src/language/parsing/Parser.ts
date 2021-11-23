import { unreachable } from "../../comTypes/util"
import { ASTNode } from "../ast/ASTNode"
import { BlockNode } from "../ast/nodes/BlockNode"
import { DeclarationNode } from "../ast/nodes/DeclarationNode"
import { ExpressionNode } from "../ast/nodes/ExpressionNode"
import { ForNode } from "../ast/nodes/ForNode"
import { FunctionDefinitionNode } from "../ast/nodes/FunctionDefinitionNode"
import { IdentifierNode } from "../ast/nodes/IdentifierNode"
import { IfStatementNode } from "../ast/nodes/IfStatementNode"
import { InvocationNode } from "../ast/nodes/InvocationNode"
import { NumberLiteral } from "../ast/nodes/NumberLiteral"
import { OperatorNode } from "../ast/nodes/OperatorNode"
import { ReturnStatementNode } from "../ast/nodes/ReturnStatement"
import { RootNode } from "../ast/nodes/RootNode"
import { StringLiteral } from "../ast/nodes/StringLiteral"
import { ImplicitSpecializationStrategy, IMPLICIT_SPECIALIZATION_STRATEGY_TYPES, TemplateNode, TemplateParameter } from "../ast/nodes/TemplateNode"
import { TupleNode } from "../ast/nodes/TupleNode"
import { VariableDeclarationNode } from "../ast/nodes/VariableDeclarationNode"
import { WhileNode } from "../ast/nodes/WhileNode"
import { Diagnostic } from "../Diagnostic"
import { Position } from "../Position"
import { CharClass } from "./CharClass"
import { SourceFile } from "./SourceFile"
import { Token } from "./Token"

class ParsingFailure extends Error {
    public name = "ParsingFailure"
}

interface OperatorDefinition {
    name: string
    text: string
    type: "binary" | "prefix" | "suffix" | (() => void)
    presentence: number
}

declare module "../ast/nodes/OperatorNode" {
    export interface OperatorNode {
        meta: OperatorDefinition | null
    }
}

const OPERATORS: OperatorDefinition[] = [
    { name: "deref", text: ".*", type: "suffix", presentence: 0 },
    { name: "as_slice", text: "[]", type: "prefix", presentence: 0 },
    { name: "member", text: ".", type: "binary", presentence: 0 },
    { name: "as_ptr", text: "*", type: "prefix", presentence: 0 },
    { name: "addr", text: "&", type: "prefix", presentence: 1 },
    { name: "negate", text: "-", type: "prefix", presentence: 1 },
    { name: "mul", text: "*", type: "binary", presentence: 2 },
    { name: "div", text: "/", type: "binary", presentence: 2 },
    { name: "mod", text: "%", type: "binary", presentence: 2 },
    { name: "add", text: "+", type: "binary", presentence: 3 },
    { name: "sub", text: "-", type: "binary", presentence: 3 },
    { name: "eq", text: "==", type: "binary", presentence: 4 },
    { name: "gte", text: ">=", type: "binary", presentence: 4 },
    { name: "lte", text: "<=", type: "binary", presentence: 4 },
    { name: "gt", text: ">", type: "binary", presentence: 4 },
    { name: "lt", text: "<", type: "binary", presentence: 4 },
    { name: "or", text: "||", type: "binary", presentence: 5 },
    { name: "and", text: "&&", type: "binary", presentence: 5 },
    { name: "assign", text: "=", type: "binary", presentence: 6 },
]

const MAX_PRESENTENCE = 7

const INDEX_OPERATOR: OperatorDefinition = { name: "index", presentence: 0, text: "[", type: "suffix" }

export namespace Parser {
    export function parse(file: SourceFile) {
        let index = 0
        let line = 0
        let column = 0

        const content = file.content

        function makePos() {
            return new Position(line, column, file)
        }

        function next() {
            if (content[index] == "\n") {
                line++
                column = 0
            } else {
                column++
            }
            if (index >= content.length) {
                throw new ParsingFailure("Unexpected EOF")
            }
            index++
        }

        function willEOF() {
            return index >= content.length
        }

        function skipWhitespace() {
            while (!willEOF() && CharClass.isWhitespace(content[index])) next()
        }

        function matches(key: string) {
            return content.startsWith(key, index)
        }

        function consume(key: string) {
            if (matches(key)) {
                for (let i = 0; i < key.length; i++) next()
                return true
            }

            return null
        }

        function parseTemplateDeclaration() {
            const start = makePos()
            if (!consume("(")) throw new ParsingFailure("Expected \"(\"")
            const params = parseEnumerated((): TemplateParameter => {
                const name = consumeWord()
                if (!name) throw new ParsingFailure("Expected template parameter name")
                skipWhitespace()
                let strategy: ImplicitSpecializationStrategy | null = null
                if (consume("is")) {
                    skipWhitespace()
                    const type = consumeWord() as Token<ImplicitSpecializationStrategy["type"]>
                    if (!type) throw new ParsingFailure("Expected ISS name")
                    if (!IMPLICIT_SPECIALIZATION_STRATEGY_TYPES.includes(type.data)) throw new ParsingFailure("Invalid ISS name")
                    skipWhitespace()
                    const argument = parseNumberLiteral()

                    strategy = { type: type.data, index: argument.value }
                }

                return { span: name.span, name: name.data, strategy }
            }, ",", ")")

            return new TemplateNode(start.span(-8), params, null)
        }

        function parseRoot() {
            const rootNode = new RootNode(makePos().span(1))
            let template: TemplateNode | null = null

            function addChild(node: ASTNode) {
                if (template) {
                    template.entity = node
                    rootNode.addChild(template)
                    template = null
                } else {
                    rootNode.addChild(node)
                }
            }

            for (; ;) {
                skipWhitespace()
                if (willEOF()) break

                if (consume("template")) {
                    if (template) throw new ParsingFailure("Cannot nest template definitions")
                    template = parseTemplateDeclaration()
                    continue
                }

                if (consume("function")) {
                    addChild(parseFunctionStatement())
                    continue
                }

                throw new ParsingFailure("Unexpected character")
            }

            return rootNode
        }

        function consumeWord<T extends boolean = false>(strict?: T): T extends true ? Token<string> : Token<string> | null {
            if (!CharClass.isWord(content[index])) {
                if (strict) throw new ParsingFailure("Expected word")
                // @ts-ignore
                return null
            }
            const pos = makePos()
            const start = index
            while (!willEOF() && CharClass.isWord(content[index])) next()
            const end = index
            const word = content.slice(start, end)
            return new Token(pos.span(end - start), word)
        }

        function parseEnumerated<T>(parser: () => T, delim: string | null, term: string) {
            if (consume(term)) {
                return []
            }

            const ret: T[] = []
            for (; ;) {
                skipWhitespace()

                const value = parser()
                ret.push(value)

                skipWhitespace()

                if (consume(term)) {
                    break
                }

                if (delim && !consume(delim)) throw new ParsingFailure(`Expected "${delim}"`)
            }

            return ret
        }

        function postProcessExpression(expression: ExpressionNode) {
            for (let i = 0; i < MAX_PRESENTENCE; i++) {
                for (let ii = 0; ii < expression.children.length; ii++) {
                    const child = expression.children[ii]
                    if (child instanceof OperatorNode && child.meta && child.meta.presentence == i) {
                        if (child.meta.type == "binary") {
                            if (ii == 0) throw unreachable()
                            if (ii == expression.children.length - 1) throw unreachable()

                            const leftOperand = expression.children.splice(ii - 1, 1)[0]
                            child.addChild(leftOperand)
                            ii--
                            const rightOperand = expression.children.splice(ii + 1, 1)[0]
                            child.addChild(rightOperand)
                        } else if (child.meta.type == "prefix") {
                            if (ii == expression.children.length - 1) throw unreachable()
                            const operand = expression.children[ii + 1]
                            if (operand instanceof OperatorNode && operand.meta) continue
                            expression.children.splice(ii + 1, 1)
                            child.addChild(operand)
                            ii -= 2
                        } else if (child.meta.type == "suffix") {
                            if (ii == 0) throw unreachable()
                            const operand = expression.children.splice(ii - 1, 1)[0]
                            child.children.unshift(operand)
                            ii--
                        }

                        child.meta = null
                    } else if (child instanceof InvocationNode && child.target == null) {
                        if (ii == 0) throw unreachable()
                        const operand = expression.children.splice(ii - 1, 1)[0]
                        child.target = operand
                        child.span = operand.span
                        ii--
                    }
                }
            }

            if (expression.children.length > 1) throw unreachable()
        }

        function parseArguments(term: string) {
            const args: ExpressionNode[] = []
            skipWhitespace()
            if (!consume(term)) for (; ;) {
                skipWhitespace()

                args.push(parseExpression())

                skipWhitespace()

                if (consume(term)) break
                if (!consume(",")) throw new ParsingFailure(`Expected expression or "," or "${term}"`)
            }

            return args
        }

        function parseStringLiteral(term: string, type: StringLiteral["type"]) {
            const start = makePos()
            const startIndex = index
            const chars: string[] = []
            while (!consume(term)) {
                let curr = content[index]
                next()

                if (curr == "\\") {
                    if (consume("n")) curr = "\n"
                    else if (consume("r")) curr = "\r"
                    else if (consume("\\")) curr = "\\"
                    else if (consume("t")) curr = "\t"
                    else if (consume("u")) {
                        const hex = content.substr(index, 4)
                        next(); next(); next(); next()
                        const number = parseInt(hex, 16)
                        curr = String.fromCharCode(number)
                    }
                }

                chars.push(curr)
            }

            if (type == "char" && chars.length != 1) throw new ParsingFailure(`Character literal must contain exactly 1 character`)

            return new StringLiteral(start.span(index - startIndex), chars.join(""), type)
        }

        function parseNumberLiteral() {
            const start = makePos()
            const type =
                consume("0x") ? "hex" :
                    consume("0b") ? "bin" :
                        "dec"

            let src = ""
            let isDecimal = false
            if (type == "dec") while (!willEOF() && CharClass.isNumeric(content[index])) { src += content[index]; next() }
            if (type == "hex") while (!willEOF() && CharClass.isHexDigit(content[index])) { src += content[index]; next() }
            if (type == "bin") while (!willEOF() && (content[index] == "1" || content[index] == "0")) { src += content[index]; next() }

            if (type == "dec") {
                if (consume(".")) {
                    src += "."
                    isDecimal = true
                    while (!willEOF() && CharClass.isNumeric(content[index])) { src += content[index]; next() }
                }

                if (consume("e") || consume("E")) {
                    src += "e"
                    isDecimal = true
                    if (consume("+")) src += "+"
                    else if (consume("-")) src += "-"
                    while (!willEOF() && CharClass.isNumeric(content[index])) { src += content[index]; next() }
                }
            }

            let subtype: NumberLiteral["type"] = "number"

            if (consume("c")) subtype = "char"

            return new NumberLiteral(start.span(src.length),
                type == "dec" ? (isDecimal ? parseFloat(src) : parseInt(src))
                    : parseInt(src, type == "hex" ? 16 : 2),
                subtype
            )
        }

        function parseExpression(barrier: string | null = null) {
            skipWhitespace()
            const ret = new ExpressionNode(makePos().span(1))
            let hasTarget = false
            top: for (; ;) {
                skipWhitespace()

                const start = makePos()
                if (!willEOF() && !matches("=>") && (barrier == null || !matches(barrier))) if (!hasTarget) {
                    if (consume("var")) {
                        skipWhitespace()
                        const name = consumeWord()
                        if (!name) throw new ParsingFailure("Expected variable name")
                        skipWhitespace()
                        let type: ExpressionNode | null = null
                        if (consume(":")) {
                            skipWhitespace()
                            type = parseExpression("=")
                            skipWhitespace()
                        }
                        let body: ExpressionNode | null = null
                        if (consume("=")) {
                            skipWhitespace()
                            body = parseExpression()
                        }
                        ret.addChild(new VariableDeclarationNode(name.span, name.data, type, body))
                        hasTarget = true
                        continue
                    }

                    if (consume("if")) {
                        skipWhitespace()
                        const invert = consume("not") == true
                        skipWhitespace()
                        if (!consume("(")) throw new ParsingFailure(`Expected "("`)
                        const predicate = parseExpression()
                        if (!consume(")")) throw new ParsingFailure(`Expected ")"`)
                        skipWhitespace()
                        const body = consume("{") ? parseBlock("}") : parseExpression()
                        skipWhitespace()
                        const elseClause = consume("else") ? (skipWhitespace(), consume("{") ? parseBlock("}") : parseExpression()) : null
                        ret.addChild(new IfStatementNode(start.span(2), predicate, invert, body, elseClause))
                        hasTarget = true
                        continue
                    }

                    if (consume("while")) {
                        skipWhitespace()
                        if (!consume("(")) throw new ParsingFailure(`Expected "("`)
                        const predicate = parseExpression()
                        if (!consume(")")) throw new ParsingFailure(`Expected ")"`)
                        skipWhitespace()
                        const body = consume("{") ? parseBlock("}") : parseExpression()
                        ret.addChild(new WhileNode(start.span(5), predicate, body))
                        hasTarget = true
                        continue
                    }

                    if (consume("for")) {
                        skipWhitespace()
                        if (!consume("(")) throw new ParsingFailure(`Expected "("`)
                        const predicateBlock = parseEnumerated(() => matches(";") || matches(")") ? null : parseExpression(), ";", ")")
                        if (predicateBlock.length != 3) throw new ParsingFailure("For statement must have three statements in predicate block")
                        const [initializer, predicate, increment] = predicateBlock
                        skipWhitespace()
                        const body = consume("{") ? parseBlock("}") : parseExpression()
                        ret.addChild(new ForNode(start.span(3), initializer, predicate, increment, body))
                        hasTarget = true
                        continue
                    }

                    if (consume("return")) {
                        skipWhitespace()
                        const body = parseExpression()
                        ret.addChild(new ReturnStatementNode(start.span(6), body))
                        break
                    }

                    for (const operator of OPERATORS) {
                        if (matches(operator.text)) {
                            if (operator.type != "prefix") continue
                            consume(operator.text)
                            ret.addChild(new OperatorNode(start.span(operator.text.length), operator.name)).meta = operator
                            continue top
                        }
                    }

                    if (CharClass.isNumeric(content[index])) {
                        ret.addChild(parseNumberLiteral())
                        hasTarget = true
                        continue
                    }

                    {
                        const identifier = consumeWord()
                        if (identifier) {
                            ret.addChild(new IdentifierNode(identifier.span, identifier.data))
                            hasTarget = true
                            continue
                        }
                    }

                    if (consume("(")) {
                        ret.addChild(parseExpression())
                        if (!consume(")")) throw new ParsingFailure(`Expected ")"`)
                        hasTarget = true
                        continue
                    }

                    if (consume(".[")) {
                        const members = parseEnumerated(() => parseExpression(), ",", "]")
                        ret.addChild(new TupleNode(start.span(2), members))
                        hasTarget = true
                        continue
                    }

                    if (consume("'")) {
                        ret.addChild(parseStringLiteral("'", "char"))
                        hasTarget = true
                        continue
                    }

                    if (consume("\"")) {
                        ret.addChild(parseStringLiteral("\"", "string"))
                        hasTarget = true
                        continue
                    }
                } else {
                    for (const operator of OPERATORS) {
                        if (matches(operator.text)) {
                            if (operator.type == "prefix") continue
                            consume(operator.text)
                            if (operator.type == "binary") hasTarget = false
                            ret.addChild(new OperatorNode(start.span(operator.text.length), operator.name)).meta = operator
                            continue top
                        }
                    }

                    if (consume("(")) {
                        const start = makePos()
                        const args = parseArguments(")")

                        ret.addChild(new InvocationNode(start.span(1), args))
                        continue
                    }

                    if (consume("[")) {
                        const start = makePos()
                        const args = parseArguments("]")

                        const operator = ret.addChild(new OperatorNode(start.span(1), INDEX_OPERATOR.name))
                        operator.addChildren(args)
                        operator.meta = INDEX_OPERATOR

                        continue
                    }
                }

                if (hasTarget) break

                throw new ParsingFailure("Expected expression")
            }

            postProcessExpression(ret)

            return ret
        }

        function parseBlock(term: string) {
            const block = new BlockNode(makePos().span(1))
            for (; ;) {
                skipWhitespace()

                if (consume(term)) {
                    break
                }

                block.addChild(parseExpression())

                skipWhitespace()
                consume(";")
            }

            return block
        }

        function parseDeclaration() {
            const name = consumeWord()
            if (!name) throw new ParsingFailure("Expected identifier")
            skipWhitespace()
            const type = consume(":") && (skipWhitespace(), parseExpression())
            skipWhitespace()
            const value = consume("=") && (skipWhitespace(), parseExpression())

            return new DeclarationNode(name.span, name.data, type, value)
        }

        function parseFunctionStatement() {
            skipWhitespace()
            const name = consumeWord()
            const start = makePos()
            skipWhitespace()
            const args = consume("(") ? parseEnumerated(() => parseDeclaration(), ",", ")") : []
            skipWhitespace()
            const type = consume(":") ? (skipWhitespace(), parseExpression()) : null
            skipWhitespace()
            let body: FunctionDefinitionNode["body"] | null = consume("{") ? parseBlock("}") : null
            if (!body && consume("=>")) {
                skipWhitespace()
                if (consume("extern")) {
                    body = "extern"
                } else {
                    body = parseExpression()
                }
            }

            if (!body) throw new ParsingFailure("Expected function body")

            return new FunctionDefinitionNode(name?.span ?? start.span(1), name?.data ?? "[anonymous]", args, type, body)
        }

        try {
            return parseRoot()
        } catch (err) {
            if (err instanceof ParsingFailure) {
                return new Diagnostic(err.message, makePos().span(1))
            } else {
                throw err
            }
        }
    }
}