# ABS-HTML

将HTML转化为Ast后处理，实现HTML的无状态计算。

## 安装

```sh
npm i abs-html
```

```js
import {
  parseHtmlToAst,
  buildAstToHtml,
  diffAst,
  patchAst,
} from 'abs-html'
```

## 使用

### parseHtmlToAst(html: visit): Ast

- html HTML字符串，注意，只能包含一个根节点
- visit 生成节点时，可通过visit函数进行修改

```js
const ast = parseHtmlToAst(`
  <!DOCTYPE html>
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
`)

/**
[
    "!DOCTYPE",
    {
        "html": null
    },
    [
        "html",
        null,
        [
            "head",
            null,
            [
                "title",
                null,
                "xxx"
            ]
        ],
        [
            "body",
            null,
            [
                "#comment",
                null,
                " comment "
            ],
            [
                "div",
                {
                    "class": "dog"
                },
                "content"
            ],
            [
                "div",
                {
                    "id": "xx"
                },
                "111"
            ],
            [
                "div",
                {
                    "class": "cat"
                },
                "cat"
            ],
            [
                "img",
                {
                    "src": "http://xxx.com/a.jpg"
                }
            ],
            [
                "div",
                null,
                ""
            ],
            [
                "my-app"
            ]
        ]
    ]
]
*/
```

### buildAstToHtml(ast)

```js
const html = buildAstToHtml(ast)

/**
<!DOCTYPE html>
<html>...</html>
*/
```

### diffAst(ast1, ast2, tiny)

查看ast2相对于ast1而言，有哪些变化。

```js
const mutations = diffAst(ast1, ast2)
```

- tiny: boolean 是否使用体积最小的变化记录，开启后，被记录的mutations体积会缩小30%以上，但不利于阅读

### patchAst(ast, mutations, tiny?)

将mutations作用于一个ast，得到一个新的经过改变的ast。
如果tiny没有传，会通过前5个mutation的属性存在情况自动判定。

```js
const ast2 = patchAst(ast, mutations)
```

注意，由于diff算法的一些局限性，loose参数为true时，可能无法准确还原换行。
