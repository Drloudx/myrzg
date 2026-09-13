// Match the original build_tree_botm artwork without stretching its square icon frame.
export const CAMP_RESEARCH_NODE = Object.freeze({ width: 292, height: 88 })

/** Lay out the configured prerequisite graph from left to right; never invent game progress. */
export function layoutCampResearch(entries) {
  const index = new Map(entries.map(entry => [entry.id, entry]))
  const depths = new Map()
  function depth(entry, visiting = new Set()) {
    if (depths.has(entry.id)) return depths.get(entry.id)
    if (visiting.has(entry.id)) throw new Error('Cyclic camp research prerequisites')
    visiting.add(entry.id)
    const parent = index.get(entry.prerequisite?.id)
    const value = parent ? depth(parent, visiting) + 1 : 0
    visiting.delete(entry.id)
    depths.set(entry.id, value)
    return value
  }
  const columns = []
  for (const entry of entries) (columns[depth(entry)] ||= []).push(entry)
  const columnGap = CAMP_RESEARCH_NODE.width + 40
  const rowGap = CAMP_RESEARCH_NODE.height + 18
  const width = Math.max(1, columns.length) * columnGap + 24
  const height = Math.max(1, ...columns.map(column => column.length)) * rowGap + 28
  const nodes = columns.flatMap((column, columnIndex) => column.map((entry, rowIndex) => ({
    ...entry,
    x: 12 + columnIndex * columnGap,
    y: Math.max(14, (height - column.length * rowGap) / 2) + rowIndex * rowGap
  })))
  const positions = new Map(nodes.map(node => [node.id, node]))
  const edges = nodes.flatMap(node => {
    const parent = positions.get(node.prerequisite?.id)
    if (!parent) return []
    const fromX = parent.x + CAMP_RESEARCH_NODE.width, fromY = parent.y + CAMP_RESEARCH_NODE.height / 2
    const toX = node.x, toY = node.y + CAMP_RESEARCH_NODE.height / 2
    const middleX = (fromX + toX) / 2
    return [{ from: parent.id, to: node.id, path: `M ${fromX} ${fromY} H ${middleX} V ${toY} H ${toX}` }]
  })
  return { width, height, nodes, edges }
}
