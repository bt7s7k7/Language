import { SourceFile } from "./parsing/SourceFile"

export function stringifySpan(file: SourceFile, line: number, column: number, length: number) {
    const lineText = file.getLine(line)
    const mark = " ".repeat(column) + (length == 1 ? "^" : "~".repeat(length))

    return line + " | " + lineText + "\n" + " ".repeat(line.toString().length + 3) + mark
}

export function stringifyValue(value: any) {
    if (typeof value == "string") return JSON.stringify(value)
    if (typeof value == "object") {
        if (!value) return "<null>"

        if ("getName" in value) return value.getName()

        return "[" + value.constructor.name + "]"
    }

    if (value == undefined) {
        return "<undefined>"
    }

    return value.toString()
}
