import * as d3 from 'd3'
import { useTreeLayout } from './useTreeLayout'
import { useTreeRendering } from './useTreeRendering'

export function useTreeChart() {
  const { getCoverage, createHierarchy, layoutNodes } = useTreeLayout()
  const { 
    drawNodeRects, 
    drawLayerRects, 
    drawNodes, 
    drawThresholdLines, 
    updateNodeVisibility,
    isNodeAboveThreshold
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
    nodeSpacing: 5,
    groupGap: 120
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
  const drawTreeChart = (treeData, sameData, mergeData, tooltip, gapbide_resultData, escapeHtml) => {
    d3.select("#graph-chart-container").selectAll("*").remove()

    const { width, height, nodeWidth, nodeHeight, maxRectLength, rectWidth } = CONFIG

    const svg = d3.select("#graph-chart-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block")
      
    const svg2 = d3.select("#graph-chart-container2")
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
    const g = svg.append("g");

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

    // 分类信息集成到节点：构建节点名到类别的映射
    const nodeToCategory = {}
    mergeData.forEach((layerCats) => {
      Object.entries(layerCats).forEach(([cat, arr]) => {
        arr.forEach(nodeId => {
          nodeToCategory[nodeId] = cat
        })
      })
    })
    // 统计所有类别，分配颜色
    const allCategories = Array.from(new Set(Object.values(nodeToCategory)))
    const colorMap = {}
    allCategories.forEach((cat, idx) => {
      colorMap[cat] = d3.schemeCategory10[idx % d3.schemeCategory10.length]
    })

    // 识别没有分类的节点
    const uncategorizedNodes = []
    layers.forEach(([depth, nodes]) => {
      if (depth === 0) return
      nodes.forEach(node => {
        const nodeNameStr = String(node.data.name)
        if (!nodeToCategory[nodeNameStr]) {
          uncategorizedNodes.push(nodeNameStr)
        }
      })
    })

    // --- 新：每层每组内分类着色 ---
    // 1. 全局收集所有cat编号
    const allCatsSet = new Set();
    mergeData.forEach(layerCats => {
      Object.keys(layerCats).forEach(cat => allCatsSet.add(cat));
    });
    const allCats = Array.from(allCatsSet).sort((a, b) => Number(a) - Number(b));
    // 2. 全局分配颜色
    const globalColorMap = {};
    allCats.forEach((cat, idx) => {
      globalColorMap[cat] = d3.schemeCategory10[idx % d3.schemeCategory10.length];
    });
    // 3. 构建每层每组的分组信息和组内分类色（用全局颜色）
    const groupColorMaps = {};
    layers.forEach(([depth, nodes]) => {
      if (depth === 0) return;
      // 按父节点分组
      const groupMap = {};
      nodes.forEach(node => {
        const parentName = node.parent?.data?.name || 'unknown';
        if (!groupMap[parentName]) groupMap[parentName] = [];
        groupMap[parentName].push(node);
      });
      groupColorMaps[depth] = {};
      Object.entries(groupMap).forEach(([parentName, groupNodes]) => {
        // 统计组内所有分类（merge_data[depth-1]）
        const mergeLayer = mergeData[depth-1] || {};
        // 组内节点名集合
        const groupNodeNames = new Set(groupNodes.map(n => n.data.name));
        // 组内分类名集合
        const groupCats = Object.keys(mergeLayer).filter(cat =>
          (mergeLayer[cat] || []).some(name => groupNodeNames.has(name))
        );
        // 组内分类直接用全局颜色映射
        const colorMap = {};
        groupCats.forEach(cat => {
          colorMap[cat] = globalColorMap[cat];
        });
        groupColorMaps[depth][parentName] = colorMap;
      });
    });

    // 2. 计算每个节点的分类（组内查找）
    const nodeToGroupCat = {};
    layers.forEach(([depth, nodes]) => {
      if (depth === 0) return;
      const mergeLayer = mergeData[depth-1] || {};
      nodes.forEach(node => {
        const parentName = node.parent?.data?.name || 'unknown';
        let foundCat = null;
        for (const cat in mergeLayer) {
          if ((mergeLayer[cat] || []).includes(node.data.name)) {
            foundCat = cat;
            break;
          }
        }
        nodeToGroupCat[`${depth}|${parentName}|${node.data.name}`] = foundCat;
      });
    });

    // 3. 计算每个节点的可见性
    const nodeVisibility = new Map();
    layers.forEach(([depth, nodes]) => {
      if (depth === 0) return;
      nodes.forEach(node => {
        const isVisible = isNodeAboveThreshold(node, {}, maxRectLength, getCoverage);
        nodeVisibility.set(node.data.name, isVisible);
      });
    });

    // 4. 绘制节点
    node.selectAll("rect").remove();
    node.append("rect")
      .attr("x", -rectWidth / 2)
      .attr("y", d => -getCoverage(d) * maxRectLength)
      .attr("width", rectWidth)
      .attr("height", d => getCoverage(d) * maxRectLength)
      .attr("fill", d => {
        const name = d.data.name;
        const isVisible = nodeVisibility.get(name);
        const depth = d.depth;
        const parentName = d.parent?.data?.name || 'unknown';
        const cat = nodeToGroupCat[`${depth}|${parentName}|${name}`];
        let color = groupColorMaps[depth]?.[parentName]?.[cat];
        if (!color || typeof color !== 'string' || !color.startsWith('#')) color = "#1976d2";
        if (!isVisible) return "#bbdefb";
        if (uncategorizedNodes.includes(name)) return "#ff0000";
        return color;
      })
      .attr("opacity", d => {
        const name = d.data.name;
        if (uncategorizedNodes.includes(name)) return 1.0;
        return 1.0;
      })
      .attr("stroke", "white")
      .attr("stroke-width", 0.2)

    // 动态更新节点颜色和可见性的函数
    function updateNodeColorsAndVisibility(layerThresholds) {
      // 重新计算每个节点的可见性
      node.each(function(d) {
        if (d.depth === 0) {
          nodeVisibility.set(d.data.name, true);
        } else {
          const isVisible = isNodeAboveThreshold(d, layerThresholds, maxRectLength, getCoverage);
          nodeVisibility.set(d.data.name, isVisible);
        }
      });
      // 重新设置 fill
      node.selectAll("rect")
        .attr("fill", d => {
          const name = d.data.name;
          const isVisible = nodeVisibility.get(name);
          const depth = d.depth;
          const parentName = d.parent?.data?.name || 'unknown';
          const cat = nodeToGroupCat[`${depth}|${parentName}|${name}`];
          let color = groupColorMaps[depth]?.[parentName]?.[cat];
          if (!color || typeof color !== 'string' || !color.startsWith('#')) color = "#1976d2";
          if (!isVisible) return "#bbdefb";
          if (uncategorizedNodes.includes(name)) return "#ff0000";
          return color;
        });
    }

    // 动态更新连线可见性的函数
    function updateLinkVisibility() {
      linkGroup.selectAll("path.tree-link")
        .attr("opacity", d => {
          const sourceVisible = nodeVisibility.get(d.source.data.name);
          const targetVisible = nodeVisibility.get(d.target.data.name);
          return (sourceVisible && targetVisible) ? 1 : 0;
        });
    }

    // 保留每一层的横线功能
    const onThresholdChange = (depth, threshold, { baseY, baseY2, nodeHeight }, layerThresholds) => {
      updateNodeVisibility(node, layers, maxRectLength, getCoverage, layerThresholds);
      updateNodeColorsAndVisibility(layerThresholds);
      updateLinkVisibility(); // 横线拖动时动态更新连线可见性
    };
    drawThresholdLines(
      g, layers, node, null, firstLayerMinX, standardWidth, nodeHeight, maxRectLength, rectWidth, getCoverage, onThresholdChange, uncategorizedNodes
    )

    // 只保留父子节点之间的树结构连线
    const linkGroup = g.append("g").attr("class", "tree-links-group")
    const links = [];
    root.descendants().forEach(node => {
      if (node.parent) {
        links.push({ source: node.parent, target: node });
      }
    });

    // 计算每层rect的顶部和底部y坐标
    const layerRectsY = {};
    layers.forEach(([depth, nodes]) => {
      if (depth === 0) return;
      // drawLayerRects 里的 y 和 height 计算方式
      const rectY = nodes[0].y - 60 - nodeHeight / 2;
      const rectHeight = nodeHeight + 89.5;
      layerRectsY[depth] = {
        top: rectY,
        bottom: rectY + rectHeight
      };
    });

    linkGroup.selectAll("path.tree-link")
      .data(links)
      .join("path")
      .attr("class", "tree-link")
      .attr("fill", "none")
      .attr("stroke", "#bbb")
      .attr("stroke-width", 1)
      .attr("d", d => {
        // 父节点根部（中心）
        const startX = d.source.x + 100;
        const startY = d.source.y + 60; // 中心点
        // 子节点rect顶端
        const endX = d.target.x + 100;
        const endY = (() => {
          const centerY = d.target.y + 60;
          const rectTop = -getCoverage(d.target) * maxRectLength;
          return centerY + rectTop;
        })();
        const midY = (startY + endY) / 2;
        return `M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}`;
      })

    // 初始化节点可见性
    updateNodeVisibility(node, layers, maxRectLength, getCoverage, null)

    // 设置节点事件
    setupNodeEvents(node, tooltip, sameData, escapeHtml)

    // --- 新增：为每层左侧绘制 sidebar 和标题 ---
    const sidebarWidth = 64;
    const sidebarMargin = 48;
    const sidebarBlockHeight = 64;
    const sidebarBlockGap = 30;
    const sidebarTitleFontSize = 64;
    const sidebarTitleHeight = sidebarTitleFontSize + 4;

    layers.forEach(([depth, nodes], layerIdx) => {
      if (depth === 0) return;
      // 按父节点分组
      const groupMap = {};
      nodes.forEach(node => {
        const parentName = node.parent?.data?.name || 'unknown';
        if (!groupMap[parentName]) groupMap[parentName] = [];
        groupMap[parentName].push(node);
      });
      // 取第一组
      const firstGroupName = Object.keys(groupMap)[0];
      if (!firstGroupName) return;
      const colorMap = groupColorMaps[depth]?.[firstGroupName];
      // console.log(groupColorMaps)
      if (!colorMap) return;
      const cats = Object.keys(colorMap);
      if (cats.length === 0) return;
      
      // 保存当前组的颜色映射，用于后续更新
      let currentGroupColorMap = colorMap;

      // 该层的 y 坐标
      const y = nodes[0].y - 58.5 - nodeHeight / 2;
      // 该层最左侧节点的 x 坐标
      const minX = Math.min(...groupMap[firstGroupName].map(n => n.x));

      // 横向排列 sidebar 色块，每行最多5个
      const sidebarX = minX - sidebarWidth - sidebarMargin - 300;
      const sidebarY = y;
      const blocksPerRow = 5;
      const numRows = Math.ceil(cats.length / blocksPerRow);
      const totalSidebarWidth = Math.min(blocksPerRow, cats.length) * sidebarWidth + (Math.min(blocksPerRow, cats.length) - 1) * sidebarBlockGap;
      const totalSidebarHeight = numRows * sidebarBlockHeight + (numRows - 1) * sidebarBlockGap;

      // 选中该层的 <g class="layer">
      const layerG = d3.select(layerGroups.nodes()[layerIdx]);

      // 创建sidebar的函数
      const createSidebar = (colorMap, groupName) => {
        // 清除现有的sidebar色块
        layerG.selectAll(".sidebar-rect").remove();
        
        const cats = Object.keys(colorMap);
        const sidebarRects = [];
        
      // 横向排列 sidebar 色块，超出5个则换行
      cats.forEach((cat, i) => {
        const row = Math.floor(i / blocksPerRow);
        const col = i % blocksPerRow;
          const rect = layerG.append("rect")
            .attr("class", "sidebar-rect")
          .attr("x", sidebarX + col * (sidebarWidth + sidebarBlockGap))
          .attr("y", sidebarY + row * (sidebarBlockHeight + sidebarBlockGap))
          .attr("width", sidebarWidth)
          .attr("height", sidebarBlockHeight)
          .attr("fill", colorMap[cat])
          .attr("rx", 4)
          .attr("stroke", "#888")
          .attr("stroke-width", 0.5)
            .attr("opacity", 0.95)
            .attr("data-category", cat)
            .style("cursor", "pointer")
            .on("click", function() {
              // 获取当前层、组、类别、色块颜色
              const color = colorMap[cat];
              // 获取该组下所有节点
              const groupNodes = groupMap[groupName] || [];
              // 只保留该类别的节点
              const filteredNodes = groupNodes.filter(node => {
                // nodeToGroupCat: key = `${depth}|${parentName}|${node.data.name}`
                const parentName = node.parent?.data?.name || 'unknown';
                const key = `${depth}|${parentName}|${node.data.name}`;
                return nodeToGroupCat[key] === cat;
              });
              // 获取当前层数
              const layerNum = depth;
              // 获取当前组在本层的序号
              // 将 groupIdx 变为数字类别（即该颜色在 colorMap 中的索引）
              const groupIdx = Object.values(colorMap).findIndex(v => v === color);
              console.log(layerNum, groupIdx);
              // 生成HTML
              let html = `<div style='font-size:20px;font-weight:bold;margin-bottom:12px;'>layer${layerNum} group${groupIdx+1} <span style='display:inline-block;width:24px;height:24px;background:${color};border-radius:4px;vertical-align:middle;margin-left:8px;'></span></div>`;
              html += `<div style='font-size:16px;'>`;
              if (filteredNodes.length === 0) {
                html += `<div style='color:#888;'>该组下没有该类别的节点</div>`;
              } else {
                if (gapbide_resultData[depth-1][groupIdx] === "NA"){
                  html += `<div style='margin-bottom:6px;'><b>${gapbide_resultData[depth-1][groupIdx]}</b></div>`;
                }
                else{
                  // console.log(gapbide_resultData);
                  const arr = gapbide_resultData?.[depth-1]?.[groupIdx];
                  if (Array.isArray(arr)) {
                    html += arr.map((item, idx) => {
                      const formatted = item.trim().split(/\s+/).join(', ');
                      let line = `<div style='margin-bottom:6px;'><b>${formatted}</b></div>`;
                      if (idx !== arr.length - 1) {
                        line += `<hr style='border:none;border-top:1px solid #e0e0e0;margin:8px 20px;'/>`;
                      }
                      return line;
                    }).join('');
                  } else if (arr) {
                    const formatted = arr.trim().split(/\s+/).join(', ');
                    html += `<div style='margin-bottom:6px;'><b>${formatted}</b></div>`;
                  }
                }
              }
              html += `</div>`;
              // 渲染到右侧区域
              const rightPanel = document.getElementById("graph-chart-container2");
              if (rightPanel) rightPanel.innerHTML = html;
            });
          sidebarRects.push(rect);
        });
        
        return sidebarRects;
      };
      
      // 初始化sidebar（显示第一组的色块）
      let sidebarRects = createSidebar(colorMap, firstGroupName);
      
      // 闪亮覆盖矩形的函数
      const highlightGroupRect = (depth, groupName, layerG, groupMap) => {
        // 找到对应的覆盖矩形
        const rects = layerG.selectAll("rect").filter(function() {
          // 检查是否是覆盖矩形（不是sidebar的色块）
          return !d3.select(this).classed("sidebar-rect");
        });
        
        // 如果是第一层，只有一个覆盖矩形
        if (depth === 1) {
          const firstLayerRect = rects.filter((d, i) => i === 0);
          if (!firstLayerRect.empty()) {
            // 添加闪亮效果
            firstLayerRect
              .transition()
              .duration(200)
              .attr("fill", "#ffeb3b") // 黄色闪亮
              .transition()
              .duration(200)
              .attr("fill", "#e0e0e0"); // 恢复原色
          }
        } else {
          // 其他层：通过位置找到对应组的覆盖矩形
          // 获取该组节点的x坐标范围
          const groupNodes = groupMap[groupName] || [];
          if (groupNodes.length > 0) {
            const groupMinX = Math.min(...groupNodes.map(n => n.x));
            const groupMaxX = Math.max(...groupNodes.map(n => n.x));
            
            // 找到覆盖矩形，其x坐标范围与组节点范围匹配
            const targetRect = rects.filter(function() {
              const rectX = parseFloat(d3.select(this).attr("x"));
              const rectWidth = parseFloat(d3.select(this).attr("width"));
              const rectMinX = rectX - 100 + 2; // 减去偏移量
              const rectMaxX = rectMinX + rectWidth - 4; // 减去边框宽度
              
              // 检查矩形范围是否与组范围重叠
              return rectMinX <= groupMaxX && rectMaxX >= groupMinX;
            });
            
            if (!targetRect.empty()) {
              // 添加闪亮效果
              targetRect
                .transition()
                .duration(200)
                .attr("fill", "#ffeb3b") // 黄色闪亮
                .transition()
                .duration(200)
                .attr("fill", "#e0e0e0"); // 恢复原色
            }
          }
        }
      };
      
      // --- 新增：为每层添加下拉式菜单栏 ---
      const dropdownWidth = 240;
      const dropdownHeight = 80;
      const dropdownMargin = 96;
      const dropdownFontSize = 45;
      const dropdownTitleFontSize = 32;
      const dropdownTitleHeight = dropdownTitleFontSize + 8;
      
      // 计算下拉菜单的位置（在sidebar左侧）
      const dropdownX = sidebarX - dropdownWidth - dropdownMargin;
      const dropdownY = sidebarY;
      
      // 添加下拉菜单容器
      const dropdownContainer = layerG.append("g")
        .attr("class", "dropdown-container")
        .attr("transform", `translate(${dropdownX}, ${dropdownY})`);
      
      // 创建下拉菜单背景
      const dropdownBg = dropdownContainer.append("rect")
        .attr("width", dropdownWidth)
        .attr("height", dropdownHeight)
        .attr("fill", "#f8f9fa")
        .attr("stroke", "#dee2e6")
        .attr("stroke-width", 1)
        .attr("rx", 8);
      
      // 创建下拉菜单文本
      const dropdownText = dropdownContainer.append("text")
        .attr("x", dropdownWidth / 2)
        .attr("y", dropdownHeight / 2 + 20)
        .attr("text-anchor", "middle")
        .attr("font-size", dropdownFontSize)
        .attr("fill", "#495057")
        .attr("font-family", "Arial, sans-serif")
        .text(`Group 1`);
      
      // 创建下拉箭头
      const arrowSize = 8;
      const arrowX = dropdownWidth - 15;
      const arrowY = dropdownHeight / 2;
      
      const arrow = dropdownContainer.append("path")
        .attr("d", `M${arrowX - arrowSize/2},${arrowY - arrowSize/2} L${arrowX + arrowSize/2},${arrowY - arrowSize/2} L${arrowX},${arrowY + arrowSize/2} Z`)
        .attr("fill", "#6c757d");
      
      // 创建下拉选项列表（初始隐藏）
      const dropdownOptions = dropdownContainer.append("g")
        .attr("class", "dropdown-options")
        .style("display", "none");
      
      // 为每个组创建选项
      Object.keys(groupMap).forEach((groupName, groupIndex) => {
        const optionY = dropdownHeight + 5 + groupIndex * (dropdownHeight + 2);
        
        // 选项背景
        dropdownOptions.append("rect")
          .attr("x", 0)
          .attr("y", optionY)
          .attr("width", dropdownWidth)
          .attr("height", dropdownHeight)
          .attr("fill", "#ffffff")
          .attr("stroke", "#dee2e6")
          .attr("stroke-width", 1)
          .attr("rx", 4)
          .attr("class", "dropdown-option")
          .attr("data-group-index", groupIndex);
        
        // 选项文本
        dropdownOptions.append("text")
          .attr("x", dropdownWidth / 2)
          .attr("y", optionY + dropdownHeight / 2 + 20)
          .attr("text-anchor", "middle")
          .attr("font-size", dropdownFontSize)
          .attr("fill", "#495057")
          .attr("font-family", "Arial, sans-serif")
          .attr("class", "dropdown-option-text")
          .attr("data-group-index", groupIndex)
          .text(`Group ${groupIndex + 1}`);
      });
      
      // 添加下拉菜单交互事件
      let isDropdownOpen = false;
      let currentGroupIndex = 0;
      
      // 点击下拉菜单背景切换显示/隐藏
      dropdownBg.on("click", function() {
        isDropdownOpen = !isDropdownOpen;
        dropdownOptions.style("display", isDropdownOpen ? "block" : "none");
        
        // 旋转箭头
        arrow.attr("transform", isDropdownOpen ? `rotate(180, ${arrowX}, ${arrowY})` : "");
      });
      
      // 点击下拉菜单文本切换显示/隐藏
      dropdownText.on("click", function() {
        isDropdownOpen = !isDropdownOpen;
        dropdownOptions.style("display", isDropdownOpen ? "block" : "none");
        
        // 旋转箭头
        arrow.attr("transform", isDropdownOpen ? `rotate(180, ${arrowX}, ${arrowY})` : "");
      });
      
      // 点击箭头切换显示/隐藏
      arrow.on("click", function() {
        isDropdownOpen = !isDropdownOpen;
        dropdownOptions.style("display", isDropdownOpen ? "block" : "none");
        
        // 旋转箭头
        arrow.attr("transform", isDropdownOpen ? `rotate(180, ${arrowX}, ${arrowY})` : "");
      });
      
      // 为每个选项添加点击事件
      dropdownOptions.selectAll(".dropdown-option").on("click", function() {
        const groupIndex = parseInt(this.getAttribute("data-group-index"));
        currentGroupIndex = groupIndex;
        
        // 更新显示的文本
        dropdownText.text(`Group ${groupIndex + 1}`);
        
        // 隐藏下拉选项
        isDropdownOpen = false;
        dropdownOptions.style("display", "none");
        arrow.attr("transform", "");
        
        // 获取选中的组名
        const selectedGroupName = Object.keys(groupMap)[groupIndex];
        
        // 获取该组的颜色映射
        const selectedGroupColorMap = groupColorMaps[depth]?.[selectedGroupName] || {};
        currentGroupColorMap = selectedGroupColorMap; // 更新当前组的颜色映射
        
        // 重新创建sidebar，显示选中组的色块
        sidebarRects = createSidebar(selectedGroupColorMap, selectedGroupName);
        
        // 闪亮对应的覆盖矩形
        highlightGroupRect(depth, selectedGroupName, layerG, groupMap);
      
      });
      
      // 添加鼠标悬停效果
      dropdownBg.on("mouseover", function() {
        d3.select(this).attr("fill", "#e9ecef");
      }).on("mouseout", function() {
        d3.select(this).attr("fill", "#f8f9fa");
      });
      
      dropdownOptions.selectAll(".dropdown-option").on("mouseover", function() {
        d3.select(this).attr("fill", "#e9ecef");
      }).on("mouseout", function() {
        d3.select(this).attr("fill", "#ffffff");
      });
    });

    // 获取内容的包围盒
    const bbox = g.node().getBBox();
    const svgWidth = width;   // 你的 svg 宽度
    const svgHeight = height; // 你的 svg 高度

    // 计算缩放比例（留点边距，比如 0.9）
    const scale = Math.min(
      svgWidth / bbox.width,
      svgHeight / bbox.height,
      1 // 不要放大超过1
    ) * 0.9;

    // 计算平移，让内容居中
    const translateX = 500;
    const translateY = 0;

    // 应用初始缩放和平移
    svg.transition().duration(0).call(
      zoom.transform,
      d3.zoomIdentity
        .translate(translateX, translateY)
        .scale(scale)
    );
  }

  return {
    drawTreeChart,
    setupNodeEvents
  }
} 