# 树状图组件重构说明

## 重构目标
将原本1800+行的复杂Vue组件重构为模块化、可维护的结构。

## 新的文件结构

### 主组件
- `hierarchy.vue` - 主组件，现在只有128行，负责组合各个模块

### Composables (组合式函数)
- `useDataLoader.js` - 数据加载逻辑
- `useTooltip.js` - 工具提示功能
- `useTreeLayout.js` - 树状图布局逻辑
- `useTreeRendering.js` - 树状图渲染逻辑
- `useTreeChart.js` - 主图表逻辑，协调其他模块

## 模块职责

### useDataLoader.js
- 负责加载和解析JSON数据
- 构建树状结构
- 找到根节点

### useTooltip.js
- 创建和管理工具提示
- HTML转义功能
- 工具提示事件处理

### useTreeLayout.js
- 覆盖率计算
- 层次结构创建
- 节点布局算法
- 分组节点布局

### useTreeRendering.js
- 节点矩形绘制
- 层覆盖矩形绘制
- 节点绘制
- 第二套内容绘制
- 横线绘制和拖动行为
- 连线创建
- 节点可见性更新

### useTreeChart.js
- 主绘制函数
- 节点事件设置
- 协调各个模块

## 优势

1. **可维护性**: 每个模块职责单一，易于理解和修改
2. **可复用性**: 各个composable可以在其他组件中复用
3. **可测试性**: 每个模块可以独立测试
4. **可扩展性**: 新增功能时只需要修改相应的模块

## 使用方式

```javascript
import { useTreeChart } from './composables/useTreeChart'
import { useTooltip } from './composables/useTooltip'
import { useDataLoader } from './composables/useDataLoader'

const { loadData } = useDataLoader()
const { createTooltip, setupTooltipEvents, escapeHtml } = useTooltip()
const { drawTreeChart, setupNodeEvents } = useTreeChart()
```

## 进一步优化建议

1. 可以进一步拆分useTreeRendering.js中的复杂渲染逻辑
2. 添加TypeScript支持以提高类型安全性
3. 添加单元测试覆盖各个模块
4. 考虑使用状态管理库来管理复杂的状态 