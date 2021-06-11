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
 * 将html字符串解析为hyperJSON
 * @param {string} html
 * @param {object} options
 * @param {boolean} options.loose 是否宽松，开启后，将保留标签换行（和原始html换行一致）
 * @returns hyperJSON
 */
export function parseHTMLToHyperJSON(html, options = {}) {
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

      const node = [tag]
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
        if (!name) {
          return
        }

        name = name.trim()
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
      const node = inTagBegin
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

  /**
   * 检查内容是否包含字符串，如果不不包含字符串，说明这里的换行没有意义，是代码层面的，需要清除，只留下子标签
   */
  if (!options.loose) {
    nodes.forEach((node) => {
    const [tag, attrs, ...children] = node
    const strs = children.filter(item => typeof item === 'string' && item.trim())
      if (children.length > 1 && !strs.length) {
        const contents = children.filter(item => typeof item !== 'string')
        node.length = 2
        node.push(...contents)
      }
    })
  }

  return nest[0]
}

export function rebuildHyperJSONToHTML(hyperjson) {
  const [name, attrs, ...children] = hyperjson

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
        str += rebuildHyperJSONToHTML(child)
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

export function diffHyperJSON(hyperjson1, hyperjson2) {
  const getIdentifiers = (items) => {
    const ids = items.map((item) => {
      if (typeof item === 'string') {
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

  const makePath = (item, items) => {
    // if (typeof item !== 'string' && !Array.isArray(item)) {
    //   throw new Error(`makePath第一个参数必须是字符串或数组，结果接收到 ${JSON.stringify(item)},${JSON.stringify(items)}`)
    // }

    let nth = 1

    for (let i = 0, len = items.length; i < len; i ++) {
      if (items[i] === item) {
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

  const createXPath = (deepth, path) => {
    return deepth.concat(path || []).join('/')
  }

  // 根据item在items中的位置，找到item应该移动到items0中的哪个位置
  const findIndexMoveTo = (item, items, items0) => {
    let index = -1
    for (let i = 0, len = items.length; i < len; i ++) {
      const next = items[i]
      if (items0.includes(next)) {
        index ++
        if (item === next) {
          return index
        }
      }
    }
    return index
  }

  const diffAttrs = (attrs1, attrs2, deepth) => {
    const props1 = attrs1 || {}
    const props2 = attrs2 || {}
    const _attrs = { ...props1, ...props2 }
    const keys = Object.keys(_attrs)
    const mutations = []
    keys.forEach((key) => {
      if (props1[key] !== props2[key]) {
        mutations.push({
          type: 'attribute',
          target: createXPath(deepth),
          name: key,
          next: key in props2 ? props2[key] : void 0,
          prev: key in props1 ? props1[key] : void 0,
        })
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
    for (let i = 0; i < items1.length; i ++) {
      const id1 = identifiers1[i]

      const index = identifiers2.indexOf(id1)
      if (index < 0) {
        removed.push({
          node: makePath(items1[i], items1),
        })

        const index = memoIdentifiers.indexOf(id1)
        memoItems.splice(index, 1)
        memoIdentifiers.splice(index, 1)
      }
    }

    // 找出被移动的节点
    // 此时，memoIdentifiers是identifiers2子集，接下来调整memoIdentifiers的位置为identifiers2子序列，拍完序之后，插入更简单
    for (let i = items2.length - 1; i > -1; i --) {
      const id2 = identifiers2[i]
      const index = memoIdentifiers.indexOf(id2)
      // 新增的，不在原来的列表中
      if (index === -1) {
        continue
      }

      const indexMoveTo = findIndexMoveTo(id2, identifiers2, memoIdentifiers)
      if (indexMoveTo > -1 && index !== indexMoveTo) {
        const item = memoItems[index]
        const node = makePath(item, memoItems)
        const nextItem = memoItems[indexMoveTo]
        const before = makePath(nextItem, memoItems)

        memoIdentifiers.splice(index, 1)
        memoIdentifiers.splice(indexMoveTo - (indexMoveTo > index ? 1 : 0), 0, id2)
        memoItems.splice(index, 1)
        memoItems.splice(indexMoveTo - (indexMoveTo > index ? 1 : 0), 0, item)

        moved.push({
          before,
          node,
        })
      }
    }

    // 找出被添加的节点
    // 由于前面做了排序，接下来，只需要按照对应序列插入即可
    let curr = memoItems.length
    let last = curr
    for (let i = items2.length - 1; i > -1; i --) {
      const id2 = identifiers2[i]
      const index = memoIdentifiers.indexOf(id2)
      // 不是新增的
      if (index > -1) {
        curr --
        continue
      }

      const before = curr === last ? null : makePath(memoItems[curr], memoItems) // null表示插入到最后一个元素

      const next = items2[i]
      memoIdentifiers.splice(curr, 0, id2)
      memoItems.splice(curr, 0, next)

      const node = {
        before,
        next,
      }
      inserted.push(node)
    }

    const mutation = {
      type: 'children',
      target: createXPath(deepth, []),
      removed,
      inserted,
      moved,
    }

    const mutations = []

    if (mutation.removed.length + mutation.inserted.length + mutation.moved.length) {
      mutations.push(mutation)
    }

    for (let i = 0, len = memoItems.length; i < len; i ++) {
      const item = memoItems[i]
      const node = makePath(item, memoItems)
      const next = items2[i]

      if (typeof item === 'string') {
        if (item !== next) {
          mutations.push({
            type: 'text',
            target: createXPath(deepth, node),
            next: next,
            prev: item,
          })
        }
      }
      // 那些不是插入的新对象，才需要进入深对比
      else if (items1.includes(item)) {
        const [_name1, attrs1, ...children1] = item
        const [_name2, attrs2, ...children2] = next

        if (attrs1 || attrs2) {
          const attrsMutations = diffAttrs(attrs1, attrs2, [...deepth, node])
          mutations.push(...attrsMutations)
        }

        console.log(children1, children2)
        const changes = diff(children1, children2, [...deepth, node])
        mutations.push(...changes)
      }
    }

    return mutations
  }



  const mutations = []
  const [name1, attrs1, ...children1] = hyperjson1
  const [name2, attrs2, ...children2] = hyperjson2

  const attrsMutations = diffAttrs(attrs1, attrs2, [])
  mutations.push(...attrsMutations)

  const childrenMutations = diff(children1, children2, [])
  mutations.push(...childrenMutations)

  return mutations
}

export function patchHyperJSON(hyperjson, mutations) {
  const deepClone = (obj) => {
    const copy = Array.isArray(obj) ? [] : {}
    for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
         copy[key] = obj[key] && typeof obj[key] === 'object' ? deepClone(obj[key]) : obj[key]
      }
    }
    return copy
  }
  const findNode = (hyperjson, target) => {
    if (target === null) {
      const [_name, _attrs, ...children] = hyperjson
      return [null, children.length, hyperjson]
    }

    const path = target.split('/').map((item) => {
      const name = item.replace(/\[.*?\]$/, '')
      const nth = +item.replace(name, '').replace(/[\[\]]/g, '')
      return [name, nth]
    })

    let node = hyperjson
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

  const json = deepClone(hyperjson)
  mutations.forEach((mutation) => {
    const { type, target } = mutation
    const [node, index, parent] = findNode(json, target)

    if (type === 'text') {
      const { next } = mutation
      parent[index + 2] = next
    }
    else if (type === 'attribute') {
      const { name, next } = mutation
      const attrs = node[1] || {}
      if (typeof next === 'undefined') {
        delete attrs[name]
      }
      else {
        attrs[name] = next
      }
      node[1] = attrs
    }
    else if (type === 'children') {
      const { removed, inserted, moved } = mutation
      removed.forEach((item) => {
        const { node: path } = item
        const [_, index, parent] = findNode(node, path)
        parent.splice(index + 2, 1)
      })
      inserted.forEach((item) => {
        const { before, next } = item
        const [_, index, parent] = findNode(node, before)
        parent.splice(index + 2, 0, next)
      })
      moved.forEach((item) => {
        const { node: path, before } = item

        const [next, removeIndex, removeFromParent] = findNode(node, path)
        removeFromParent.splice(removeIndex + 2, 1)

        const [_, index, parent] = findNode(node, before)
        parent.splice(index + 2, 0, next)
      })
    }
  })
  return json
}
