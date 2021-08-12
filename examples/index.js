import { parseHtmlToAst, buildAstToHtml, diffAst, patchAst, traverseAst } from '../src/index.js'

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

const visitor = {
  '*': {
    enter(node, parent) {
      // 去掉所有换行逻辑
      if (typeof node === 'string' && /\n\s*/.test(node)) {
        const index = parent.indexOf(node)
        parent.splice(index, 1)
      }
    },
  },
}

const ast = parseHtmlToAst(html)
traverseAst(ast, visitor)
console.log('ast:', ast)

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
    <div>4xxx</div>
  </body>
</html>
`
const ast2 = parseHtmlToAst(html2)
console.log('ast2:', ast2)

const tiny = false
const mutations = diffAst(ast, ast2, tiny)
console.log('mutations:', mutations)

const ast3 = patchAst(ast, mutations, tiny)
console.log('ast3:', ast3)

const html3 = buildAstToHtml(ast3)
console.log(html3)
