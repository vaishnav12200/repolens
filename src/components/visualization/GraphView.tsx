import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

type Edge = {
  from: string
  to: string
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

    const nodesMap = new Map<string, { id: string }>()
    data.forEach((edge) => {
      nodesMap.set(edge.from, { id: edge.from })
      nodesMap.set(edge.to, { id: edge.to })
    })

    const nodes = [...nodesMap.values()]
    const links = data.map((edge) => ({ source: edge.from, target: edge.to }))

    const root = d3.select(svg)
    root.selectAll('*').remove()
    root.attr('viewBox', `0 0 ${width} ${height}`)

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d) => (d as { id: string }).id).distance(70))
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
      .text((d) => (d.id.length > 18 ? `${d.id.slice(0, 18)}…` : d.id))
      .attr('fill', '#b2c4df')
      .attr('font-size', 10)
      .attr('font-family', 'monospace')

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as d3.SimulationNodeDatum).x ?? 0)
        .attr('y1', (d) => (d.source as d3.SimulationNodeDatum).y ?? 0)
        .attr('x2', (d) => (d.target as d3.SimulationNodeDatum).x ?? 0)
        .attr('y2', (d) => (d.target as d3.SimulationNodeDatum).y ?? 0)

      node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0)
      labels.attr('x', (d) => (d.x ?? 0) + 6).attr('y', (d) => (d.y ?? 0) + 3)
    })

    return () => {
      simulation.stop()
    }
  }, [edges])

  return <svg ref={ref} className="w-full rounded-lg border border-slate-800 bg-slate-950/80" role="img" aria-label="Dependency graph" />
}
