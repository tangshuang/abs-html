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
    else if (!inTagBegin && char === '<') {
      if (html[i + 1] === '-' && html[i + 2] === '-') {
        const comment = ['#comment', null]
        let content = ''

        i += 3
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
    else if (inTagBegin && char === ' ') {
      let attr = ''

      i ++
      char = html[i]

      while (char !== '=' && char !== ' ' && char !== '>') {
        if (char === '/' && html[i + 1] === '>') {
          break
        }

        attr += char

        i ++
        char = html[i]
      }

      const node = inTagBegin

      if (char === '/' && html[i + 1] === '>') {
        const parent = nest.length ? nest[nest.length - 1] : nest
        parent.push(node)
        inTagBegin = null
        i ++
        continue
      }

      if (char === '=') {
        let value = ''

        i ++
        char = html[i]

        while (char !== ' ' && char !== '>') {
          if (char === '/' && html[i + 1] === '>') {
            break
          }

          value += char

          i ++
          char = html[i]
        }

        if (char === '/' && html[i + 1] === '>') {
          const parent = nest.length ? nest[nest.length - 1] : nest
          parent.push(node)
          inTagBegin = null
          i ++
          continue
        }

        if (value[0] === '"' && value[value.length - 1] === '"') {
          value = value.substring(1, value.length - 1)
        }
        else if (value[0] === "'" && value[value.length - 1] === "'") {
          value = value.substring(1, value.length - 1)
        }

        node[1] = node[1] || {}
        node[1][attr] = value
      }
      else if (char === ' ' || char === '>') {
        node[1] = node[1] || {}
        node[1][attr] = null
      }

      i --
    }
    else if (inTagBegin && char === '>') {
      const node = inTagBegin
      const parent = nest.length ? nest[nest.length - 1] : nest
      parent.push(node)
      nest.push(node)
      node[1] = node[1] || null // 强制props
      inTagBegin = null
      inTag = node
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

  if (name.indexOf('!') === 0) {
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
        else {
          return `${name}${attrs ? `[${Object.keys(attrs).join(',')}]` : ''}`
        }
      }
    })
    const res = ids.map((id, i) => {
      const regression = ids.slice(0, i)
      const count = regression.filter(item => item === id).length
      return id + '@' + (count + 1)
    })
    return res
  }

  const makePath = (item, items) => {
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
    return deepth.concat(path).join('/')
  }

  const diffAttrs = (attrs1, attrs2, deepth) => {
    const _attrs = { ...(attrs1 || {}), ...(attrs2 || {}) }
    const keys = Object.keys(_attrs)
    const mutations = []
    keys.forEach((key) => {
      if (attrs1[key] !== attrs2[key]) {
        mutations.push({
          type: 'attribute',
          target: createXPath(deepth),
          name: key,
          next: key in attrs2 ? attrs2[key] : null,
          prev: key in attrs1 ? attrs1[key] : null,
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

    // 找出被添加的节点
    for (let i = 0, len = items2.length - 1; i < len; i ++) {
      const id2 = identifiers2[i]

      const index = memoIdentifiers.indexOf(id2)
      if (index < 0) {
        let sibling = null
        // 从下一个节点开始找起
        for (let curr = i + 1, len = identifiers2.length; curr < len; curr ++) {
          const cid2 = identifiers2[curr]
          const sibc = memoIdentifiers.indexOf(cid2)
          if (sibc > -1) {
            sibling = sibc
            break
          }
        }

        const before = sibling === null ? null : makePath(memoItems[sibling], memoItems) // null表示插入到最后一个元素
        const item = items2[i]
        const node = {
          before,
          next: item,
        }

        inserted.push(node)
        if (sibling === null) {
          memoItems.push(item)
          memoIdentifiers.push(id2)
        }
        else {
          memoItems.splice(sibling, 0, item)
          memoIdentifiers.splice(sibling, 0, id2)
        }
      }
    }

    // 找出被移动的节点
    // 此时，identifiers2和memoIdentifiers内容相同，只是顺序不同，需要调整位置
    for (let i = items2.length - 1; i > -1; i --) {
      const id2 = identifiers2[i]
      const index = memoIdentifiers.indexOf(id2)
      if (index > -1 && index !== i) {
        const item = memoItems[index]
        const node = makePath(item, memoItems)

        const next = i + 1
        const nextId = identifiers2[next]
        const nextIndex = memoIdentifiers.indexOf(nextId)

        let before = null
        if (next >= items2.length) {
          memoItems.splice(index, 1)
          memoIdentifiers.splice(index, 1)
          memoItems.push(item)
          memoIdentifiers.push(id2)
        }
        else if (nextIndex > -1) {
          const nextItem = memoItems[nextIndex]
          before = makePath(nextItem, memoItems)

          // 交换位置
          ;[memoItems[index], memoItems[nextIndex]] = [memoItems[nextIndex], memoItems[index]]
          ;[memoIdentifiers[index], memoIdentifiers[nextIndex]] = [memoIdentifiers[nextIndex], memoIdentifiers[index]]
        }
        // 这种情况不可能存在，存在了就是有问题
        else {
          memoItems.splice(index, 1)
          memoIdentifiers.splice(index, 1)
          continue
        }

        moved.push({
          before,
          node,
        })
      }
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

      if (typeof item === 'string') {
        if (item !== items2[i]) {
          mutations.push({
            type: 'text',
            target: createXPath(deepth, node),
            next: items2[i],
            prev: item,
          })
        }
      }
      else if (items1.includes(item)) {
        const [_name1, attrs1, ...children1] = item
        const [_name2, attrs2, ...children2] = items2[i]

        const attrsMutations = diffAttrs(attrs1, attrs2, [...deepth, node])
        mutations.push(...attrsMutations)

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
      attrs[name] = next
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
