import * as d3 from 'd3'

export function useTreeRendering() {
  // 绘制节点矩形
  const drawNodeRects = (selection, threshold, maxRectLength, rectWidth, className, getCoverage, uncategorizedNodes = []) => {
    // selection.selectAll(`rect.${className}`)
    //   .data(d => (d.data && d.data.name == "0") ? [] : [d])
    //   .join("rect")
    //   .attr("class", className)
    //   .attr("x", -rectWidth / 2)
    //   .attr("y", d => -getCoverage(d) * maxRectLength)
    //   .attr("width", rectWidth)
    //   .attr("height", d => getCoverage(d) * maxRectLength)
    //   .attr("opacity", d => {
    //     const topY = -getCoverage(d) * maxRectLength
    //     const isUncategorized = uncategorizedNodes.includes(d.data.name);
    //     // 未分类的节点不透明度不变化
    //     return isUncategorized ? 1.0 : (topY < threshold ? 1.0 : 0.3)
    //   })
    //   .attr("stroke-width", 0.5)
  }

  // 绘制层覆盖矩形
  const drawLayerRects = (layerGroups, layers, firstLayerMinX, standardWidth, nodeHeight) => {
    layers.forEach(([depth, nodes], layerIdx) => {
      if (depth === 0) return;
      if (depth === 1) {
        // 第一层：整层一个大rect
        const minX = nodes.reduce((min, node) => Math.min(min, node.x), Infinity)
        const maxX = nodes.reduce((max, node) => Math.max(max, node.x), -Infinity)
        d3.select(layerGroups.nodes()[layerIdx])
          .append("rect")
          .attr("x", minX + 100 - 2)
          .attr("y", nodes[0].y - 58.5 - nodeHeight / 2)
          .attr("width", (maxX - minX) + 4)
          .attr("height", nodeHeight + 89.5)
          .attr("fill", "#e0e0e0")
          .attr("opacity", 1)
          .attr("stroke", "black")
          .attr("stroke-width", 1)
          .lower();
      } else {
        // 其他层：每个父节点的子节点组一个rect
        // 1. 按父节点分组
        const groupMap = {};
        nodes.forEach(node => {
          const parentName = node.parent?.data?.name || 'unknown';
          if (!groupMap[parentName]) groupMap[parentName] = [];
          groupMap[parentName].push(node);
        });
        const groupKeys = Object.keys(groupMap);
        const groupNodes = groupKeys.map(key => groupMap[key]);
        groupNodes.forEach(group => {
          if (group.length > 0) {
            const minX = Math.min(...group.map(n => n.x));
            const maxX = Math.max(...group.map(n => n.x));
            d3.select(layerGroups.nodes()[layerIdx])
              .append("rect")
              .attr("x", minX + 100 - 2)
              .attr("y", nodes[0].y - 58.5 - nodeHeight / 2)
              .attr("width", (maxX - minX) + 4)
              .attr("height", nodeHeight + 89.5)
              .attr("fill", "#e0e0e0")
              .attr("opacity", 1)
              .attr("stroke", "black")
              .attr("stroke-width", 1)
              .lower();
          }
        });
      }
    });
  }

  // 绘制节点
  const drawNodes = (layerGroups, layers, nodeHeight) => {
    return layerGroups.selectAll("g.node")
      .data(d => d[1])
      .join("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x + 100},${d.y + 60})`)
  }

  // 绘制横线
  const drawThresholdLines = (g, layers, node, node2, firstLayerMinX, standardWidth, nodeHeight, maxRectLength, rectWidth, getCoverage, onThresholdChange, uncategorizedNodes = []) => {
    const dragLines = []
    const dragBehaviors = []
    const layerThresholds = {}

    layers.forEach(([depth]) => {
      layerThresholds[depth] = -maxRectLength / 2
    })

    layers.forEach(([depth, nodes], layerIdx) => {
      const baseY = nodes[0].y + 60
      const minX = nodes.reduce((min, node) => Math.min(min, node.x), Infinity)
      const maxX = nodes.reduce((max, node) => Math.max(max, node.x), -Infinity)

      // 绘制主横线
      const dragLine = g.append("line")
        .attr("class", "threshold-line")
        .attr("x1", minX + 100 - 0.5)
        .attr("x2", maxX + 100 - 0.5)
        .attr("y1", baseY + layerThresholds[depth])
        .attr("y2", baseY + layerThresholds[depth])
        .attr("stroke", "#ff9800")
        .attr("stroke-width", 2)
        .attr("cursor", "ns-resize")

      // 拖动行为
      const dragBehavior = d3.drag()
        .on("start", function(event) {
          d3.select(this).attr("stroke-width", 4)
        })
        .on("drag", function(event) {
          let newY = event.y
          const minY = baseY - maxRectLength - 50
          const maxY = baseY - 1
          if (newY < minY) newY = minY
          if (newY > maxY) newY = maxY
          layerThresholds[depth] = newY - baseY

          d3.select(this)
            .attr("y1", newY)
            .attr("y2", newY)

          const thisLayerNodes = node.filter(d => d.depth === depth)
          drawNodeRects(thisLayerNodes, layerThresholds[depth], maxRectLength, rectWidth, "node-rect", getCoverage, uncategorizedNodes)

          // 实时更新被拖动层及以下层的节点可见性
          if (typeof updateNodeVisibilityForLayers === 'function') {
            updateNodeVisibilityForLayers(node, layers, maxRectLength, getCoverage, layerThresholds, depth)
          }

          // 触发阈值变化回调，通知其他组件更新
          if (onThresholdChange) {
            onThresholdChange(depth, layerThresholds[depth], { baseY, nodeHeight }, layerThresholds)
          }
        })
        .on("end", function() {
          d3.select(this).attr("stroke-width", 2)
        })

      dragLine.call(dragBehavior)
      dragLines.push(dragLine)
      dragBehaviors.push(dragBehavior)

      // 初次绘制本层竖线颜色
      const thisLayerNodes = node.filter(d => d.depth === depth)
      drawNodeRects(thisLayerNodes, layerThresholds[depth], maxRectLength, rectWidth, "node-rect", getCoverage, uncategorizedNodes)
    })

    return { dragLines, dragBehaviors, layerThresholds }
  }

  // 创建根节点到第一层的连线
  const createRootToFirstLayerConnections = (categoryLinksGroup, layers) => {
    const rootNode = layers[0] ? layers[0][1][0] : null
    if (!rootNode) return
    const firstLayerNodes = layers[1] ? layers[1][1] : []
    if (firstLayerNodes.length === 0) return
    const sortedNodes = firstLayerNodes.sort((a, b) => a.x - b.x)
    const leftmostNode = sortedNodes[0]
    const rightmostNode = sortedNodes[sortedNodes.length - 1]
    // 创建最左边的连线
    categoryLinksGroup.append("path")
      .attr("class", "root-connection")
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 2)
      .attr("opacity", 0.8)
      .attr("d", () => {
        const startX = rootNode.x + 100
        const startY = rootNode.y + 60
        const endX = leftmostNode.x + 100
        const endY = leftmostNode.y + 60
        const midY = (startY + endY) / 2
        return `M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}`
      })
    // 创建最右边的连线
    categoryLinksGroup.append("path")
      .attr("class", "root-connection")
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr("stroke-width", 2)
      .attr("opacity", 0.8)
      .attr("d", () => {
        const startX = rootNode.x + 100
        const startY = rootNode.y + 60
        const endX = rightmostNode.x + 100
        const endY = rightmostNode.y + 60
        const midY = (startY + endY) / 2
        return `M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}`
      })
  }

  // 判断节点是否超过阈值
  const isNodeAboveThreshold = (node, layerThresholds, maxRectLength, getCoverage, activeLayer = null) => {
    if (node.depth === 0) return true
    
    // 如果指定了活跃层，只检查该层的阈值
    if (activeLayer !== null) {
      const topY = -getCoverage(node) * maxRectLength
      const threshold = layerThresholds[activeLayer] || -maxRectLength / 2
      return topY < threshold
    }
    
    // 检查当前节点是否超过阈值
    const topY = -getCoverage(node) * maxRectLength
    const threshold = layerThresholds[node.depth] || -maxRectLength / 2
    const currentNodeAboveThreshold = topY < threshold
    
    // 如果当前节点没有超过阈值，直接返回 false
    if (!currentNodeAboveThreshold) {
      return false
    }
    
    // 检查所有父节点是否都超过阈值
    let current = node
    while (current.parent && current.parent.depth > 0) {
      const parentTopY = -getCoverage(current.parent) * maxRectLength
      const parentThreshold = layerThresholds[current.parent.depth] || -maxRectLength / 2
      if (parentTopY >= parentThreshold) {
        return false // 如果任何父节点没有超过阈值，则当前节点也不显示
      }
      current = current.parent
    }
    
    return true
  }

  // 检查节点是否超过上面所有层的阈值
  const isNodeAboveAllUpperThresholds = (node, layerThresholds, maxRectLength, getCoverage, currentDepth) => {
    if (node.depth === 0) return true;
    // 检查所有上层（含本层）的阈值
    for (let d = 1; d <= currentDepth; d++) {
      const topY = -getCoverage(node) * maxRectLength;
      const threshold = layerThresholds[d] || -maxRectLength / 2;
      if (topY >= threshold) return false;
    }
    return true;
  }

  // 检查节点及其所有祖先节点是否都超过阈值
  const isNodeAndAncestorsAboveThresholds = (node, layerThresholds, maxRectLength, getCoverage, currentDepth) => {
    if (node.depth === 0) return true;
    
    // 检查当前节点是否超过所有上层阈值
    if (!isNodeAboveAllUpperThresholds(node, layerThresholds, maxRectLength, getCoverage, currentDepth)) {
      return false;
    }
    
    // 检查所有祖先节点是否都超过阈值
    let current = node;
    while (current.parent && current.parent.depth > 0) {
      current = current.parent;
      // 检查祖先节点是否超过其所在层的阈值
      const ancestorDepth = current.depth;
      const topY = -getCoverage(current) * maxRectLength;
      const threshold = layerThresholds[ancestorDepth] || -maxRectLength / 2;
      if (topY >= threshold) {
        return false;
      }
    }
    
    return true;
  }

  // 获取节点的所有后代节点
  const getNodeDescendants = (node, layers) => {
    const descendants = []
    const nodeName = node.data.name
    
    // 从下一层开始查找所有后代
    for (let depth = node.depth + 1; depth < layers.length; depth++) {
      const layerNodes = layers[depth][1]
      layerNodes.forEach(descendant => {
        // 检查是否是当前节点的后代
        let current = descendant
        while (current.parent && current.parent.data.name !== nodeName) {
          current = current.parent
        }
        if (current.parent && current.parent.data.name === nodeName) {
          descendants.push(descendant)
        }
      })
    }
    
    return descendants
  }

  // 更新节点可见性
  const updateNodeVisibility = (node, layers, maxRectLength, getCoverage, layerThresholds) => {
    if (!layerThresholds) {
      layerThresholds = {}
      layers.forEach(([depth]) => {
        layerThresholds[depth] = -maxRectLength / 2
      })
    }

    node.each(function(d) {
      if (d.depth === 0) {
        d3.select(this).style("opacity", 1)
      } else {
        const isAboveThreshold = isNodeAboveThreshold(d, layerThresholds, maxRectLength, getCoverage)
        d3.select(this).style("opacity", isAboveThreshold ? 1 : 0.3)
      }
    })
  }

  // 更新指定层及以下层的节点可见性
  const updateNodeVisibilityForLayers = (node, layers, maxRectLength, getCoverage, layerThresholds, draggedDepth) => {
    if (!layerThresholds) {
      layerThresholds = {}
      layers.forEach(([depth]) => {
        layerThresholds[depth] = -maxRectLength / 2
      })
    }

    node.each(function(d) {
      if (d.depth === 0) {
        d3.select(this).style("opacity", 1)
      } else if (d.depth >= draggedDepth) {
        // 只更新被拖动层及以下层的节点
        const isAboveThreshold = isNodeAboveThreshold(d, layerThresholds, maxRectLength, getCoverage)
        d3.select(this).style("opacity", isAboveThreshold ? 1 : 0.3)
      }
      // 上面层的节点保持原样，不更新
    })
  }

  // 更新所有下层连线的可见性
  const updateAllLowerLayerConnections = (draggedDepth, layerThresholds, maxRectLength, getCoverage) => {
    // 获取所有连线组
    const allLinkGroups = d3.selectAll("g[class*='category-links-group-layer']");
    
    allLinkGroups.each(function() {
      const group = d3.select(this);
      const className = group.attr("class");
      
      // 提取层深度
      const layerMatch = className.match(/layer(\d+)/);
      if (!layerMatch) return;
      
      const layerDepth = parseInt(layerMatch[1]);
      
      // 只更新被拖动层及以下所有层的连线，不更新上面层的连线
      if (layerDepth >= draggedDepth) {
        // 更新节点到分类的连线
        const nodeToCatLinks = group.selectAll("path[class*='node-to-cat-layer']");
        nodeToCatLinks.each(function() {
          const link = d3.select(this);
          const linkData = link.datum();
          if (linkData && linkData.node) {
            const isAboveThreshold = isNodeAndAncestorsAboveThresholds(
              linkData.node, 
              layerThresholds, 
              maxRectLength, 
              getCoverage, 
              layerDepth
            );
            link.style("opacity", isAboveThreshold ? 1 : 0);
          }
        });
        
        // 更新分类到第二套内容节点的连线
        const catToNode2Links = group.selectAll("path[class*='cat-to-node2-layer']");
        catToNode2Links.each(function() {
          const link = d3.select(this);
          const linkData = link.datum();
          if (linkData && linkData.node) {
            const isAboveThreshold = isNodeAndAncestorsAboveThresholds(
              linkData.node, 
              layerThresholds, 
              maxRectLength, 
              getCoverage, 
              layerDepth
            );
            link.style("opacity", isAboveThreshold ? 1 : 0);
          }
        });
      }
    });
  }
  
  return {
    drawNodeRects,
    drawLayerRects,
    drawNodes,
    drawThresholdLines,
    createRootToFirstLayerConnections,
    updateNodeVisibility,
    updateNodeVisibilityForLayers,
    updateAllLowerLayerConnections,
    isNodeAboveThreshold,
    isNodeAboveAllUpperThresholds,
    isNodeAndAncestorsAboveThresholds,
    getNodeDescendants
  }
}