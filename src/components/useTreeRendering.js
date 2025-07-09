import * as d3 from 'd3'

export function useTreeRendering() {
  // 绘制节点矩形
  const drawNodeRects = (selection, threshold, maxRectLength, rectWidth, className, getCoverage, uncategorizedNodes = []) => {
    selection.selectAll(`rect.${className}`)
      .data(d => (d.data && d.data.name == "0") ? [] : [d])
      .join("rect")
      .attr("class", className)
      .attr("x", -rectWidth / 2)
      .attr("y", d => -getCoverage(d) * maxRectLength)
      .attr("width", rectWidth)
      .attr("height", d => getCoverage(d) * maxRectLength)
      .attr("fill", d => {
        // 检查节点是否在未分类列表中
        const isUncategorized = uncategorizedNodes.includes(d.data.name);
        return isUncategorized ? "#ff0000" : "#1976d2";
      })
      .attr("opacity", d => {
        const topY = -getCoverage(d) * maxRectLength
        const isUncategorized = uncategorizedNodes.includes(d.data.name);
        // 未分类的节点不透明度不变化
        return isUncategorized ? 1.0 : (topY < threshold ? 1.0 : 0.3)
      })
      .attr("stroke", d => {
        const isUncategorized = uncategorizedNodes.includes(d.data.name);
        return isUncategorized ? "#cc0000" : "#1565c0";
      })
      .attr("stroke-width", 0.5)
  }

  // 绘制层覆盖矩形
  const drawLayerRects = (layerGroups, layers, firstLayerMinX, standardWidth, nodeHeight) => {
    layerGroups.append("rect")
      .attr("x", (d, i, nodes) => {
        // 计算当前层所有节点的最小x坐标
        const minX = d[1].reduce((min, node) => Math.min(min, node.x), Infinity)
        return minX + 100 - 0.5
      })
      .attr("y", (d, i, nodes) => d[1][0].y + 60 - nodeHeight / 2 + 30)
      .attr("width", (d, i, nodes) => {
        // 计算当前层所有节点的最小和最大x坐标
        const minX = d[1].reduce((min, node) => Math.min(min, node.x), Infinity)
        const maxX = d[1].reduce((max, node) => Math.max(max, node.x), -Infinity)
        return (maxX - minX) + 1
      })
      .attr("height", nodeHeight + 20)
      .attr("fill", "#e0e0e0")
      .attr("opacity", 1)
      .lower()
  }

  // 绘制节点
  const drawNodes = (layerGroups, layers, nodeHeight) => {
    return layerGroups.selectAll("g.node")
      .data(d => d[1])
      .join("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x + 100},${d.y + 60})`)
  }

  // 绘制第二套内容
  const drawSecondSet = (g, layers, nodeHeight) => {
    const layerGroups2 = g.append("g")
      .selectAll("g.layer2")
      .data(layers)
      .join("g")
      .attr("class", "layer2")

    const node2 = layerGroups2.selectAll("g.node2")
      .data(d => d[1]) // 包含所有节点，包括根节点
      .join("g")
      .attr("class", "node2")
      .attr("transform", d => `translate(${d.x + 100},${d.y + 60 + nodeHeight + 400})`)
    
    return node2;
  }

  // 绘制横线
  const drawThresholdLines = (g, layers, node, node2, firstLayerMinX, standardWidth, nodeHeight, maxRectLength, rectWidth, getCoverage, onThresholdChange, uncategorizedNodes = []) => {
    const dragLines = []
    const dragLines2 = []
    const dragBehaviors = []
    const layerThresholds = {}

    layers.forEach(([depth]) => {
      layerThresholds[depth] = -maxRectLength / 2
    })

    layers.forEach(([depth, nodes], layerIdx) => {
      const baseY = nodes[0].y + 60
      const baseY2 = baseY + nodeHeight + 400
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

      // 绘制第二套横线
      const dragLine2 = g.append("line")
        .attr("class", "threshold-line2")
        .attr("x1", minX + 100 - 0.5)
        .attr("x2", maxX + 100 - 0.5)
        .attr("y1", baseY2 + layerThresholds[depth])
        .attr("y2", baseY2 + layerThresholds[depth])
        .attr("stroke", "#2196f3")
        .attr("stroke-width", 2)
        .attr("cursor", "ns-resize")

      // 拖动行为
      const dragBehavior = d3.drag()
        .on("start", function(event) {
          d3.select(this).attr("stroke-width", 4)
          dragLine2.attr("stroke-width", 4)
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

          const newY2 = baseY2 + layerThresholds[depth]
          dragLine2
            .attr("y1", newY2)
            .attr("y2", newY2)

          const thisLayerNodes = node.filter(d => d.depth === depth)
          drawNodeRects(thisLayerNodes, layerThresholds[depth], maxRectLength, rectWidth, "node-rect", getCoverage, uncategorizedNodes)

          const thisLayerNodes2 = node2.filter(d => d.depth === depth)
          drawNodeRects(thisLayerNodes2, layerThresholds[depth], maxRectLength, rectWidth, "node-rect2", getCoverage, uncategorizedNodes)

          // 实时更新被拖动层及以下层的节点可见性
          updateNodeVisibilityForLayers(node, layers, maxRectLength, getCoverage, layerThresholds, depth)

          // 触发阈值变化回调，通知其他组件更新
          if (onThresholdChange) {
            onThresholdChange(depth, layerThresholds[depth], { baseY, baseY2, nodeHeight }, layerThresholds)
          }
        })
        .on("end", function() {
          d3.select(this).attr("stroke-width", 2)
          dragLine2.attr("stroke-width", 2)
        })

      dragLine.call(dragBehavior)
      dragLine2.call(dragBehavior)

      // 初次绘制本层竖线颜色
                const thisLayerNodes = node.filter(d => d.depth === depth)
          drawNodeRects(thisLayerNodes, layerThresholds[depth], maxRectLength, rectWidth, "node-rect", getCoverage, uncategorizedNodes)

          const thisLayerNodes2 = node2.filter(d => d.depth === depth)
          drawNodeRects(thisLayerNodes2, layerThresholds[depth], maxRectLength, rectWidth, "node-rect2", getCoverage, uncategorizedNodes)

      dragLines.push(dragLine)
      dragLines2.push(dragLine2)
      dragBehaviors.push(dragBehavior)
    })

    return { dragLines, dragLines2, dragBehaviors, layerThresholds }
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

  // 画节点到分类矩形的连线
  function drawNodeToCategoryLinks(categoryLinksGroup, nodes, categories, categoryRects, nodeY, catRectY, layerDepth = '', layerThresholds = null, maxRectLength = null, getCoverage = null, activeLayer = null) {
    const className = layerDepth ? `node-to-cat-layer${layerDepth}` : 'node-to-cat';
    
    // 清除之前的连线
    categoryLinksGroup.selectAll(`path.${className}`).remove();
    
    // 为每个节点创建连线
    const links = [];
    nodes.forEach(node => {
      const nodeNameStr = String(node.data.name);
      let matchedCategory = null;
      
      // 查找匹配的分类
      for (const rect of categoryRects) {
        if (categories[rect.cat] && categories[rect.cat].includes(nodeNameStr)) {
          matchedCategory = rect;
          break;
        }
      }
      
      if (matchedCategory) {
        // 关键：检查节点及其所有祖先节点是否都超过阈值
        let isAboveThreshold = true;
        if (layerThresholds && maxRectLength && getCoverage) {
          isAboveThreshold = isNodeAndAncestorsAboveThresholds(node, layerThresholds, maxRectLength, getCoverage, typeof layerDepth === 'number' ? layerDepth : node.depth);
        }
        
        links.push({
          node: node,
          category: matchedCategory,
          nodeName: nodeNameStr,
          isAboveThreshold: isAboveThreshold
        });
      }
    });
    
    // 绘制连线
    categoryLinksGroup.selectAll(`path.${className}`)
      .data(links)
      .join('path')
      .attr('class', className)
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr('stroke-width', 0.5)
      .attr('d', d => {
        const nodeX = d.node.x + 100;
        const catX = d.category.x + d.category.width / 2;
        const catY = catRectY - 15;
        
        // 使用贝塞尔曲线创建平滑的连线
        const controlY1 = nodeY + (catY - nodeY) * 0.3;
        const controlY2 = catY - (catY - nodeY) * 0.3;
        
        return `M${nodeX},${nodeY} C${nodeX},${controlY1} ${catX},${controlY2} ${catX},${catY}`;
      })
      .style('opacity', d => d.isAboveThreshold ? 1 : 0)
      .datum(d => ({ node: d.node, category: d.category }));
  }

  // 画分类矩形到第二套内容节点的连线
  function drawCategoryToNode2Links(categoryLinksGroup, nodes2, categories, categoryRects, node2Y, catRectYBottom, layerDepth = '', layerThresholds = null, maxRectLength = null, getCoverage = null, activeLayer = null) {
    const className = layerDepth ? `cat-to-node2-layer${layerDepth}` : 'cat-to-node2';
    
    // 清除之前的连线
    categoryLinksGroup.selectAll(`path.${className}`).remove();
    
    // 为每个第二套节点创建连线
    const links = [];
    nodes2.forEach(node => {
      const nodeNameStr = String(node.data.name);
      let matchedCategory = null;
      
      // 查找匹配的分类
      for (const rect of categoryRects) {
        if (categories[rect.cat] && categories[rect.cat].includes(nodeNameStr)) {
          matchedCategory = rect;
          break;
        }
      }
      
      if (matchedCategory) {
        // 关键：检查节点及其所有祖先节点是否都超过阈值
        let isAboveThreshold = true;
        if (layerThresholds && maxRectLength && getCoverage) {
          isAboveThreshold = isNodeAndAncestorsAboveThresholds(node, layerThresholds, maxRectLength, getCoverage, typeof layerDepth === 'number' ? layerDepth : node.depth);
        }
        
        links.push({
          node: node,
          category: matchedCategory,
          nodeName: nodeNameStr,
          isAboveThreshold: isAboveThreshold
        });
      }
    });
    
    // 绘制连线
    categoryLinksGroup.selectAll(`path.${className}`)
      .data(links)
      .join('path')
      .attr('class', className)
      .attr("fill", "none")
      .attr("stroke", "#333")
      .attr('stroke-width', 0.5)
      .attr('d', d => {
        const nodeX = d.node.x + 100;
        const catX = d.category.x + d.category.width / 2;
        const catY = catRectYBottom - 15;
        
        // 使用贝塞尔曲线创建平滑的连线
        const controlY1 = catY + (node2Y - catY) * 0.3;
        const controlY2 = node2Y - (node2Y - catY) * 0.3;
        
        return `M${catX},${catY} C${catX},${controlY1} ${nodeX},${controlY2} ${nodeX},${node2Y}`;
      })
      .style('opacity', d => d.isAboveThreshold ? 1 : 0)
      .datum(d => ({ node: d.node, category: d.category }));
  }

  // 画层级间的连线（上一层第二套内容到下一层第一套内容）
  function drawLayerConnections(layerConnectionsGroup, layers, node2, nodeHeight, layerThresholds = null, maxRectLength = null, getCoverage = null, activeLayer = null) {
    // 清除之前的连线
    layerConnectionsGroup.selectAll("path.layer-connection").remove();
    
    const connections = [];
    
    // 遍历每一层（除了最后一层）
    for (let i = 0; i < layers.length - 1; i++) {
      if (i === 0){
        continue
      }
      const [currentDepth, currentNodes] = layers[i];
      const [nextDepth, nextNodes] = layers[i + 1];
      
      // console.log(`Processing layer ${currentDepth} to ${nextDepth}`);
      
      // 获取当前层的第二套内容节点
      const currentLayerNodes2 = node2.filter(d => d.depth === currentDepth);
      const currentLayerNodes2Data = currentLayerNodes2.data();
      
      // console.log(`Layer ${currentDepth}: Found ${currentLayerNodes2Data.length} node2 items`);
      
      // 为每个第二套内容节点找到下一层对应的第一套内容节点
      currentLayerNodes2Data.forEach(node2Item => {
        const node2Name = node2Item.data.name;
        
        // 在下一层的第一套内容中查找该节点的子节点
        const childNodes = nextNodes.filter(node => {
          // 检查是否有父子关系
          return node.parent && node.parent.data.name === node2Name;
        });
        
        // console.log(`Node2 ${node2Name} has ${childNodes.length} children in next layer`);
        
        // 为每个子节点创建连线
        childNodes.forEach(childNode => {
          // 只检查子节点是否超过阈值，不检查父节点
          const toNodeAboveThreshold = layerThresholds && maxRectLength && getCoverage 
            ? isNodeAboveThreshold(childNode, layerThresholds, maxRectLength, getCoverage, activeLayer)
            : true;
          
          // 计算第二套内容节点的位置（从原始数据中获取）
          const node2X = node2Item.x + 100;
          const node2Y = node2Item.y + 60 + nodeHeight + 400; // 第二套内容在下方400px处
          
          // 计算下一层第一套内容节点的位置
          const childNodeX = childNode.x + 100;
          const childNodeY = childNode.y + 60;
          
          connections.push({
            fromNode: node2Item,
            toNode: childNode,
            fromX: node2X,
            fromY: node2Y,
            toX: childNodeX,
            toY: childNodeY,
            fromName: node2Name,
            toName: childNode.data.name,
            isVisible: toNodeAboveThreshold // 只根据子节点是否超过阈值来决定连线可见性
          });
          
          // console.log(`Created connection from ${node2Name} to ${childNode.data.name}`);
        });
      });
    }
    
    // console.log(`Total connections created: ${connections.length}`);
    
    // 绘制连线
    layerConnectionsGroup.selectAll("path.layer-connection")
      .data(connections)
      .join("path")
      .attr("class", "layer-connection")
      .attr("fill", "none")
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .style("opacity", d => d.isVisible ? 0.6 : 0)
      .attr("d", d => {
        const { fromX, fromY, toX, toY } = d;
        
        // 使用贝塞尔曲线创建平滑的连线
        const midY = (fromY + toY) / 2;
        const controlY1 = fromY + (midY - fromY) * 0.3;
        const controlY2 = toY - (toY - midY) * 0.3;
        
        return `M${fromX},${fromY} C${fromX},${controlY1} ${toX},${controlY2} ${toX},${toY}`;
      })
      .datum(d => ({ fromNode: d.fromNode, toNode: d.toNode }));
  }

  return {
    drawNodeRects,
    drawLayerRects,
    drawNodes,
    drawSecondSet,
    drawThresholdLines,
    createRootToFirstLayerConnections,
    updateNodeVisibility,
    updateNodeVisibilityForLayers,
    updateAllLowerLayerConnections,
    isNodeAboveThreshold,
    isNodeAboveAllUpperThresholds,
    isNodeAndAncestorsAboveThresholds,
    getNodeDescendants,
    drawNodeToCategoryLinks,
    drawCategoryToNode2Links,
    drawLayerConnections
  }
}