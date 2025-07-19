import * as d3 from 'd3'

export function useTreeLayout() {
  // 覆盖率计算函数
  const getCoverage = (d) => {
    if (!d.data || !d.data.name) return 0
    let hash = 0
    for (let i = 0; i < d.data.name.length; i++) {
      hash = ((hash << 5) - hash) + d.data.name.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash % 100) / 70
  }

  // 创建层次结构
  const createHierarchy = (data, width) => {
    const nodeMap = new Map()
    const root = {
      data: data,
      depth: 0,
      x: (width - 200) / 2,
      y: 0,
      children: [],
      descendants: function() {
        const result = [this]
        this.children.forEach(child => {
          result.push(...child.descendants())
        })
        return result
      }
    }
    
    nodeMap.set(data.name, root)
    
    const processNode = (nodeData, parentNode, depth) => {
      if (nodeData.children) {
        nodeData.children.forEach((childData, index) => {
          const childNode = {
            data: childData,
            depth: depth,
            parent: parentNode,
            children: [],
            descendants: function() {
              const result = [this]
              this.children.forEach(child => {
                result.push(...child.descendants())
              })
              return result
            }
          }
          
          parentNode.children.push(childNode)
          nodeMap.set(childData.name, childNode)
          processNode(childData, childNode, depth + 1)
        })
      }
    }
    
    processNode(data, root, 1)
    
    // 计算所有节点的位置
    const allNodes = root.descendants()
    allNodes.forEach((node, i) => {
      if (node.data.name === "0") {
        node.x = (width - 200) / 2
        node.y = 0
      } else {
        node.x = i * 2 - 200
        node.y = node.depth * 800
      }
    })
    
    return root
  }

  // 布局节点
  const layoutNodes = (layers, firstLayerMinX, standardWidth, layerGroups, config) => {
    layers.forEach(([depth, nodes]) => {
      const nodeCount = nodes.length
      if (depth === 0) return
      else if (depth === 1) {
        const spacing = standardWidth / (nodeCount - 1)
        nodes.forEach((node, index) => {
          node.x = firstLayerMinX + (index * spacing)
        })
      }
      else if (depth >= 2) {
        layoutGroupedNodes(nodes, firstLayerMinX, standardWidth, layerGroups, depth, config)
      }
      else {
        if (nodeCount === 1) {
          nodes[0].x = firstLayerMinX + standardWidth / 2
        }
      }
    })
  }

  const layoutGroupedNodes = (nodes, firstLayerMinX, standardWidth, layerGroups, depth, config) => {
    // 1. 按父节点分组
    const groupMap = {}
    nodes.forEach(node => {
      const parentName = node.parent?.data?.name || 'unknown'
      if (!groupMap[parentName]) groupMap[parentName] = []
      groupMap[parentName].push(node)
    })
    const groupKeys = Object.keys(groupMap)
    const groupNodes = groupKeys.map(key => groupMap[key])

    // 2. 计算每组宽度
    const groupWidths = groupNodes.map(group => (group.length > 0 ? (group.length - 1) * config.nodeSpacing : 0))
    const groupCenters = groupNodes.map(group => group[0].parent?.x ?? 0) // 父节点x

    // 3. 先让每组中心对齐父节点x
    let groupStartXs = groupNodes.map((group, i) => groupCenters[i] - groupWidths[i] / 2)

    // 4. 检查重叠并调整：从左到右依次排，保证每组之间有最小间隔
    const minGap = config.groupGap
    for (let i = 1; i < groupStartXs.length; i++) {
      const prevEnd = groupStartXs[i-1] + groupWidths[i-1]
      if (groupStartXs[i] < prevEnd + minGap) {
        groupStartXs[i] = prevEnd + minGap
      }
    }

    // 5. 如果整体超出standardWidth，则整体居中
    let minStart = Math.min(...groupStartXs)
    let maxEnd = Math.max(...groupStartXs.map((startX, i) => startX + groupWidths[i]))
    let totalWidth = maxEnd - minStart
    let offset = 0
    if (totalWidth < standardWidth) {
      offset = firstLayerMinX + (standardWidth - totalWidth) / 2 - minStart
    } else {
      offset = firstLayerMinX - minStart
    }
    groupStartXs = groupStartXs.map(x => x + offset)

    // 6. 依次布局每组节点
    groupNodes.forEach((group, i) => {
      const startX = groupStartXs[i]
      group.forEach((node, j) => {
        node.x = startX + j * config.nodeSpacing
      })
    })
  }

  return {
    getCoverage,
    createHierarchy,
    layoutNodes,
    layoutGroupedNodes
  }
} 