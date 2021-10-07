import { Diagnostic } from "../Diagnostic"
import { Position } from "../Position"
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

            return false
        }

        function parseRoot() {
            const ret: any[] = []
            for (; ;) {
                skipWhitespace()
                if (willEOF()) break

                if (consume("function")) {
                    ret.push(parseFunctionStatement())
                    continue
                }

                throw new ParsingFailure("Unexpected character")
            }

            return ret
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

        function parseFunctionStatement() {
            skipWhitespace()
            const name = consumeWord()
            const start = makePos()
            skipWhitespace()
            if (consume("(")) {
                if (!consume(")")) throw new ParsingFailure("Expected \")\"")
            }
            skipWhitespace()
            if (consume("{")) {
                skipWhitespace()
                if (!consume("}")) throw new ParsingFailure(`Expected "}"`)
            } else throw new ParsingFailure("Expected function body")

            return new Token(name?.span ?? start.span(1), name?.value ?? "[anonymous]")
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