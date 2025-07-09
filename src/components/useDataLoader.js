export function useDataLoader() {
  const loadData = async () => {
    const res = await fetch('b.json')
    const same = await fetch('same.json')
    const merge = await fetch('merge.json')
    
    if (!res.ok) throw new Error('b.json not found')
    
    const data = await res.json()
    const sameData = await same.json()
    const mergeData = await merge.json()
    
    // 创建节点映射
    const idMap = {}
    data.nodes.forEach(n => {
      idMap[n.name] = { ...n, children: [] }
    })
    
    // 创建link映射
    const linkMap = {}
    data.links.forEach(l => {
      linkMap[`${l.source}-${l.target}`] = l.content
    })
    
    // 构建树结构
    data.links.forEach(l => {
      if (idMap[l.source] && idMap[l.target]) {
        idMap[l.source].children = idMap[l.source].children || []
        const childNode = { 
          ...idMap[l.target], 
          linkContent: linkMap[`${l.source}-${l.target}`] 
        }
        idMap[l.source].children.push(childNode)
      }
    })
    
    // 找到根节点
    const targets = new Set(data.links.map(l => l.target))
    const rootNode = data.nodes.find(n => !targets.has(n.name)) || data.nodes[0]
    
    return {
      treeData: idMap[rootNode.name],
      sameData,
      mergeData
    }
  }
  
  return { loadData }
} 