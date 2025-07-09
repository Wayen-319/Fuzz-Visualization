<template>
  <div class="container">
    <h2 style="margin-bottom: 20px;">树状图示例</h2>
    <div 
      id="graph-chart-container" 
      class="chart-container"
    ></div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<style>
.tooltip {  
  position: absolute;
  min-width: 400px;
  max-width: 800px;
  padding: 15px;
  font-size: 14px;
  text-align: left;
  color: black;
  border: 2px solid #ccc;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 0 15px rgba(0,0,0,0.2);
  pointer-events: auto;
  z-index: 10;
  line-height: 1.5;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-family: Arial, sans-serif;
}

.tooltip.persistent {
  border-color: #219ebc;
}

.tooltip .close-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  cursor: pointer;
  color: #666;
  font-size: 16px;
  border-radius: 50%;
  background: #f0f0f0;
  display: none;
}

.tooltip.persistent .close-btn {
  display: block;
}

.tooltip .close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.tooltip .content {
  margin-right: 20px;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: auto;
  white-space: normal;
}

.tooltip .content pre {
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 300px;
  font-family: Arial, sans-serif;
  display: block;
  width: 100%;
}

.error {
  color: red;
  margin-top: 20px;
}

.chart-container {
  position: relative;
  width: min(90vw, 1200px);
  height: min(70vh, 800px);
  border: 1px solid #eee;
  background: #fafbfc;
  box-sizing: border-box;
  overflow: hidden;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 0;
}
</style>

<script setup>
import { onMounted, ref } from 'vue'
import { useTreeChart } from './useTreeChart.js'
import { useTooltip } from './useTooltip.js'
import { useDataLoader } from './useDataLoader.js'

const error = ref(null)
const { loadData } = useDataLoader()
const { createTooltip, setupTooltipEvents, escapeHtml } = useTooltip()
const { drawTreeChart, setupNodeEvents } = useTreeChart()

onMounted(async () => {
  try {
    const { treeData, sameData, mergeData } = await loadData()
    const tooltip = createTooltip()
    setupTooltipEvents(tooltip, sameData)
    drawTreeChart(treeData, sameData, mergeData, tooltip, escapeHtml)
  } catch (e) {
    error.value = "数据加载失败"
    console.error(e)
  }
})
</script>