import { parseHTMLToHyperJSON, rebuildHyperJSONToHTML, diffHyperJSON, patchHyperJSON } from '../src/index.js'

const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD SVG 1.1//EN">
<html>
  <head>
    <title>xxx</title>
  </head>
  <body>
    <!-- comment -->
    <div class="dog">content</div>
    <div id="xx">111</div>
    <div class="cat">cat</div>
    <img src="http://xxx.com/a.jpg" />
    <div></div>
    <my-app data-text="my dog's name is \\"doly\\"" />
  </body>
</html>
`
const json = parseHTMLToHyperJSON(html, { loose: true })
console.log(json)

const str = rebuildHyperJSONToHTML(json)
console.log(str)

const html2 = `
<!DOCTYPE html PUBLIC "-//W3C//DTD SVG 1.1//EN">
<html>
  <head>
    <title>xxx</title>
  </head>
  <body>
    <!-- comment1 -->
    <div class="dog2">content</div>
    <div id="xx">1113</div>
    <new-node />
    <div class="cat">cat</div>
    <img src="http://xxx.com/a.jpg" />
    <my-app data-text="my dog's name is \\"doly\\" 5" />
    <div>4</div>
  </body>
</html>
`
const json2 = parseHTMLToHyperJSON(html2, { loose: true })
const mutations = diffHyperJSON(json, json2)
console.log(mutations)

const json3 = patchHyperJSON(json, mutations)
console.log(json3)

const html3 = rebuildHyperJSONToHTML(json3)
console.log(html3)
