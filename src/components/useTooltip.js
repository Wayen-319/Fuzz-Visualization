import * as d3 from 'd3'

export function useTooltip() {
  const escapeHtml = (text) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  const createTooltip = () => {
    return d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .html('<div class="close-btn">×</div><div class="content"></div>')
  }

  const setupTooltipEvents = (tooltip, sameData) => {
    // 添加关闭按钮事件
    tooltip.select(".close-btn")
      .on("click", () => {
        tooltip.transition().duration(200).style("opacity", 0)
        tooltip.classed("persistent", false)
      })

    return {
      tooltip,
      escapeHtml,
      sameData
    }
  }

  return {
    createTooltip,
    setupTooltipEvents,
    escapeHtml
  }
} 