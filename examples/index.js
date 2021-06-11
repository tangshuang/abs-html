import { parseHTMLToHyperJSON, rebuildHyperJSONToHTML, diffHyperJSON, patchHyperJSON } from '../src/index.js'

const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD SVG 1.1//EN">
<html>
    <head>
    <title>xxx</title>
    </head>
    <body>
    <-- comment -->
    <div class="dog">content</div>
    <div id="xx">111</div>
    <div class="cat">cat</div>
    <img src="http://xxx.com/a.jpg" />
    <div></div>
    <my-app />
    </body>
</html>
`
const json = parseHTMLToHyperJSON(html)

// const str = rebuildHyperJSONToHTML(json)
// console.log(str)

const html2 = `
<!DOCTYPE html>
<html>
    <head>
    <title>aaa</title>
    </head>
    <body>
    <-- comxxment -->
    <div id="xx">111</div>
    <div class="dog">aaa</div>
    <img src="http://aaa.com/a.jpg" />
    <div></div>
    <my-app />
    </body>
</html>
`
const json2 = parseHTMLToHyperJSON(html2)

console.log(json, json2)

const mutations = diffHyperJSON(json, json2)
console.log(mutations)

const json3 = patchHyperJSON(json, mutations)
console.log(json3)

const html3 = rebuildHyperJSONToHTML(json3)
console.log(html3)

// console.log(parseHTMLToHyperJSON(`<div></div>`))
