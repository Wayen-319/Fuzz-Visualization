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
    const groupMap = {}
    nodes.forEach(node => {
      const parentName = node.parent?.data?.name || 'unknown'
      if (!groupMap[parentName]) groupMap[parentName] = []
      groupMap[parentName].push(node)
    })
    const groupKeys = Object.keys(groupMap)
    const groupNodes = groupKeys.map(key => groupMap[key])

    const groupWidths = groupNodes.map(group => (group.length > 0 ? (group.length - 1) * config.nodeSpacing : 0))
    let totalGroupsWidth = groupWidths.reduce((a, b) => a + b, 0)
    let totalGapWidth = config.groupGap * (groupNodes.length - 1)
    let totalWidth = totalGroupsWidth + totalGapWidth
    
    let prevLayerWidth = standardWidth
    let x = firstLayerMinX
    if (totalWidth > prevLayerWidth) {
      x = firstLayerMinX
    } else {
      x = firstLayerMinX + (prevLayerWidth - totalWidth) / 2
    }

    groupNodes.forEach((group, i) => {
      group.forEach((node, j) => {
        node.x = x + j * config.nodeSpacing
      })
      
      if (group.length > 0) {
        const minX = Math.min(...group.map(n => n.x))
        const maxX = Math.max(...group.map(n => n.x))
        d3.select(layerGroups.nodes()[depth])
          .append("rect")
          .attr("class", `cat-rect cat-rect-layer${depth}`)
          .attr("x", minX + 100 - 0.5)
          .attr("y", group[0].y + 60 + (config.nodeHeight + 400) / 2 - 15)
          .attr("width", (maxX - minX) + 1)
          .attr("height", 30)
          .attr("fill", d3.schemeCategory10[i % d3.schemeCategory10.length])
          .attr("opacity", 0.7)
          .lower()
      }
      x += groupWidths[i] + config.groupGap
    })
  }

  return {
    getCoverage,
    createHierarchy,
    layoutNodes,
    layoutGroupedNodes
  }
} 