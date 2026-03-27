import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

type Edge = {
  from: string
  to: string
}

type GraphNode = d3.SimulationNodeDatum & {
  id: string
}

type GraphLink = d3.SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode
  target: string | GraphNode
}

type Props = {
  edges: Edge[]
}

export function GraphView({ edges }: Props) {
  const ref = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    const svg = ref.current
    if (!svg) return

    const width = 560
    const height = 320
    const data = edges.slice(0, 45)

    const nodesMap = new Map<string, GraphNode>()
    data.forEach((edge) => {
      nodesMap.set(edge.from, { id: edge.from })
      nodesMap.set(edge.to, { id: edge.to })
    })

    const nodes = [...nodesMap.values()]
    const links: GraphLink[] = data.map((edge) => ({ source: edge.from, target: edge.to }))

    const root = d3.select(svg)
    root.selectAll('*').remove()
    root.attr('viewBox', `0 0 ${width} ${height}`)

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id((node: GraphNode) => node.id).distance(70))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))

    const link = root
      .append('g')
      .attr('stroke', '#435d7f')
      .attr('stroke-opacity', 0.7)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1)

    const node = root
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 4)
      .attr('fill', '#36a5ff')

    const labels = root
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((node: GraphNode) => (node.id.length > 18 ? `${node.id.slice(0, 18)}…` : node.id))
      .attr('fill', '#b2c4df')
      .attr('font-size', 10)
      .attr('font-family', 'monospace')

    simulation.on('tick', () => {
      link
        .attr('x1', (edge: GraphLink) => (edge.source as GraphNode).x ?? 0)
        .attr('y1', (edge: GraphLink) => (edge.source as GraphNode).y ?? 0)
        .attr('x2', (edge: GraphLink) => (edge.target as GraphNode).x ?? 0)
        .attr('y2', (edge: GraphLink) => (edge.target as GraphNode).y ?? 0)

      node.attr('cx', (node: GraphNode) => node.x ?? 0).attr('cy', (node: GraphNode) => node.y ?? 0)
      labels.attr('x', (node: GraphNode) => (node.x ?? 0) + 6).attr('y', (node: GraphNode) => (node.y ?? 0) + 3)
    })

    return () => {
      simulation.stop()
    }
  }, [edges])

  return <svg ref={ref} className="w-full rounded-lg border border-slate-800 bg-slate-950/80" role="img" aria-label="Dependency graph" />
}
