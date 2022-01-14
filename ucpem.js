/// <reference path="./.vscode/config.d.ts" />

const { project, github } = require("ucpem")

project.prefix("src").use(github("bt7s7k7/TextFormat").res("textFormatANSI"))

project.prefix("src").res("language",
    github("bt7s7k7/CommonTypes").res("comTypes"),
    github("bt7s7k7/TextFormat").res("textFormat")
)
