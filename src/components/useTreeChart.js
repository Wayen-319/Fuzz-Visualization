import * as d3 from 'd3'
import { useTreeLayout } from './useTreeLayout'
import { useTreeRendering } from './useTreeRendering'

export function useTreeChart() {
  const { getCoverage, createHierarchy, layoutNodes } = useTreeLayout()
  const { 
    drawNodeRects, 
    drawLayerRects, 
    drawNodes, 
    drawSecondSet, 
    drawThresholdLines, 
    createRootToFirstLayerConnections, 
    updateNodeVisibility, 
    updateAllLowerLayerConnections,
    isNodeAboveThreshold,
    isNodeAboveAllUpperThresholds,
    isNodeAndAncestorsAboveThresholds,
    getNodeDescendants,
    drawNodeToCategoryLinks, 
    drawCategoryToNode2Links,
    drawLayerConnections
  } = useTreeRendering()

  // 常量配置
  const CONFIG = {
    width: 3200,
    height: 2400,
    nodeWidth: 120,
    nodeHeight: 60,
    imgSize: 40,
    maxRectLength: 100,
    rectWidth: 3,
    categoryRectHeight: 30,
    categoryRectGap: 10,
    categoryRectYShift: 60 + 200,
    nodeSpacing: 5,
    groupGap: 30
  }

  // 设置节点事件
  const setupNodeEvents = (node, tooltip, sameData, escapeHtml) => {
    node.on("mouseover", (event, d) => {
      if (!tooltip.classed("persistent")) {
        let foundKey = null
        for (const key in sameData) {
          if (Array.isArray(sameData[key]) && sameData[key].includes(d.data.name)) {
            foundKey = key
            break
          }
        }
        let tooltipContent = escapeHtml(d.data.intro || "")
        if (foundKey) {
          tooltipContent = `【bug序号: ${foundKey}】\n` + tooltipContent
        }
        tooltip.transition().duration(200).style("opacity", 1)
        tooltip.select(".content")
          .html(`<pre>${tooltipContent}</pre>`)
          .style("left", (event.pageX + 20) + "px")
          .style("top", (event.pageY - 20) + "px")
      }
    })
    .on("mousemove", (event) => {
      if (!tooltip.classed("persistent")) {
        tooltip.style("left", (event.pageX + 20) + "px")
               .style("top", (event.pageY - 20) + "px")
      }
    })
    .on("mouseout", () => {
      if (!tooltip.classed("persistent")) {
        tooltip.transition().duration(200).style("opacity", 0)
      }
    })
    .on("click", (event, d) => {
      event.stopPropagation()
      const isPersistent = tooltip.classed("persistent")
      tooltip.classed("persistent", !isPersistent)
      
      if (!isPersistent) {
        let foundKey = null
        for (const key in sameData) {
          if (Array.isArray(sameData[key]) && sameData[key].includes(d.data.name)) {
            foundKey = key
            break
          }
        }
        let tooltipContent = escapeHtml(d.data.intro || "")
        if (foundKey) {
          tooltipContent = `【bug序号: ${foundKey}】\n` + tooltipContent
        }
        tooltip.transition().duration(200).style("opacity", 1)
        tooltip.select(".content")
          .html(`<pre>${tooltipContent}</pre>`)
          .style("left", (event.pageX + 20) + "px")
          .style("top", (event.pageY - 20) + "px")
      } else {
        tooltip.transition().duration(200).style("opacity", 0)
      }
    })
  }

  // 主绘制函数
  const drawTreeChart = (treeData, sameData, mergeData, tooltip, escapeHtml) => {
    d3.select("#graph-chart-container").selectAll("*").remove()

    const { width, height, nodeWidth, nodeHeight, maxRectLength, rectWidth, categoryRectHeight } = CONFIG

    const svg = d3.select("#graph-chart-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block")

    // 添加缩放行为
    const zoom = d3.zoom()
      .scaleExtent([0.05, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    const root = createHierarchy(treeData, width)
    const g = svg.append("g")

    // 创建根节点连线组（只用于根节点到第一层的连线）
    const rootCategoryLinksGroup = g.append("g").attr("class", "category-links-group-root")

    // 创建层级间连线组
    const layerConnectionsGroup = g.append("g").attr("class", "layer-connections-group")

    // 创建层次分组
    const layers = d3.groups(root.descendants(), d => d.depth)
    const layerGroups = g.append("g")
      .selectAll("g.layer")
      .data(layers)
      .join("g")
      .attr("class", "layer")

    // 计算第一层的最小x，供所有层左对齐用
    const firstLayerNodes = layers[1] ? layers[1][1] : []
    const firstLayerMinX = firstLayerNodes.reduce((min, node) => Math.min(min, node.x), Infinity)
    const firstLayerMaxX = firstLayerNodes.reduce((max, node) => Math.max(max, node.x), -Infinity)
    const standardWidth = firstLayerMaxX - firstLayerMinX

    // 布局节点
    layoutNodes(layers, firstLayerMinX, standardWidth, layerGroups, CONFIG)

    // 绘制覆盖矩形
    drawLayerRects(layerGroups, layers, firstLayerMinX, standardWidth, nodeHeight)

    // 绘制节点
    const node = drawNodes(layerGroups, layers, nodeHeight)

    // 绘制第二套内容
    const node2 = drawSecondSet(g, layers, nodeHeight)

    // 创建拖动回调函数
    const onThresholdChange = (depth, threshold, { baseY, baseY2, nodeHeight }, layerThresholds) => {
      // 更新所有下层连线的可见性
      updateAllLowerLayerConnections(depth, layerThresholds, maxRectLength, getCoverage);
      
      // 更新层级间连线 - 重新绘制所有连线以确保正确性
      drawLayerConnections(layerConnectionsGroup, layers, node2, nodeHeight, layerThresholds, maxRectLength, getCoverage, depth);
      
      // 更新节点可见性
      updateNodeVisibility(node, layers, maxRectLength, getCoverage, layerThresholds);
      
      // 更新分类矩形
      updateCategoryRects(g, layers, mergeData, firstLayerMinX, standardWidth, nodeHeight, layerThresholds, maxRectLength, getCoverage);
    };

    // 识别没有分类的节点
    const findUncategorizedNodes = (layers, mergeData) => {
      const uncategorizedNodes = [];
      
      layers.forEach(([depth, nodes], layerIdx) => {
        if (depth === 0) return; // 跳过根节点
        
        const categories = mergeData[layerIdx-1] || {};
        const categoryKeys = Object.keys(categories);
        if (categoryKeys.length === 0) return;
        
        nodes.forEach(node => {
          const nodeNameStr = String(node.data.name);
          let isCategorized = false;
          
          // 检查节点是否属于任何分类
          for (const cat of categoryKeys) {
            if (categories[cat] && categories[cat].includes(nodeNameStr)) {
              isCategorized = true;
              break;
            }
          }
          
          // 如果节点不属于任何分类，添加到未分类列表
          if (!isCategorized) {
            uncategorizedNodes.push(nodeNameStr);
          }
        });
      });
      
      // 在控制台输出没有分类的节点名字
      if (uncategorizedNodes.length > 0) {
        console.log("没有分类的节点名字:", uncategorizedNodes);
      } else {
        console.log("所有节点都有分类");
      }
      
      return uncategorizedNodes;
    };

    // 识别没有分类的节点
    const uncategorizedNodes = findUncategorizedNodes(layers, mergeData);

    // 绘制横线和拖动行为
    const { dragLines, dragLines2, dragBehaviors, layerThresholds } = drawThresholdLines(
      g, layers, node, node2, firstLayerMinX, standardWidth, nodeHeight, maxRectLength, rectWidth, getCoverage, onThresholdChange, uncategorizedNodes
    )

    // 计算分类连接节点数量的函数
    const calculateCategoryConnections = (nodes, categories, layerThresholds, maxRectLength, getCoverage, layerDepth) => {
      const categoryConnections = {};
      
      // 初始化每个分类的连接计数
      Object.keys(categories).forEach(cat => {
        categoryConnections[cat] = 0;
      });
      
      // 计算每个分类的连接节点数量
      nodes.forEach(node => {
        const nodeNameStr = String(node.data.name);
        
        // 检查节点是否超过阈值
        let isAboveThreshold = true;
        if (layerThresholds && maxRectLength && getCoverage) {
          isAboveThreshold = isNodeAndAncestorsAboveThresholds(node, layerThresholds, maxRectLength, getCoverage, layerDepth);
        }
        
        // 如果节点超过阈值，计算它属于哪个分类
        if (isAboveThreshold) {
          for (const cat of Object.keys(categories)) {
            if (categories[cat] && categories[cat].includes(nodeNameStr)) {
              categoryConnections[cat]++;
              break;
            }
          }
        }
      });
      
      return categoryConnections;
    };

    // 更新分类矩形的函数
    const updateCategoryRects = (g, layers, mergeData, firstLayerMinX, standardWidth, nodeHeight, layerThresholds, maxRectLength, getCoverage) => {
      layers.forEach(([depth, nodes], layerIdx) => {
        if (depth === 0) return;
        
        const baseY = nodes[0].y + 60;
        const categories = mergeData[layerIdx-1] || {};
        const categoryKeys = Object.keys(categories);
        if (categoryKeys.length === 0) return;
        
        if (depth === 1) {
          // 第一层：直接按mergeData分类
          const categoryConnections = calculateCategoryConnections(nodes, categories, layerThresholds, maxRectLength, getCoverage, depth);
          
          // 计算分类宽度分配
          const totalCount = d3.sum(categoryKeys, cat => categoryConnections[cat] || 0) || 1;
          const totalWidth = standardWidth + 1;
          let xCursor = firstLayerMinX + 100 - 0.5;
          
          // 更新分类矩形
          categoryKeys.forEach((cat, i) => {
            const count = categoryConnections[cat] || 0;
            const width = count > 0 ? (totalWidth * count / totalCount) : 0;
            
            // 更新或创建分类矩形
            const rectSelector = `.cat-rect-layer${depth}-cat${i}`;
            const existingRect = g.select(rectSelector);
            
            if (width > 0) {
              if (existingRect.empty()) {
                // 创建新矩形
                g.append("rect")
                  .attr("class", `cat-rect cat-rect-layer${depth}-cat${i}`)
                  .attr("x", xCursor)
                  .attr("y", baseY + (nodeHeight + 400) / 2 - 15)
                  .attr("width", width)
                  .attr("height", 30)
                  .attr("fill", d3.schemeCategory10[i % d3.schemeCategory10.length])
                  .attr("opacity", 0.7)
                  .lower();
              } else {
                // 更新现有矩形
                existingRect
                  .attr("x", xCursor)
                  .attr("width", width)
                  .style("display", "block");
              }
              xCursor += width;
            } else {
              // 隐藏没有连接的矩形
              if (!existingRect.empty()) {
                existingRect.style("display", "none");
              }
            }
          });
        } else {
          // 其他层：先按父节点分组，再在每个组内按mergeData分类
          const groupMap = {};
          nodes.forEach(node => {
            const parentName = node.parent?.data?.name || 'unknown';
            if (!groupMap[parentName]) groupMap[parentName] = [];
            groupMap[parentName].push(node);
          });
          const groupKeys = Object.keys(groupMap);
          const groupNodes = groupKeys.map(key => groupMap[key]);
          
          // 计算每组宽度和组间间隔
          const groupWidths = groupNodes.map(group => (group.length > 0 ? (group.length - 1) * CONFIG.nodeSpacing : 0));
          let totalGroupsWidth = groupWidths.reduce((a, b) => a + b, 0);
          let totalGapWidth = CONFIG.groupGap * (groupNodes.length - 1);
          let totalWidth = totalGroupsWidth + totalGapWidth;
          
          // 计算上一层宽度
          let prevLayerWidth = standardWidth;
          
          // 居中排列
          let x = firstLayerMinX;
          if (totalWidth > prevLayerWidth) {
            x = firstLayerMinX;
          } else {
            x = firstLayerMinX + (prevLayerWidth - totalWidth) / 2;
          }
          
          // 为每组分配位置并更新分类矩形
          groupNodes.forEach((group, groupIdx) => {
            // 为组内节点分配x坐标
            group.forEach((node, j) => {
              node.x = x + j * CONFIG.nodeSpacing;
            });
            
            // 计算组内分类连接数量
            const groupCategoryConnections = calculateCategoryConnections(group, categories, layerThresholds, maxRectLength, getCoverage, depth);
            
            // 计算组内分类宽度
            const groupMinX = Math.min(...group.map(n => n.x));
            const groupMaxX = Math.max(...group.map(n => n.x));
            const groupWidth = groupMaxX - groupMinX + 1;
            
            // 为组内每个分类分配宽度
            let categoryX = groupMinX + 100 - 0.5;
            categoryKeys.forEach((cat, catIdx) => {
              const count = groupCategoryConnections[cat] || 0;
              const width = count > 0 ? (groupWidth * count) / group.length : 0;
              
              // 更新或创建组内分类矩形
              const rectSelector = `.cat-rect-layer${depth}-group${groupIdx}-cat${catIdx}`;
              const existingRect = g.select(rectSelector);
              
              if (width > 0) {
                if (existingRect.empty()) {
                  // 创建新矩形
                  g.append("rect")
                    .attr("class", `cat-rect cat-rect-layer${depth}-group${groupIdx}-cat${catIdx}`)
                    .attr("x", categoryX)
                    .attr("y", baseY + (nodeHeight + 400) / 2 - 15)
                    .attr("width", width)
                    .attr("height", 30)
                    .attr("fill", d3.schemeCategory10[catIdx % d3.schemeCategory10.length])
                    .attr("opacity", 0.7)
                    .lower();
                } else {
                  // 更新现有矩形
                  existingRect
                    .attr("x", categoryX)
                    .attr("width", width)
                    .style("display", "block");
                }
                categoryX += width;
              } else {
                // 隐藏没有连接的矩形
                if (!existingRect.empty()) {
                  existingRect.style("display", "none");
                }
              }
            });
            
            x += groupWidths[groupIdx] + CONFIG.groupGap;
          });
        }
      });
    };

    // 每一层都画节点到分类、分类到第二套内容的连线
    layers.forEach(([depth, nodes], layerIdx) => {
      if (depth === 0) return;
      
      // 为每一层创建独立的连线组
      const layerCategoryLinksGroup = g.append("g").attr("class", `category-links-group-layer${depth}`)
      
      // 分类信息
      const categories = mergeData[layerIdx-1] || {};
      const categoryKeys = Object.keys(categories);
      if (categoryKeys.length === 0) return;
      
      // 该层所有节点的y都一样
      const baseY = nodes[0].y + 60;
      const baseY2 = baseY + nodeHeight + 400;
      
      if (depth === 1) {
        // 第一层：直接按mergeData分类
        // 分类统计
        const categoryNodeMap = {};
        categoryKeys.forEach((cat, i) => {
          categoryNodeMap[cat] = [];
        });
        
        // 所有节点都参与分类
        nodes.forEach(d => {
          const name = d.data.name;
          for (const cat of categoryKeys) {
            if (categories[cat] && categories[cat].includes(name)) {
              categoryNodeMap[cat].push(d);
              break;
            }
          }
        });
        
        // 分类宽度分配
        const totalCount = d3.sum(categoryKeys, cat => categoryNodeMap[cat].length || 0) || 1;
        const totalWidth = standardWidth + 1;
        let xCursor = firstLayerMinX + 100 - 0.5;
        const categoryRects = [];
        categoryKeys.forEach((cat, i) => {
          const count = categoryNodeMap[cat].length || 0;
          const width = count > 0 ? (totalWidth * count / totalCount) : 0;
          if (width > 0) {
            categoryRects.push({
              cat,
              x: xCursor,
              width,
              color: d3.schemeCategory10[i % d3.schemeCategory10.length],
              count,
            });
            xCursor += width;
          }
        });
        
        // 画分类矩形
        categoryRects.forEach((catRect, catIdx) => {
          layerCategoryLinksGroup.append("rect")
            .attr("class", `cat-rect cat-rect-layer${depth}-cat${catIdx}`)
            .attr("x", catRect.x)
            .attr("y", baseY + (nodeHeight + 400) / 2 - 15)
            .attr("width", catRect.width)
            .attr("height", 30)
            .attr("fill", catRect.color)
            .attr("opacity", 0.7)
            .lower();
        });
        
        // 画节点到分类连线
        drawNodeToCategoryLinks(
          layerCategoryLinksGroup,
          nodes,
          categories,
          categoryRects,
          baseY,
          baseY + (nodeHeight + 400) / 2,
          depth,
          layerThresholds,
          maxRectLength,
          getCoverage,
          depth // 与当前层绑定
        );
        
        // 画分类到第二套内容节点连线
        const nodes2 = node2.filter(d => d.depth === depth).data();
        drawCategoryToNode2Links(
          layerCategoryLinksGroup,
          nodes2,
          categories,
          categoryRects,
          baseY2,
          baseY + (nodeHeight + 400) / 2 + 30,
          depth,
          layerThresholds,
          maxRectLength,
          getCoverage,
          depth // 与当前层绑定
        );
      } else {
        // 其他层：先按父节点分组，再在每个组内按mergeData分类
        
        // 1. 按父节点分组
        const groupMap = {};
        nodes.forEach(node => {
          const parentName = node.parent?.data?.name || 'unknown';
          if (!groupMap[parentName]) groupMap[parentName] = [];
          groupMap[parentName].push(node);
        });
        const groupKeys = Object.keys(groupMap);
        const groupNodes = groupKeys.map(key => groupMap[key]);
        
        // 2. 计算每组宽度和组间间隔
        const groupWidths = groupNodes.map(group => (group.length > 0 ? (group.length - 1) * CONFIG.nodeSpacing : 0));
        let totalGroupsWidth = groupWidths.reduce((a, b) => a + b, 0);
        let totalGapWidth = CONFIG.groupGap * (groupNodes.length - 1);
        let totalWidth = totalGroupsWidth + totalGapWidth;
        
        // 3. 计算上一层宽度
        let prevLayerWidth = standardWidth;
        
        // 4. 居中排列
        let x = firstLayerMinX;
        if (totalWidth > prevLayerWidth) {
          x = firstLayerMinX;
        } else {
          x = firstLayerMinX + (prevLayerWidth - totalWidth) / 2;
        }
        
        // 5. 为每组分配位置并画分类矩形
        groupNodes.forEach((group, groupIdx) => {
          // 为每个组创建独立的连线组
          const groupCategoryLinksGroup = g.append("g").attr("class", `category-links-group-layer${depth}-group${groupIdx}`);
          
          // 为组内节点分配x坐标
          group.forEach((node, j) => {
            node.x = x + j * CONFIG.nodeSpacing;
          });
          
          // 在组内按categoryKeys分类
          const groupCategoryMap = {};
          categoryKeys.forEach((cat, i) => {
            groupCategoryMap[cat] = [];
          });
          
          group.forEach(node => {
            const name = node.data.name;
            for (const cat of categoryKeys) {
              if (categories[cat] && categories[cat].includes(name)) {
                groupCategoryMap[cat].push(node);
                break;
              }
            }
          });
          
          // 计算组内分类宽度
          const groupMinX = Math.min(...group.map(n => n.x));
          const groupMaxX = Math.max(...group.map(n => n.x));
          const groupWidth = groupMaxX - groupMinX + 1;
          
          // 为组内每个分类分配宽度
          const groupCategoryRects = [];
          let categoryX = groupMinX + 100 - 0.5;
          categoryKeys.forEach((cat, catIdx) => {
            const count = groupCategoryMap[cat].length || 0;
            if (count > 0) {
              const width = (groupWidth * count) / group.length;
              groupCategoryRects.push({
                cat,
                x: categoryX,
                width,
                color: d3.schemeCategory10[catIdx % d3.schemeCategory10.length],
                count,
                groupIdx
              });
              categoryX += width;
            }
          });
          
          // 画组内分类矩形
          groupCategoryRects.forEach((catRect, catIdx) => {
            groupCategoryLinksGroup.append("rect")
              .attr("class", `cat-rect cat-rect-layer${depth}-group${groupIdx}-cat${catIdx}`)
              .attr("x", catRect.x)
              .attr("y", baseY + (nodeHeight + 400) / 2 - 15)
              .attr("width", catRect.width)
              .attr("height", 30)
              .attr("fill", catRect.color)
              .attr("opacity", 0.7)
              .lower();
          });
          
          // 画节点到分类连线（组内分类）
          drawNodeToCategoryLinks(
            groupCategoryLinksGroup,
            group,
            categories,
            groupCategoryRects,
            baseY,
            baseY + (nodeHeight + 400) / 2,
            depth,
            layerThresholds,
            maxRectLength,
            getCoverage,
            depth // 与当前层绑定
          );
          
          // 画分类到第二套内容节点连线（组内分类）
          const groupNodes2 = node2.filter(d => d.depth === depth && group.some(g => g.data.name === d.data.name)).data();
          drawCategoryToNode2Links(
            groupCategoryLinksGroup,
            groupNodes2,
            categories,
            groupCategoryRects,
            baseY2,
            baseY + (nodeHeight + 400) / 2 + 30,
            depth,
            layerThresholds,
            maxRectLength,
            getCoverage,
            depth // 与当前层绑定
          );
          
          x += groupWidths[groupIdx] + CONFIG.groupGap;
        });
      }
    });

    // 绘制层级间连线（上一层第二套内容到下一层第一套内容）
    drawLayerConnections(layerConnectionsGroup, layers, node2, nodeHeight, layerThresholds, maxRectLength, getCoverage, null)

    // 创建根节点到第一层的连线（使用根节点连线组）
    createRootToFirstLayerConnections(rootCategoryLinksGroup, layers)

    // 初始化节点可见性
    updateNodeVisibility(node, layers, maxRectLength, getCoverage, null)

    // 初始化分类矩形
    updateCategoryRects(g, layers, mergeData, firstLayerMinX, standardWidth, nodeHeight, layerThresholds, maxRectLength, getCoverage);

    // 设置节点事件
    setupNodeEvents(node, tooltip, sameData, escapeHtml)
  }

  return {
    drawTreeChart,
    setupNodeEvents
  }
} 