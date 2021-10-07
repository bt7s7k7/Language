import { SourceFile } from "./parsing/SourceFile"

export function stringifySpan(file: SourceFile, line: number, column: number, length: number) {
    const lineText = file.getLine(line)
    const mark = " ".repeat(column) + (length == 1 ? "^" : "~".repeat(length))

    return line + " | " + lineText + "\n" + " ".repeat(line.toString().length + 3) + mark
}