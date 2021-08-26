const SELF_CLOSE_TAGS = [
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]

/**
 * 将html字符串解析为ast
 * @param {string} html
 * @param {function} visit 访问第一次生成时的节点，返回新节点信息
 * @returns ast
 */
export function parseHtmlToAst(html, visit) {
  const nest = []

  const len = html.length

  let inTagBegin = null
  let inTag = null

  const nodes = []

  for (let i = 0; i < len; i ++) {
    let char = html[i]
    const next = html[i + 1]
    // 关闭标签
    if (inTag && char === '<' && next === '/') {
      while (char !== '>') {
        i ++
        char = html[i]
      }

      // TODO check intag

      const node = inTag
      if (node.length < 3) {
        node[1] = node[1] || null
        node[2] = ''
      }

      nest.pop()
      inTag = nest[nest.length - 1]
    }
    // 开始一个标签
    else if (!inTagBegin && char === '<' && html[i + 1] !== ' ') {
      if (html[i + 1] === '!' && html[i + 2] === '-' && html[i + 3] === '-') {
        const comment = ['#comment', null]
        let content = ''

        i += 4
        char = html[i]

        while (!(char === '-' && html[i + 1] === '-' && html[i + 2] === '>')) {
          content += char

          i ++
          char = html[i]
        }

        comment[2] = content
        const parent = nest.length ? nest[nest.length - 1] : nest
        parent.push(comment)

        i += 2
        continue
      }

      let tag = ''

      i ++
      char = html[i]

      while (char !== ' ' && char !== '>') {
        tag += char

        i ++
        char = html[i]
      }

      const node = [tag.trim()]
      inTagBegin = node
      nodes.push(node)

      i --
    }
    // 属性
    else if (inTagBegin && char === ' ') {
      let quota = ''
      let name = ''
      let value = ''

      const node = inTagBegin
      const putAttr = (data) => {
        name = name.trim()
        if (!name) {
          return
        }

        node[1] = node[1] || {}
        node[1][name] = data
        name = ''
        value = ''
        quota = ''
      }

      while (i < len) {
        i ++
        char = html[i]

        // 忽略空格
        if (!quota && char === ' ') {
          // 有些属性被放在引号中，有空格
          if (name[0] !== '"' && name[0] !== "'") {
            // 没有值的属性结束
            if (name) {
              putAttr(null)
            }
            continue
          }
        }

        // 立即自关闭标签，例如 <img />
        if (!quota && char === '/' && html[i + 1] === '>') {
          const parent = nest.length ? nest[nest.length - 1] : nest
          parent.push(node)
          inTagBegin = null
          i ++
          putAttr(null)
          break
        }

        // 关闭开始标签，例如 <div >
        if (!quota && char === '>') {
          i --
          putAttr(null)
          break
        }

        // 属性名结束，值开始
        if (!quota && char === '=') {
          i ++
          char = html[i]
          quota = char
          continue
        }

        if (!quota) {
          name += char
          continue
        }

        // 值结束
        if (quota && (char === quota) && html[i - 1] !== '\\') {
          putAttr(value)
          continue
        }

        if (quota) {
          value += char
          continue
        }
      }
    }
    // 开始标签结束
    else if (inTagBegin && char === '>') {
      const node = visit ? visit(inTagBegin) : inTagBegin
      const parent = nest.length ? nest[nest.length - 1] : nest
      parent.push(node)
      nest.push(node)
      node[1] = node[1] || null // 强制props
      inTagBegin = null
      inTag = node

      if (SELF_CLOSE_TAGS.indexOf(node[0]) > -1) {
        nest.pop()
        inTag = nest[nest.length - 1]
      }
    }
    else if (inTag) {
      const node = inTag
      if (node.length < 3) {
        node[1] = node[1] || null
        node[2] = char
      }
      else if (typeof node[node.length - 1] === 'string') {
        node[node.length - 1] += char
      }
      else {
        node.push(char)
      }
    }
  }

  return nest[0]
}

export function buildAstToHtml(ast) {
  const [name, attrs, ...children] = ast

  let html = ''

  const buildAttrs = (attrs) => {
    let str = ''

    if (!attrs) {
      return str
    }

    const keys = Object.keys(attrs)
    keys.forEach((key) => {
      const value = attrs[key]
      if (value === null) {
        str += ` ${key}`
      }
      else {
        str += ` ${key}="${value.replace(/\\"/gm, '"').replace(/"/gm, '\\"')}"`
      }
    })

    return str
  }
  const buildChildren = (children) => {
    let str = ''

    if (!children || !children.length) {
      return str
    }

    children.forEach((child) => {
      if (typeof child === 'string') {
        str += child
      }
      else {
        str += buildAstToHtml(child)
      }
    })

    return str
  }

  if (name.indexOf('!') === 0 || name.indexOf('?') === 0) {
    html += `<${name}${buildAttrs(attrs)}>${buildChildren(children)}`
  }
  else if (name.indexOf('#') === 0) {
    if (name === '#comment') {
      html += `<--${children[0]}-->`
    }
  }
  else if (children.length) {
    html += `<${name}${buildAttrs(attrs)}>${buildChildren(children)}</${name}>`
  }
  else {
    html += `<${name}${buildAttrs(attrs)} />`
  }

  return html
}

export function traverseAst(ast, visitor) {
  function traverseNode(node, parent, index) {
    // 字符串仅支持enter处理
    if (typeof node === 'string') {
      const enter = visitor['[[String]]'] && visitor['[[String]]'].enter
      if (enter) {
        enter(node, parent, index)
      }
      return
    }

    const [type] = node
    const methods = visitor[type] || visitor['*']

    if (methods && methods.enter) {
      methods.enter(node, parent, index)
    }

    // 如果被移除了，就不再往内部迭代，且exit也不会再执行
    // 在forEach内部，此时 parent[index] == undefined
    if (parent[index] !== node) {
      return
    }

    // 如果被修改了，其内部元素也可能被修改，因此，要动态重新获取children
    // 由于内部可能删除child，所以不能把children赋值给另外一个变量，必须保证数组引用一致性
    node.forEach((child, i) => {
      // 从真正的children开始处理
      if (i < 2) {
        return
      }
      // 由于forEach的特殊机制，即使在内部执行了splice，i也是正确位置
      traverseNode(child, node, i) // children是从第2个索引开始
    })

    if (methods && methods.exit) {
      methods.exit(node, parent, index)
    }
  }

  traverseNode(ast, null, -1)
}

export function diffAst(ast1, ast2, tiny) {
  const getIdentifiers = (items) => {
    const ids = items.map((item) => {
      if (typeof item === 'string') {
        // break line like \n\s\s
        if (item[0] === '\n' && !item.trim()) {
          return '#nl_' + (item.length - 1)
        }
        return '#text'
      }
      else {
        const [name, attrs] = item
        if (name.indexOf('#') === 0) {
          return name
        }
        else if (attrs && attrs.id) {
          return `${name}#${attrs.id}`
        }
        else if (attrs && attrs['data-id']) {
          return `${name}#${attrs['data-id']}`
        }
        else {
          return `${name}${attrs ? `[${Object.keys(attrs).join(',')}]` : ''}`
        }
      }
    })

    const res = ids.map((id, i) => {
      if (id.indexOf('#') > 0) {
        return id
      }
      const regression = ids.slice(0, i)
      const count = regression.filter(item => item === id).length
      return id + '@' + (count + 1)
    })

    return res
  }

  const makePath = (item, index, items) => {
    if (tiny) {
      return index
    }

    let nth = 1

    for (let i = 0, len = items.length; i < len; i ++) {
      if (i >= index && items[i] === item) {
        break
      }

      if (typeof item === 'string') {
        if (typeof items[i] === 'string') {
          nth ++
        }
      }
      else if (items[i][0] === item[0]) {
        nth ++
      }
    }

    const name = typeof item === 'string' ? 'text()'
      : item[0].indexOf('#') === 0 ? item[0].replace('#', '') + '()'
      : item[0]

    return `${name}[${nth}]`
  }

  const createPath = (deepth, path) => {
    return deepth.concat(path || path === 0 ? path : []).join('/')
  }

  const createMutation = (data) => {
    const { type } = data
    if (type === 'children') {
      const { removed, inserted, moved } = data
      if (!removed.length && !inserted.length && !moved.length) {
        return
      }
    }

    if (!tiny) {
      return data
    }

    if (type === 'attribute') {
      const { target, name, next } = data
      return {
        t: 'A',
        e: target,
        n: name,
        v: next,
      }
    }

    if (type === 'text') {
      const { target, next } = data
      return {
        t: 'T',
        e: target,
        v: next,
      }
    }

    if (type === 'children') {
      const { target, removed, inserted, moved } = data
      const output = {
        t: 'C',
        e: target,
      }
      if (removed.length) {
        output.r = removed.map((item) => {
          const { node } = item
          return { e: node }
        })
      }
      if (moved.length) {
        output.m = moved.map((item) => {
          const { before, node } = item
          return {
            e: node,
            b: before,
          }
        })
      }
      if (inserted.length) {
        output.i = inserted.map((item) => {
          const { before, next } = item
          return {
            x: next,
            b: before,
          }
        })
      }
      return output
    }
  }

  const diffAttrs = (attrs1, attrs2, deepth) => {
    const props1 = attrs1 || {}
    const props2 = attrs2 || {}
    const _attrs = { ...props1, ...props2 }
    const keys = Object.keys(_attrs)
    const mutations = []
    keys.forEach((key) => {
      if (props1[key] !== props2[key]) {
        const mutation = createMutation({
          type: 'attribute',
          target: createPath(deepth),
          name: key,
          next: key in props2 ? props2[key] : void 0,
          prev: key in props1 ? props1[key] : void 0,
        })
        mutations.push(mutation)
      }
    })
    return mutations
  }

  const diff = (items1, items2, deepth) => {
    const identifiers1 = getIdentifiers(items1)
    const identifiers2 = getIdentifiers(items2)

    const memoItems = [...items1]
    const memoIdentifiers = [...identifiers1]

    const removed = []
    const inserted = []
    const moved = []

    // 找出被移除的节点
    for (let i = items1.length - 1; i > -1; i --) {
      const id1 = identifiers1[i]

      const index = identifiers2.indexOf(id1)
      if (index < 0) {
        removed.push({
          node: makePath(items1[i], i, items1),
        })

        memoItems.splice(i, 1)
        memoIdentifiers.splice(i, 1)
      }
    }

    // 找出被移动的节点
    // 此时，memoIdentifiers是identifiers2子集，接下来调整memoIdentifiers的位置为identifiers2子序列，拍完序之后，插入更简单
    for (let i = items2.length - 1, len = memoIdentifiers.length, curr = len; i > -1; i --) {
      const id2 = identifiers2[i]
      const index = memoIdentifiers.indexOf(id2)
      // 新增的，不在原来的列表中
      if (index === -1) {
        continue
      }

      // 无需移动
      if (curr - 1 === index) {
        curr --
        continue
      }

      const item = memoItems[index]
      const next = curr === len ? null : memoItems[curr]
      const before = next === null ? null : makePath(next, curr, memoItems)
      const node = makePath(item, index, memoItems)

      moved.push({
        before,
        node,
      })

      memoItems.splice(curr, 0, item)
      memoIdentifiers.splice(curr, 0, id2)

      memoItems.splice(index, 1)
      memoIdentifiers.splice(index, 1)

      curr --
    }

    // 找出被添加的节点
    // 由于前面做了排序，接下来，只需要按照对应序列插入即可
    for (let i = items2.length - 1, len = memoIdentifiers.length, curr = len; i > -1; i --) {
      const id2 = identifiers2[i]
      const index = memoIdentifiers.indexOf(id2)
      // 不是新增的
      if (index > -1) {
        curr --
        continue
      }

      const before = curr === len ? null : makePath(memoItems[curr], curr, memoItems) // null表示插入到最后一个元素

      const next = items2[i]
      memoIdentifiers.splice(curr, 0, id2)
      memoItems.splice(curr, 0, next)

      const node = {
        before,
        next,
      }
      inserted.push(node)
    }

    const mutation = createMutation({
      type: 'children',
      target: createPath(deepth, []),
      removed,
      inserted,
      moved,
    })

    const mutations = []

    if (mutation) {
      mutations.push(mutation)
    }

    for (let i = 0, len = memoItems.length; i < len; i ++) {
      const item = memoItems[i]
      const node = makePath(item, i, memoItems)
      const next = items2[i]

      if (typeof item === 'string') {
        if (item !== next) {
          const mutation = createMutation({
            type: 'text',
            target: createPath(deepth, node),
            next: next,
            prev: item,
          })
          mutations.push(mutation)
        }
      }
      // 那些不是插入的新对象，才需要进入深对比
      else if (items1.indexOf(item) > -1) {
        const [_name1, attrs1, ...children1] = item
        const [_name2, attrs2, ...children2] = next

        if (attrs1 || attrs2) {
          const attrsMutations = diffAttrs(attrs1, attrs2, [...deepth, node])
          mutations.push(...attrsMutations)
        }

        const changes = diff(children1, children2, [...deepth, node])
        mutations.push(...changes)
      }
    }

    return mutations
  }

  const mutations = []
  const [name1, attrs1, ...children1] = ast1
  const [name2, attrs2, ...children2] = ast2

  const attrsMutations = diffAttrs(attrs1, attrs2, [])
  mutations.push(...attrsMutations)

  const childrenMutations = diff(children1, children2, [])
  mutations.push(...childrenMutations)

  return mutations
}

export function patchAst(ast, mutations, tiny) {
  // 如果mutations中开头5个都是只有t而没有type，说明是用的tiny模式
  if (typeof tiny === 'undefined' && mutations.slice(0, 5).every(mutation => 't' in mutation && !('type' in mutation))) {
    tiny = true
  }

  const deepClone = (obj) => {
    const copy = Array.isArray(obj) ? [] : {}
    for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
         copy[key] = obj[key] && typeof obj[key] === 'object' ? deepClone(obj[key]) : obj[key]
      }
    }
    return copy
  }

  const findNodeByTiny = (ast, target) => {
    if (typeof target === 'number') {
      const [_name, _attrs, ...children] = ast
      return [children[target], target, ast]
    }

    const path = target.split('/')

    let node = ast
    let parent = null
    let index = -1

    path.forEach((item) => {
      const i = +item
      const [_name, _attrs, ...children] = node

      parent = node
      node = children[i]
      index = i
    })

    return [node, index, parent]
  }

  const findNode = (ast, target) => {
    // 末尾位置
    if (target === null) {
      const [_name, _attrs, ...children] = ast
      return [null, children.length, ast]
    }

    // 自己本身
    if (target === '') {
      return [ast, -1, null]
    }

    if (tiny) {
      return findNodeByTiny(ast, target)
    }

    const path = target.split('/').map((item) => {
      const name = item.replace(/\[.*?\]$/, '')
      const nth = +item.replace(name, '').replace(/[\[\]]/g, '')
      return [name, nth]
    })

    let node = ast
    let parent = null
    let index = -1
    path.forEach(([name, nth]) => {
      const [_name, _attrs, ...children] = node

      let sibling = 0
      for (let i = 0, len = children.length; i < len; i ++) {
        const child = children[i]
        if (typeof child === 'string') {
          if (name === 'text()') {
            sibling ++
          }
        }
        else if (name === child[0]) {
          sibling ++
        }
        else if (name.substr(name.length - 2, 2) === '()' && child[0].indexOf('#') === 0 && name.substring(0, name.length - 2) === child[0].substr(1)) {
          sibling ++
        }

        if (sibling === nth) {
          parent = node
          node = child
          index = i
          return
        }
      }
    })

    return [node, index, parent]
  }

  const json = deepClone(ast)

  const patchBy = (mutation) => {
    const type = tiny ? mutation.t : mutation.type
    const target = tiny ? mutation.e : mutation.target
    const [node, index, parent] = findNode(json, target)

    if (tiny ? type === 'T' : type === 'text') {
      const next = tiny ? mutation.v : mutation.next
      parent[index + 2] = next
    }
    else if (tiny ? type === 'A' : type === 'attribute') {
      const name = tiny ? mutation.n : mutation.name
      const next = tiny ? mutation.v : mutation.next
      const attrs = node[1] || {}
      if (typeof next === 'undefined') {
        delete attrs[name]
      }
      else {
        attrs[name] = next
      }
      node[1] = attrs
    }
    else if (tiny ? type === 'C' : type === 'children') {
      const removed = (tiny ? mutation.r : mutation.removed) || []
      const inserted = (tiny ? mutation.i : mutation.inserted) || []
      const moved = (tiny ? mutation.m : mutation.moved) || []

      removed.forEach((item) => {
        const path = tiny ? item.e : item.node
        const [_, index, parent] = findNode(node, path)
        parent.splice(index + 2, 1)
      })

      moved.forEach((item) => {
        const path = tiny ? item.e : item.node
        const before = tiny ? item.b : item.before

        const [next, removeIndex, removeFromParent] = findNode(node, path)
        removeFromParent.splice(removeIndex + 2, 1)

        const [_, index, parent] = findNode(node, before)
        // notice, only tiny diff need to compute index position
        if (tiny && removeIndex < index) {
          parent.splice(index + 1, 0, next)
        }
        else {
          parent.splice(index + 2, 0, next)
        }
      })

      inserted.forEach((item) => {
        const before = tiny ? item.b : item.before
        const next = tiny ? item.x : item.next
        if (before === null) {
          node.push(next)
        }
        else {
          const [_, index, parent] = findNode(node, before)
          parent.splice(index + 2, 0, next)
        }
      })
    }
  }

  mutations.forEach(patchBy)
  return json
}
