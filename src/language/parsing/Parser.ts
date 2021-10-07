import { transform } from "../../comTypes/util"
import { BlockNode } from "../ast/nodes/BlockNode"
import { ArgumentDeclarationNode } from "../ast/nodes/DeclarationNode"
import { ExpressionNode } from "../ast/nodes/ExpressionNode"
import { FunctionDefinitionNode } from "../ast/nodes/FunctionDefinitionNode"
import { IdentifierNode } from "../ast/nodes/IdentifierNode"
import { InvocationNode } from "../ast/nodes/InvocationNode"
import { RootNode } from "../ast/nodes/RootNode"
import { TypeReferenceNode } from "../ast/nodes/TypeReferenceNode"
import { Diagnostic } from "../Diagnostic"
import { Position } from "../Position"
import { Span } from "../Span"
import { CharClass } from "./CharClass"
import { SourceFile } from "./SourceFile"
import { Token } from "./Token"

class ParsingFailure extends Error {
    public name = "ParsingFailure"
}

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
            index++
            if (index >= content.length) {
                throw new ParsingFailure("Unexpected EOF")
            }
        }

        function willEOF() {
            return index + 1 >= content.length
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

        function parseRoot() {
            const rootNode = new RootNode(makePos().span(1))
            for (; ;) {
                skipWhitespace()
                if (willEOF()) break

                if (consume("function")) {
                    rootNode.addChild(parseFunctionStatement())
                    continue
                }

                throw new ParsingFailure("Unexpected character")
            }

            return rootNode
        }

        function consumeWord() {
            if (!CharClass.isWord(content[index])) return null
            const pos = makePos()
            const start = index
            while (CharClass.isWord(content[index])) next()
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
                if (value) {
                    ret.push(value)
                }

                skipWhitespace()

                if (consume(term)) {
                    break
                }

                if (delim && value && !consume(delim)) throw new ParsingFailure(`Expected "${delim}"`)
            }

            return ret
        }

        function parseExpression(term: string | (() => true | null)) {
            if (typeof term == "string") term = transform(term, v => () => consume(v))
            const ret = new ExpressionNode(makePos().span(1))
            for (; ;) {
                skipWhitespace()

                if (term()) {
                    break
                }

                {
                    const identifier = consumeWord()
                    if (identifier) {
                        ret.addChild(new IdentifierNode(identifier.span, identifier.data))
                        continue
                    }
                }

                if (consume("(")) {
                    if (ret.children.length == 0 /* TODO: Detect if previous node is an operator */) {
                        ret.addChild(parseExpression(")"))
                    } else {
                        const target = ret.children.pop()!
                        const args: ExpressionNode[] = []
                        skipWhitespace()
                        if (!consume(")")) for (; ;) {
                            skipWhitespace()

                            args.push(parseExpression(() => consume(",") || consume(")")))

                            if (content[index - 1] == ")") break
                            if (content[index - 1] != ",") throw new ParsingFailure(`Expected expression or "," or ")"`)
                        }

                        ret.addChild(new InvocationNode(target.span, target, args))
                    }

                    continue
                }

                throw new ParsingFailure("Unexpected character")
            }

            return ret
        }

        function parseBlock(term: string) {
            const block = new BlockNode(makePos().span(1))
            for (; ;) {
                skipWhitespace()

                if (consume(term)) {
                    break
                }

                block.addChild(parseExpression(";"))

            }

            return block
        }

        function parseType() {
            const ret = consumeWord()
            if (!ret) throw new ParsingFailure(`Expected type`)
            return new TypeReferenceNode(ret.span, ret.data)
        }

        function parseDeclaration<T, R>(valueParser: () => T, ctor: new (span: Span, name: string, type?: TypeReferenceNode | null, value?: T | null) => R) {
            const name = consumeWord()
            if (!name) throw new ParsingFailure("Expected identifier")
            skipWhitespace()
            const type = consume(":") && (skipWhitespace(), parseType())
            skipWhitespace()
            const value = consume("=") && (skipWhitespace(), valueParser())

            return new ctor(name.span, name.data, type, value)
        }

        function parseFunctionStatement() {
            skipWhitespace()
            const name = consumeWord()
            const start = makePos()
            skipWhitespace()
            const args = consume("(") ? parseEnumerated(() => parseDeclaration(parseType, ArgumentDeclarationNode), ",", ")") : []
            skipWhitespace()
            const body = consume("{") ? parseBlock("}") : null

            return new FunctionDefinitionNode(name?.span ?? start.span(1), name?.data ?? "[anonymous]", args, body)
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