# ABS-HTML

将HTML转化为[HyperJSON](https://www.tangshuang.net/8026.html)后处理，实现HTML的无状态计算。

## 安装

```html
<script src="//unpkg.com/abs-html"></script>
<script>
  const {
    parseHTMLToHyperJSON,
    rebuildHyperJSONToHTML,
    diffHyperJSON,
    patchHyperJSON,
  } = window
</script>
```

```sh
npm i abs-html
```

```js
import {
  parseHTMLToHyperJSON,
  rebuildHyperJSONToHTML,
  diffHyperJSON,
  patchHyperJSON,
} from 'abs-html'
```

## 使用

### parseHTMLToHyperJSON(html, { loose })

- html HTML字符串，注意，只能包含一个根节点
- loose 是否宽松，开启后，将保留标签换行（和原始html换行一致）

```js
const hyperJSON = parseHTMLToHyperJSON(`
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

### rebuildHyperJSONToHTML(hyperJSON)

```js
const html = rebuildHyperJSONToHTML(hyperJSON)

/**
<!DOCTYPE html><html>...</html>
*/
```

注意，恢复出来的html是否紧凑，完全由创建hyperJSON时传入的loose参数决定。

### diffHyperJSON(hyperJSON1, hyperJSON2)

查看hyperJSON2相对于hyperJSON1而言，有哪些变化。

```js
const mutations = diffHyperJSON(hyperJSON1, hyperJSON2)
```

### patchHyperJSON(hyperJSON, mutations)

将mutations作用于一个hyperJSON，得到一个新的经过改变的hyperJSON。

```js
const hyperJSON2 = patchHyperJSON(hyperJSON, mutations)
```

注意，由于diff算法的一些局限性，loose参数为true时，可能无法准确还原换行。
